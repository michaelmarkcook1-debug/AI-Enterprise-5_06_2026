// POST /api/member/assessment/interrogate — Phase 3 Wave 3 (Interrogate).
// ─────────────────────────────────────────────────────────────────────────────
// The PREMIUM, member-only LLM action: a buyer feeds real context and the
// assessment re-runs through that lens. Gating order mirrors every member route —
// isSameOrigin (CSRF, fail-closed) → getMember (authz) → INTERROGATE_ENABLED
// (the paid-depth flag; scaffolded, NOT enforced). Metering is flag-only for now
// (no usage row) per the Wave-3 posture.
//
// FIREWALL: the response is a SessionLens — adjusted WEIGHTS + cited explanation
// + per-vendor deltas. It NEVER writes a score (no prisma write here at all); the
// canonical 0–5 domain scores are read from analyst_verified evidence and never
// altered. The buyer's context is a personal, session-local lens.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { INTERROGATE_ENABLED } from "@/lib/availability";
import { reserveCredit } from "@/lib/billing/credits";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { getVendorScorecard, getVendorScorecardsBatch, type VendorScorecard } from "@/lib/assessment/domain-scores";
import { resolveDomainWeights } from "@/lib/assessment/category-weights";
import { DEFAULT_DOMAIN_WEIGHTS, activeDomains, type DomainWeights } from "@/lib/assessment/composite";
import { type DomainScore } from "@/lib/assessment/domain-rubric";
import { computeContextLens, type BuyerContext } from "@/lib/agents/composite-lens";
import { buildSessionLens, buildEvidenceSnapshot, type SessionLensVendorInput } from "@/lib/assessment/session-lens";
import { listMarketCategories } from "@/lib/intelligence/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Cap the category fan-out so a crafted request can't force an unbounded batch.
// Set above the whole vendor universe (~47) so a real category is never
// truncated — if it ever is, we surface `truncated` in the response rather than
// silently computing the lens over a partial set.
const MAX_CATEGORY_VENDORS = 60;

type Scope =
  | { kind: "vendor"; vendorId: string }
  | { kind: "category"; categoryId: string; vendorIds: string[] };

/** Fold the synthesized model_quality score into the domain set exactly as the
 *  category page does, so the lens ranks on the same active-domain set the buyer
 *  sees. Framework-default (vendor) scope never activates it. */
function effectiveDomains(sc: VendorScorecard | undefined, activatesModelQuality: boolean): DomainScore[] {
  if (!sc) return [];
  return activatesModelQuality && sc.modelQuality ? [...sc.domains, sc.modelQuality] : sc.domains;
}

function parseContext(raw: unknown): BuyerContext {
  const c = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : undefined);
  return {
    incumbents: str(c.incumbents),
    renewalTiming: str(c.renewalTiming),
    region: str(c.region),
    regulatory: str(c.regulatory),
    riskAppetite: str(c.riskAppetite),
    inHouseSkills: str(c.inHouseSkills),
    timeline: str(c.timeline),
    freeform: str(c.freeform),
  };
}

export async function POST(request: Request): Promise<Response> {
  // 1. CSRF (fail-closed) → 2. authz → 3. paid-depth flag.
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Spend guard: this route calls an LLM. With test-open it's reachable without a
  // real session, so cap it per anon-session (IP-derived) regardless of who calls.
  const rl = rateLimit(`interrogate:${anonSessionHash(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!INTERROGATE_ENABLED) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  // 4. C16 credit meter. INERT unless BILLING_ENABLED — when off, `reserve` is
  // always allowed and commits nothing, so live behaviour is unchanged. When on,
  // this blocks 402 if the plan doesn't include Interrogate or the hard cap is
  // hit; the credit is committed below ONLY if a real (anthropic) LLM call ran.
  const reservation = await reserveCredit(member.subscriberId, "interrogate");
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
  const b = body as { scope?: unknown; context?: unknown };
  const scope = b.scope as Scope | undefined;
  const context = parseContext(b.context);

  // Resolve the base weight profile + the in-scope vendor scorecards (canonical,
  // server-fetched — never trust client-sent scores).
  let baseWeights: DomainWeights;
  let vendors: SessionLensVendorInput[];
  let scopeLabel: string;
  let scopeRef: { kind: "vendor" | "category"; id: string };
  let truncated = false; // set if a category exceeds MAX_CATEGORY_VENDORS

  if (scope?.kind === "vendor" && typeof scope.vendorId === "string") {
    baseWeights = DEFAULT_DOMAIN_WEIGHTS;
    const sc = await getVendorScorecard(scope.vendorId).catch(() => null);
    if (!sc || !sc.hasAnyEvidence) {
      return NextResponse.json({ error: "no_evidence" }, { status: 422 });
    }
    vendors = [{ vendorId: scope.vendorId, domains: sc.domains }];
    scopeLabel = `vendor ${scope.vendorId}`;
    scopeRef = { kind: "vendor", id: scope.vendorId };
  } else if (
    scope?.kind === "category" &&
    typeof scope.categoryId === "string" &&
    Array.isArray(scope.vendorIds)
  ) {
    const cat = (await listMarketCategories().catch(() => [])).find((c) => c.id === scope.categoryId);
    if (!cat) return NextResponse.json({ error: "unknown_category" }, { status: 422 });
    baseWeights = resolveDomainWeights(scope.categoryId);
    const activatesModelQuality = (baseWeights.model_quality ?? 0) > 0;
    const allIds = scope.vendorIds.filter((v): v is string => typeof v === "string");
    const ids = allIds.slice(0, MAX_CATEGORY_VENDORS);
    truncated = ids.length < allIds.length;
    const cards = await getVendorScorecardsBatch(ids).catch(() => new Map<string, VendorScorecard>());
    vendors = ids
      .map((id) => ({ vendorId: id, domains: effectiveDomains(cards.get(id), activatesModelQuality) }))
      .filter((v) => v.domains.length > 0);
    if (vendors.length === 0) return NextResponse.json({ error: "no_evidence" }, { status: 422 });
    scopeLabel = `the ${cat.name} shortlist`;
    scopeRef = { kind: "category", id: scope.categoryId };
  } else {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }

  const active = activeDomains(baseWeights);
  const snapshot = buildEvidenceSnapshot(active, vendors);

  // The single LLM step. Never throws for a missing key (falls back to the zero-
  // delta stub); a real API error propagates enriched (status/anthropicType).
  let lens;
  try {
    lens = await computeContextLens({ activeDomains: active, snapshot, context, scopeLabel });
  } catch (err) {
    const e = err as { status?: number; anthropicType?: string; message?: string };
    return NextResponse.json(
      { error: "llm_error", status: e.status ?? null, kind: e.anthropicType ?? null, message: e.message ?? String(err) },
      { status: 502 },
    );
  }

  // Commit one credit only for a REAL spend — a stub result (no API key) is free.
  await reservation.commit(lens.source === "anthropic");

  const sessionLens = buildSessionLens({
    scope: scopeRef,
    baseWeights,
    adjustments: lens.data.adjustments,
    vendors,
    overallNote: lens.data.overallNote,
    insufficientContext: lens.data.insufficientContext,
  });

  return NextResponse.json({
    sessionLens,
    source: lens.source, // "anthropic" | "stub"
    model: lens.usage.model,
    // Honesty: if a category ever exceeds the cap, the lens was computed over the
    // first MAX_CATEGORY_VENDORS only — surfaced, never silent.
    truncated,
  });
}
