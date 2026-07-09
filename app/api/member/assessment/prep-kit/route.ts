// POST /api/member/assessment/prep-kit — Phase 3 Wave 4 (C9).
// ─────────────────────────────────────────────────────────────────────────────
// Generate a vendor-meeting prep kit from the vendor's REAL scorecard (optionally
// the W3 context-adjusted weak/thin domains). Gating mirrors Interrogate:
// isSameOrigin → getMember → PREP_KIT_ENABLED (scaffolded, not enforced).
//
// FIREWALL: returns questions + framework-derived templates. No prisma write, no
// score write; the canonical 0–5 scores are read and never altered. The LLM writes
// questions only — never a vendor fact or score.

import { NextResponse } from "next/server";
import { getMemberOrHeroDemo } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { PREP_KIT_ENABLED } from "@/lib/availability";
import { reserveCredit } from "@/lib/billing/credits";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { getVendorScorecard } from "@/lib/assessment/domain-scores";
import { ASSESSMENT_DOMAINS } from "@/lib/assessment/domain-rubric";
import {
  deriveKitTargets,
  buildDomainDigest,
  assemblePrepKit,
  fallbackQuestions,
} from "@/lib/assessment/prep-kit";
import { generatePrepQuestions } from "@/lib/agents/prep-kit";
import type { DomainId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DOMAIN_SET = new Set<DomainId>(ASSESSMENT_DOMAINS);

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Spend guard (LLM route, reachable without a session under test-open).
  const rl = rateLimit(`prepkit:${anonSessionHash(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const member = await getMemberOrHeroDemo();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!PREP_KIT_ENABLED) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  // C16 credit meter — inert unless BILLING_ENABLED (see interrogate route).
  const reservation = await reserveCredit(member.subscriberId, "prep_kit");
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
  const b = body as { vendorId?: unknown; vendorName?: unknown; contextWeakDomains?: unknown };
  const vendorId = typeof b.vendorId === "string" ? b.vendorId : "";
  if (!vendorId) return NextResponse.json({ error: "invalid_vendor" }, { status: 400 });
  const vendorName = typeof b.vendorName === "string" && b.vendorName.trim() ? b.vendorName.trim().slice(0, 120) : vendorId;
  // Optional: the buyer's context-adjusted weak domains from a prior Interrogate
  // run (validated against the real domain set — never trusted blindly).
  const contextWeakDomains = Array.isArray(b.contextWeakDomains)
    ? b.contextWeakDomains.filter((d): d is DomainId => typeof d === "string" && DOMAIN_SET.has(d as DomainId))
    : undefined;

  const scorecard = await getVendorScorecard(vendorId).catch(() => null);
  if (!scorecard || !scorecard.hasAnyEvidence) {
    return NextResponse.json({ error: "no_evidence" }, { status: 422 });
  }

  const targets = deriveKitTargets(scorecard, contextWeakDomains);
  const digest = buildDomainDigest(scorecard, targets);

  let questions;
  let source: "anthropic" | "stub";
  try {
    const llm = await generatePrepQuestions({ vendorName, digest, targets });
    questions = llm.data;
    source = llm.source;
  } catch (err) {
    const e = err as { status?: number; anthropicType?: string; message?: string };
    return NextResponse.json(
      { error: "llm_error", status: e.status ?? null, kind: e.anthropicType ?? null, message: e.message ?? String(err) },
      { status: 502 },
    );
  }

  // Commit one credit only for a REAL spend — a stub result (no API key) is free.
  await reservation.commit(source === "anthropic");

  // Guarantee a useful kit (≥8 questions where possible): pad LLM output with the
  // deterministic fallback for any uncovered weak/insufficient/staple domain.
  if (questions.length < 8) {
    const covered = new Set(questions.map((q) => q.domain));
    const pad = fallbackQuestions(targets).filter((q) => !covered.has(q.domain));
    questions = [...questions, ...pad].slice(0, 12);
  }

  const prepKit = assemblePrepKit({
    vendorId,
    vendorName,
    scorecard,
    targets,
    questions,
    source,
  });

  return NextResponse.json({ prepKit, source });
}
