// POST /api/pool/contribute — AIE-06's consent step.
// ─────────────────────────────────────────────────────────────────────────────
// The whole write sequence — the atomic consent claim, the pool insert, and
// the incentive grant — runs inside ONE database transaction. This closes two
// related integrity gaps a prior version had:
//   • a race: two concurrent POSTs for the same session could both pass a
//     read-then-write consent check before either wrote, producing two pool
//     rows for one real contributor. The fix is claimConsentSlot's atomic
//     INSERT ... ON CONFLICT (session_id) DO NOTHING — the table's own UNIQUE
//     constraint is the concurrency gate, checked and claimed in one
//     statement, not a separate read then a later write.
//   • a partial failure: if the pool insert succeeded but the incentive grant
//     then threw, a retry (after an error state in the UI) would re-run the
//     whole thing and insert a SECOND pool row for the same contributor. Now
//     that everything commits or rolls back together, a mid-sequence failure
//     leaves NOTHING committed — including the consent claim — so a retry
//     starts clean instead of duplicating.
// Declining (consent=false) still just claims + records the decision — the
// interrogation engine's own service was never gated on this either way.

import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/http/same-origin";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/interrogation/session-store";
import { claimConsentSlot, insertPoolContribution } from "@/lib/pool/consent-store";
import { anonymizeForPool } from "@/lib/pool/anonymize";
import { grantContributorIncentive } from "@/lib/pool/incentive";
import { DRAFT_TERMS_VERSION } from "@/lib/pool/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rl = rateLimit(`pool-contribute:${anonSessionHash(request)}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { sessionId?: unknown; consent?: unknown };
  const sessionId = typeof b.sessionId === "string" ? b.sessionId : "";
  const consent = b.consent === true;
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (consent && !session.intentProfile) {
    return NextResponse.json({ error: "no_intent_to_contribute" }, { status: 422 });
  }

  // Anonymization happens BEFORE the transaction — it calls out to the LLM
  // client, and a DB transaction must never sit open across a slow external
  // call (it would hold row locks/connections for the duration). By the time
  // the transaction opens, `contribution` is already a plain value with no
  // DB dependency of its own.
  const contribution = consent && session.intentProfile ? await anonymizeForPool(session.intentProfile) : null;

  try {
    const result = await getPrisma().$transaction(async (tx) => {
      const claim = await claimConsentSlot(
        {
          sessionId,
          seatId: session.seatId,
          orgId: session.orgId,
          consented: consent,
          termsVersion: DRAFT_TERMS_VERSION,
          decidedAt: new Date().toISOString(),
        },
        tx,
      );
      if (!claim.claimed) {
        // Another concurrent request already decided this session — return
        // its decision, and do NOT redo any pool work.
        return { consented: claim.consented, alreadyDecided: true };
      }
      if (claim.consented && contribution) {
        await insertPoolContribution(contribution, tx);
        await grantContributorIncentive(session.orgId, new Date(), tx);
      }
      return { consented: claim.consented, alreadyDecided: false };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: "pool_error", message: (err as Error)?.message ?? String(err) }, { status: 502 });
  }
}
