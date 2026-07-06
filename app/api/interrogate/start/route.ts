// POST /api/interrogate/start — begin an AIE-05 interrogation.
// ─────────────────────────────────────────────────────────────────────────────
// Open test site: no auth gate (single default seat/org), but the LLM-spend
// guards stay ON — isSameOrigin (CSRF, fail-closed) + a per-anon-session rate
// limit, since an open LLM route must never allow anonymous runaway spend.
// The engine grounds every finding in cited evidence by construction; this
// route performs no canonical writes beyond the session's own tables.

import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { INTERROGATION_ENGINE_ENABLED } from "@/lib/availability";
import { startInterrogation } from "@/lib/interrogation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!INTERROGATION_ENGINE_ENABLED) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  const rl = rateLimit(`interrogate-start:${anonSessionHash(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const opening = typeof (body as { opening?: unknown })?.opening === "string" ? (body as { opening: string }).opening.trim() : "";
  if (opening.length < 8 || opening.length > 2000) {
    return NextResponse.json({ error: "invalid_opening", detail: "Describe your situation in a sentence or two." }, { status: 400 });
  }

  try {
    const result = await startInterrogation({ openingText: opening });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as { status?: number; anthropicType?: string; message?: string };
    return NextResponse.json(
      { error: "engine_error", status: e.status ?? null, kind: e.anthropicType ?? null, message: e.message ?? String(err) },
      { status: 502 },
    );
  }
}
