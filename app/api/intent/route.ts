// POST /api/intent — anonymous buyer-intent beacon sink.
// The client sends only {eventType, targetId, targetType, path, referrer}. The
// session identity is computed SERVER-SIDE as a salted, daily-rotating,
// non-reversible hash (lib/http/anon-session.ts) — no PII, no client-set id.
// Fire-and-forget: always returns fast, never errors the caller.

import { z } from "zod";
import { anonSessionHash } from "@/lib/http/anon-session";
import { rateLimit } from "@/lib/http/rate-limit";
import { redactTokens } from "@/lib/http/redact-tokens";
import { getPrisma, hasDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  eventType: z.enum(["vendor_viewed", "comparison_run", "category_browsed", "article_read", "search", "page_view"]),
  targetId: z.string().max(160).optional(),
  targetType: z.enum(["vendor", "category", "comparison", "article"]).optional(),
  path: z.string().max(400).optional(),
  referrer: z.string().max(400).optional(),
});

export async function POST(request: Request): Promise<Response> {
  // No DB → silently accept (the beacon must never surface errors to the page).
  if (!hasDatabase()) return new Response(null, { status: 204 });

  const session = anonSessionHash(request);
  const rl = rateLimit(`intent:${session}`, { limit: 120, windowMs: 60 * 1000 });
  if (!rl.allowed) return new Response(null, { status: 429 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  try {
    await getPrisma().intentEvent.create({
      data: {
        eventType: parsed.data.eventType,
        targetId: parsed.data.targetId ?? null,
        targetType: parsed.data.targetType ?? null,
        sessionHash: session,
        referrer: redactTokens(parsed.data.referrer),
        path: redactTokens(parsed.data.path),
      },
    });
  } catch {
    // Best-effort: a logging failure must not break the user's page.
  }
  return new Response(null, { status: 204 });
}
