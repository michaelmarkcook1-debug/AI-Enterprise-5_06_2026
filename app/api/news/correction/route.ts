// POST /api/news/correction — C12 news→vendor classification correction.
// ─────────────────────────────────────────────────────────────────────────────
// Public, unauthenticated write path, so it's guarded like every other write on
// this platform: isSameOrigin (CSRF, fail-closed) → per-IP rate limit → strict
// input validation. The suggestion lands in a MODERATED pending queue and NEVER
// auto-applies to the news item, the news→vendor mapping, or any score — an admin
// reviews it. No raw IP / PII is stored (an IP-derived hash only). This is the
// "shown + correctable, never a hidden judgement" rail from the C12 spec, made
// safe for the most public surface.

import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { validateCorrection, createCorrection } from "@/lib/news-bridge/corrections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Abuse guard on a public write path — bounded suggestions per IP-derived key.
  const anon = anonSessionHash(request);
  const rl = rateLimit(`news-correction:${anon}`, { limit: 15, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = validateCorrection(body);
  if (!parsed.ok) return NextResponse.json({ error: "invalid", detail: parsed.error }, { status: 400 });

  const stored = await createCorrection(parsed.value, anon);
  // A DB-less environment returns false; report honestly rather than a fake success.
  if (!stored) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  return NextResponse.json({ ok: true, status: "pending_review" });
}
