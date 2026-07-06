// POST /api/interrogate/answer — submit an answer and advance the interrogation.
// Same spend guards as /start (CSRF fail-closed + per-anon rate limit). Returns
// the next question, the tailored finding when the engine concludes, or an
// honest failure — never a fabricated finding.

import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { INTERROGATION_ENGINE_ENABLED } from "@/lib/availability";
import { submitAnswer } from "@/lib/interrogation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!INTERROGATION_ENGINE_ENABLED) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  const rl = rateLimit(`interrogate-answer:${anonSessionHash(request)}`, { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { sessionId?: unknown; answer?: unknown };
  const sessionId = typeof b.sessionId === "string" ? b.sessionId : "";
  const answer = typeof b.answer === "string" ? b.answer.trim() : "";
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });
  if (answer.length < 1 || answer.length > 4000) return NextResponse.json({ error: "invalid_answer" }, { status: 400 });

  try {
    const result = await submitAnswer({ sessionId, answer });
    const status = result.kind === "failed" ? 422 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    const e = err as { status?: number; anthropicType?: string; message?: string };
    return NextResponse.json(
      { error: "engine_error", status: e.status ?? null, kind: e.anthropicType ?? null, message: e.message ?? String(err) },
      { status: 502 },
    );
  }
}
