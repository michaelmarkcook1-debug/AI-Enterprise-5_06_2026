// Peer AI-usage AGGREGATE — the client-base-wide view (redesign 2026-07-06).
// ─────────────────────────────────────────────────────────────────────────────
// The peer tab's new DEFAULT surface: "what is the whole tracked enterprise base
// doing with AI", aggregated across every cited peer — BEFORE the user narrows to
// their own segment. Two honest, evidence-graded layers, both from lib/peer/*:
//
//   1. INDUSTRY ADOPTION (breadth) — the cited US-Census BTOS AI-adoption rate per
//      vertical (VERTICAL_STATS). Real government survey data; covers 12 verticals.
//      This is "how much of this industry uses AI at all", never vendor-specific.
//
//   2. VENDOR USAGE (who) — disclosed, cited platform_integration signals from the
//      named peer exemplars, grouped by the company's vertical × vendor. Real and
//      cited, but thin by construction (only where a company has PUBLICLY disclosed
//      a vendor) — currently financial services + pharma. Absence is never non-use.
//
// HARD RULES (same firewall as the rest of lib/peer):
//   • Every number traces to a cited row already in the dataset — nothing is
//     synthesised, formula-derived, or seed. A vertical with a benchmark but no
//     disclosed exemplars shows the benchmark + an honest "no named adopters cited
//     yet", never a fabricated count.
//   • Vendor usage is DISCLOSED-only; we never assert private/internal use.
//   • We never imply a vendor↔use-case linkage the citations don't support — the
//     use-case lens filters INDUSTRIES (where a use-case is a top cited deployment),
//     it does not claim "vendor X is used FOR use-case Y".
//   • Pure/deterministic. No DB, no LLM, no writes. Grows only as cited rows land.

import { PEER_COMPANIES } from "./peer-adoption-data";
import { VERTICAL_STATS, SEGMENT_BENCHMARKS, type SegmentStat } from "./segment-benchmarks";
import { VERTICALS } from "./segments";
import type { IndustryTag } from "../use-cases";

const VERTICAL_LABEL = new Map<string, string>(VERTICALS.map((v) => [v.id, v.label]));

export interface VendorUsageCell {
  vendorId: string;
  /** # of tracked peer companies in this vertical that have DISCLOSED adopting it. */
  adopters: number;
  /** The named companies (for the "cited, disclosed" tooltip / drill-down). */
  companies: string[];
}

export interface IndustryUsageRow {
  verticalId: string;
  label: string;
  /** Cited industry-wide AI-adoption benchmark (BTOS), or null when none compiled. */
  adoptionStat: SegmentStat | null;
  /** # of named peer exemplars tracked in this vertical (0 = none cited yet). */
  companyCount: number;
  /** Disclosed vendor usage, ranked. Empty = no disclosed adoptions cited yet. */
  vendorUsage: VendorUsageCell[];
}

/** First cited adoption-rate stat for a vertical (BTOS survey), or null. */
function adoptionStatFor(verticalId: string): SegmentStat | null {
  const stats = VERTICAL_STATS[verticalId as IndustryTag];
  if (!stats) return null;
  return stats.find((s) => s.kind === "adoption_rate") ?? stats[0] ?? null;
}

/** Disclosed vendor usage for the peer companies in one vertical, ranked. */
function vendorUsageForVertical(verticalId: string): VendorUsageCell[] {
  const byVendor = new Map<string, Set<string>>();
  for (const c of PEER_COMPANIES) {
    if (c.segment.vertical !== verticalId) continue;
    const sig = c.signals.find((x) => x.kind === "platform_integration");
    if (!sig || sig.status !== "disclosed") continue;
    for (const v of sig.vendorIds ?? []) {
      if (!byVendor.has(v)) byVendor.set(v, new Set());
      byVendor.get(v)!.add(c.name);
    }
  }
  return [...byVendor.entries()]
    .map(([vendorId, companies]) => ({ vendorId, adopters: companies.size, companies: [...companies] }))
    .sort((a, b) => b.adopters - a.adopters || a.vendorId.localeCompare(b.vendorId));
}

/** The full client-base aggregate: every vertical that has EITHER a cited adoption
 *  benchmark OR named disclosed adopters. Benchmarks first (breadth), vendor usage
 *  layered in where disclosed. `useCase` (optional) narrows to verticals where that
 *  label is a top cited deployed use-case — an INDUSTRY filter, not a vendor claim. */
export function getBaseUsageAggregate(useCase?: string): IndustryUsageRow[] {
  const verticalsWithUseCase = useCase ? verticalsForUseCase(useCase) : null;
  const rows: IndustryUsageRow[] = [];
  for (const v of VERTICALS) {
    if (verticalsWithUseCase && !verticalsWithUseCase.has(v.id)) continue;
    const adoptionStat = adoptionStatFor(v.id);
    const vendorUsage = vendorUsageForVertical(v.id);
    const companyCount = PEER_COMPANIES.filter((c) => c.segment.vertical === v.id).length;
    // Include the vertical only when we have SOMETHING cited to show for it.
    if (!adoptionStat && vendorUsage.length === 0 && companyCount === 0) continue;
    rows.push({ verticalId: v.id, label: v.label, adoptionStat, companyCount, vendorUsage });
  }
  // Verticals with disclosed vendor usage lead (most informative), then the rest.
  return rows.sort(
    (a, b) => b.vendorUsage.length - a.vendorUsage.length || b.companyCount - a.companyCount || a.label.localeCompare(b.label),
  );
}

/** Vendors ranked by how many tracked peers across the WHOLE base have disclosed
 *  adopting them. Disclosed-only; deterministic. */
export function getTopVendorsAcrossBase(): VendorUsageCell[] {
  const byVendor = new Map<string, Set<string>>();
  for (const c of PEER_COMPANIES) {
    const sig = c.signals.find((x) => x.kind === "platform_integration");
    if (!sig || sig.status !== "disclosed") continue;
    for (const v of sig.vendorIds ?? []) {
      if (!byVendor.has(v)) byVendor.set(v, new Set());
      byVendor.get(v)!.add(c.name);
    }
  }
  return [...byVendor.entries()]
    .map(([vendorId, companies]) => ({ vendorId, adopters: companies.size, companies: [...companies] }))
    .sort((a, b) => b.adopters - a.adopters || a.vendorId.localeCompare(b.vendorId));
}

export interface UseCaseOption {
  label: string;
  /** Vertical ids where this is a top cited deployed use-case. */
  verticals: string[];
  verticalLabels: string[];
}

/** The cited deployed use-cases across the base, each mapped to the verticals that
 *  cite it as a top use-case — the vocabulary for the use-case dropdown. */
export function getBaseUseCases(): UseCaseOption[] {
  const byLabel = new Map<string, Set<string>>();
  for (const bench of Object.values(SEGMENT_BENCHMARKS)) {
    for (const uc of bench.topUseCases ?? []) {
      if (!byLabel.has(uc.label)) byLabel.set(uc.label, new Set());
      byLabel.get(uc.label)!.add(bench.segment.vertical);
    }
  }
  return [...byLabel.entries()]
    .map(([label, set]) => ({
      label,
      verticals: [...set],
      verticalLabels: [...set].map((id) => VERTICAL_LABEL.get(id) ?? id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function verticalsForUseCase(useCase: string): Set<string> {
  const match = getBaseUseCases().find((u) => u.label === useCase);
  return new Set(match?.verticals ?? []);
}

/** Honest "as of" for the aggregate — the newest compile date across the benchmark
 *  sets (the dataset's real freshness). ISO date string, or null. */
export function getUsageAsOf(): string | null {
  const dates = Object.values(SEGMENT_BENCHMARKS)
    .map((b) => b.compiledAt)
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .sort();
  return dates.at(-1) ?? null;
}

/** Coverage summary — used to state the honest breadth of the aggregate up front. */
export function getUsageCoverage(): { verticalsWithBenchmark: number; verticalsWithVendorUsage: number; companies: number } {
  const rows = getBaseUsageAggregate();
  return {
    verticalsWithBenchmark: rows.filter((r) => r.adoptionStat).length,
    verticalsWithVendorUsage: rows.filter((r) => r.vendorUsage.length > 0).length,
    companies: PEER_COMPANIES.length,
  };
}
