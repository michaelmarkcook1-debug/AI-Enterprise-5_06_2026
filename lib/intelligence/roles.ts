// Role-aware placement helpers.
// ──────────────────────────────
// The full vendor universe lives in one place, but not every entity belongs on
// every surface. Investors (SoftBank, a16z, Sequoia, MGX) and pure hardware /
// fabs (NVIDIA, AMD, Broadcom, TSMC, Cerebras) are real parts of the market map
// — they appear on Query / Query-v2 / relationship + ecosystem views — but they
// are NOT assessable AI products, so they must be excluded from ranked /
// procurement surfaces (Assess selector, Understand strategic table, Monitor
// drift, Quadrant).
//
// "Relevant point" = role decides where a vendor shows. These predicates encode
// that rule from the roleTags metadata folded into the spine.

type RoleCarrier = { roleTags?: string[] | null; category?: string | null };

// Primary role = first roleTag. A vendor whose PRIMARY role is investor or
// hardware/fab is map-only, not rankable/assessable.
const NON_RANKABLE_PRIMARY_ROLES = new Set(["Investor", "Hardware Provider"]);

export function primaryRole(v: RoleCarrier): string | undefined {
  return v.roleTags?.[0] ?? undefined;
}

/**
 * True when a vendor belongs on ranked / assessable surfaces (Assess, Understand
 * strategic table, Monitor, Quadrant). Investors and pure hardware/fabs return
 * false; everything else (platforms, models, applications, data, neoclouds,
 * sovereign, vertical) returns true. Untagged vendors default to rankable so
 * nothing silently disappears before metadata lands.
 */
export function isRankable(v: RoleCarrier): boolean {
  const primary = primaryRole(v);
  if (!primary) return true;
  return !NON_RANKABLE_PRIMARY_ROLES.has(primary);
}

/** Assessable == rankable for now; kept separate so the rule can diverge later. */
export const isAssessable = isRankable;

/** Convenience: split a list into rankable vs map-only. */
export function partitionByRankable<T extends RoleCarrier>(items: T[]): { rankable: T[]; mapOnly: T[] } {
  const rankable: T[] = [];
  const mapOnly: T[] = [];
  for (const item of items) (isRankable(item) ? rankable : mapOnly).push(item);
  return { rankable, mapOnly };
}
