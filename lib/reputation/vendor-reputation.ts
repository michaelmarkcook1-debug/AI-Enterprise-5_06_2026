// Per-vendor reputation read for the public vendor profile.
// ─────────────────────────────────────────────────────────
// Reputation is a CURRENT composite (developer / employee / customer), each a
// 0-100 `overall` with its own dataStatus (seed | documented | verified) and
// sources. There is NO historical reputation series in the seed — so this powers
// the point-in-time panel. The forward-tracking LINE is built separately from
// vendor_reputation_snapshots (see reputation-snapshots.ts), which only accrues
// from the day capture starts — we never back-fill invented history.

import {
  REPUTATION_INDEX,
  type DeveloperReputation,
  type EmployeeReputation,
  type CustomerReputation,
} from "./seed";

export interface VendorReputation {
  developer: DeveloperReputation | null;
  employee: EmployeeReputation | null;
  customer: CustomerReputation | null;
  /** Mean of the available pillar overalls (0-100); null when no pillar exists. */
  combined: number | null;
  /** Most-recent real fetch date across pillars (ISO), or null when curated/seed. */
  asOf: string | null;
  /** True when at least one pillar has any reputation data. */
  hasData: boolean;
}

/** Resolve a vendor's current reputation composite + breakdown. Pure/static —
 *  no DB, no network. Returns hasData=false when the vendor has no signals. */
export function getVendorReputation(vendorId: string): VendorReputation {
  const developer = REPUTATION_INDEX.developer.get(vendorId) ?? null;
  const employee = REPUTATION_INDEX.employee.get(vendorId) ?? null;
  const customer = REPUTATION_INDEX.customer.get(vendorId) ?? null;

  const overalls = [developer?.overall, employee?.overall, customer?.overall].filter(
    (x): x is number => typeof x === "number",
  );
  const combined = overalls.length
    ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
    : null;

  const fetchedDates = [
    developer?.githubLastFetched,
    developer?.redditLastFetched,
    developer?.forumLastFetched,
    developer?.apiLastFetched,
    employee?.litigationLastFetched,
  ].filter((d): d is string => typeof d === "string" && d.length > 0);
  const asOf = fetchedDates.length ? fetchedDates.slice().sort().at(-1)! : null;

  return { developer, employee, customer, combined, asOf, hasData: overalls.length > 0 };
}
