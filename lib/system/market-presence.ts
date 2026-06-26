// Evidence-derived market-presence share — the REAL replacement for the seed
// market-share baseline.
// ───────────────────────────────────────────────────────────────────────────
// There is NO free authoritative market-share feed and most vendors are private,
// so a *measured* revenue share is impossible. What we CAN compute honestly, and
// recompute every pipeline run, is a directional **category-presence** estimate
// from the REAL signals we already ingest per vendor:
//   - verifiedEvidence     count of analyst-verified evidence rows (coverage)
//   - productionReferences sum of named production deployments (in-market signal)
//   - deploymentDepth      how deep those deployments go (0–100)
//   - momentum             rolling_30d momentum from news + capability velocity
//   - deliveryReach        IT-services/GSI delivery breadth × tier × spread
//                          (lib/delivery — curated/analyst-graded, confidence-discounted)
//
// presence(vendor) = weighted blend of those five, each min-max normalised WITHIN
// the category (so it's a relative, comparable signal). share = presence / Σpresence
// over the category's evidenced members → sums to ~100% per category. A vendor with
// NO real signal is omitted (insufficient evidence), never floated at 0.
//
// HONESTY: deliveryReach is derived from CURATED analyst partnership data (lower
// provenance than pipeline-verified evidence), so it ENRICHES the estimate for a
// vendor that already has real pipeline signal — it does NOT, on its own, float a
// vendor that has zero verified pipeline signal into the share (see hasRealSignal),
// and it does NOT raise confidence (confidence stays tied to verified-evidence
// depth). Under-claim: curated reach refines, never fabricates, presence.
//
// This is a labelled DIRECTIONAL estimate of observed enterprise-adoption signal —
// NOT measured revenue share. The honest source string below is what's stamped on
// every row (and it is deliberately NOT seed-signed, so it reads as real).

export const PRESENCE_SOURCE =
  "Evidence-derived adoption-signal estimate (verified evidence + production references + deployment depth + momentum + IT-services delivery reach)";
export const PRESENCE_METHODOLOGY =
  "Directional category-presence estimate computed each refresh from real ingested signals — share of observed enterprise-adoption signal within the category, including IT-services/GSI delivery reach (curated, confidence-discounted). NOT measured revenue/market share. Confidence reflects verified-evidence depth only.";

/** Transparent, tunable blend weights (sum to 1). Adoption signals weigh most —
 *  production references + deployment depth are the strongest real in-market
 *  signal; evidence depth is coverage; momentum is recency; delivery reach is a
 *  modest, curated/analyst-graded enterprise-channel signal. */
export const PRESENCE_WEIGHTS = {
  productionReferences: 0.35,
  deploymentDepth: 0.22,
  verifiedEvidence: 0.18,
  momentum: 0.13,
  deliveryReach: 0.12,
} as const;

export interface VendorSignal {
  verifiedEvidence: number;
  productionReferences: number;
  deploymentDepth: number;
  momentum: number;
  /** IT-services/GSI delivery-reach raw signal (lib/delivery). Optional → 0. */
  deliveryReach?: number;
}

export interface PresenceShare {
  vendorId: string;
  categoryId: string;
  /** Share of category adoption-signal, 0–100; sums to ~100 over evidenced members. */
  share: number;
  /** Raw blended presence, 0–1 (pre-share). */
  presence: number;
  /** 0–99, from evidence depth — never 100 (under-claim). */
  confidence: number;
}

/** True when a vendor has ANY real PIPELINE signal (else excluded as insufficient
 *  evidence). deliveryReach is deliberately NOT a qualifier — curated partnership
 *  data enriches a present vendor's estimate but never floats an evidence-less one. */
export function hasRealSignal(s: VendorSignal | undefined): boolean {
  return !!s && (s.verifiedEvidence > 0 || s.productionReferences > 0 || s.deploymentDepth > 0 || s.momentum > 0);
}

function normWithinCategory(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}

/** Confidence from evidence depth (more verified evidence → higher, capped < 100). */
export function presenceConfidence(verifiedEvidence: number): number {
  if (verifiedEvidence <= 0) return 0;
  // 0→0, ~5 rows→~60, ~20→~80, asymptote 95. Deterministic, monotonic.
  return Math.min(95, Math.round(40 + 18 * Math.log2(1 + verifiedEvidence)));
}

/**
 * Deterministic. For each category, blend each evidenced member's real signals
 * (normalised within the category) and convert to a category-relative share.
 * Members with no real signal are dropped (not 0-filled).
 */
export function computePresenceShares(
  memberships: { vendorId: string; categoryId: string }[],
  signals: Map<string, VendorSignal>,
): PresenceShare[] {
  // Group evidenced members by category.
  const byCategory = new Map<string, { vendorId: string; s: VendorSignal }[]>();
  for (const m of memberships) {
    const s = signals.get(m.vendorId);
    if (!hasRealSignal(s)) continue; // insufficient evidence → omit
    const arr = byCategory.get(m.categoryId) ?? [];
    arr.push({ vendorId: m.vendorId, s: s! });
    byCategory.set(m.categoryId, arr);
  }

  const out: PresenceShare[] = [];
  for (const [categoryId, members] of byCategory) {
    const maxEv = Math.max(...members.map((m) => m.s.verifiedEvidence), 0);
    const maxPr = Math.max(...members.map((m) => m.s.productionReferences), 0);
    const maxDd = Math.max(...members.map((m) => m.s.deploymentDepth), 0);
    const maxMo = Math.max(...members.map((m) => m.s.momentum), 0);
    const maxDr = Math.max(...members.map((m) => m.s.deliveryReach ?? 0), 0);

    const presences = members.map((m) => {
      const p =
        PRESENCE_WEIGHTS.productionReferences * normWithinCategory(m.s.productionReferences, maxPr) +
        PRESENCE_WEIGHTS.deploymentDepth * normWithinCategory(m.s.deploymentDepth, maxDd) +
        PRESENCE_WEIGHTS.verifiedEvidence * normWithinCategory(m.s.verifiedEvidence, maxEv) +
        PRESENCE_WEIGHTS.momentum * normWithinCategory(m.s.momentum, maxMo) +
        PRESENCE_WEIGHTS.deliveryReach * normWithinCategory(m.s.deliveryReach ?? 0, maxDr);
      return { vendorId: m.vendorId, presence: p, verifiedEvidence: m.s.verifiedEvidence };
    });

    const total = presences.reduce((sum, p) => sum + p.presence, 0);
    for (const p of presences) {
      // If every member's presence is 0 (all signals tied at 0 after norm — only
      // possible if all maxes are 0, already excluded), skip; else share by total.
      const share = total > 0 ? Math.round((p.presence / total) * 1000) / 10 : 0;
      out.push({
        vendorId: p.vendorId,
        categoryId,
        share,
        presence: Math.round(p.presence * 1000) / 1000,
        confidence: presenceConfidence(p.verifiedEvidence),
      });
    }
  }
  // Deterministic order.
  out.sort((a, b) => a.categoryId.localeCompare(b.categoryId) || b.share - a.share || a.vendorId.localeCompare(b.vendorId));
  return out;
}
