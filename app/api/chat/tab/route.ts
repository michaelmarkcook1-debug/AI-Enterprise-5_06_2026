// POST /api/chat/tab — the per-tab grounded chat (piece 3).
// ─────────────────────────────────────────────────────────────────────────────
// Gating mirrors the other premium LLM actions (interrogate/prep-kit):
// isSameOrigin (CSRF, fail-closed) → getMember (authz — signed-in only, so
// anonymous drive-by LLM spend is impossible) → TAB_CHAT_ENABLED → C16 credit
// meter (INERT while BILLING_ENABLED is off — open during test).
//
// FIREWALL: the snapshot is built SERVER-SIDE from canonical reads — the
// client sends only {tab, question, history}; it can never inject evidence.
// The engine's parser drops citations outside the snapshot. This route
// performs zero canonical writes.

import { NextResponse } from "next/server";
import { getMember } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { TAB_CHAT_ENABLED } from "@/lib/availability";
import { reserveCredit } from "@/lib/billing/credits";
import { answerTabQuestion, type TabChatTurn } from "@/lib/agents/tab-chat";
import {
  buildCategoryTabSnapshot,
  buildDependenciesTabSnapshot,
  buildNewsTabSnapshot,
  buildPeersTabSnapshot,
  buildVendorTabSnapshot,
  type TabEvidenceSnapshot,
  type TabKind,
} from "@/lib/agents/tab-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface TabRef {
  kind: TabKind;
  id?: string;
  peerIds?: string[];
}

function parseHistory(raw: unknown): TabChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-6)
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const role = o.role === "assistant" ? "assistant" : "user";
      const text = typeof o.text === "string" ? o.text.slice(0, 400) : "";
      return { role, text } as TabChatTurn;
    })
    .filter((t) => t.text.length > 0);
}

async function buildSnapshot(tab: TabRef): Promise<TabEvidenceSnapshot | null> {
  switch (tab.kind) {
    case "vendor":
      return typeof tab.id === "string" && tab.id ? buildVendorTabSnapshot(tab.id) : null;
    case "category":
      return typeof tab.id === "string" && tab.id ? buildCategoryTabSnapshot(tab.id) : null;
    case "peers":
      return buildPeersTabSnapshot(Array.isArray(tab.peerIds) ? tab.peerIds.filter((x): x is string => typeof x === "string") : undefined);
    case "news":
      return buildNewsTabSnapshot();
    case "dependencies":
      return buildDependenciesTabSnapshot();
    default:
      return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!TAB_CHAT_ENABLED) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  const reservation = await reserveCredit(member.subscriberId, "tab_chat");
  if (!reservation.allowed) {
    return NextResponse.json(
      { error: "credit_limit", reason: reservation.reason, balance: reservation.balance },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { tab?: unknown; question?: unknown; history?: unknown };
  const tab = (b.tab ?? {}) as TabRef;
  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (question.length < 3 || question.length > 600) {
    return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  }

  const snapshot = await buildSnapshot(tab);
  if (!snapshot) {
    // Honest empty: nothing real to ground on for this tab/scope.
    return NextResponse.json({ error: "no_evidence" }, { status: 422 });
  }

  let result;
  try {
    result = await answerTabQuestion({ snapshot, question, history: parseHistory(b.history) });
  } catch (err) {
    const e = err as { status?: number; anthropicType?: string; message?: string };
    return NextResponse.json(
      { error: "llm_error", status: e.status ?? null, kind: e.anthropicType ?? null, message: e.message ?? String(err) },
      { status: 502 },
    );
  }

  // Commit one credit only for a REAL spend — the no-key stub is free.
  await reservation.commit(result.source === "anthropic");

  return NextResponse.json({
    answer: result.data.answer,
    citations: result.data.citations,
    insufficientEvidence: result.data.insufficientEvidence,
    whatWouldHelp: result.data.whatWouldHelp ?? null,
    source: result.source, // "anthropic" | "stub"
    model: result.usage.model,
  });
}
