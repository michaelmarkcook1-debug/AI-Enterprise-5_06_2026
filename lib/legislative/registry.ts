// Legislative register — pure query/derivation helpers over LEGISLATIVE_INSTRUMENTS.
// No DB, no LLM; deterministic filters + sorts + the domain tie-in for the UI.

import {
  LEGISLATIVE_INSTRUMENTS,
  JURISDICTION_LABEL,
  type LegislativeInstrument,
  type Jurisdiction,
} from "./instruments";
import type { IndustryTag } from "../use-cases";
import type { DomainId } from "../types";
import { DOMAIN_LABEL } from "../assessment/domain-labels";

/** Status ordering for display: live obligations first, proposals/frameworks last. */
const STATUS_RANK: Record<LegislativeInstrument["status"], number> = {
  in_force: 0,
  enacted: 1,
  proposed: 2,
  framework: 3,
};

/** Deterministic register order: by status (live first), then soonest/most-recent
 *  in-force date, then name — so the list is stable and the most operative
 *  instruments lead. */
export function listInstruments(source: LegislativeInstrument[] = LEGISLATIVE_INSTRUMENTS): LegislativeInstrument[] {
  return [...source].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    // Within a status, most-recent in-force date first (nulls last).
    const ad = a.inForceDate ?? "";
    const bd = b.inForceDate ?? "";
    if (ad !== bd) return bd.localeCompare(ad);
    return a.name.localeCompare(b.name);
  });
}

/** Distinct jurisdictions actually present, in a sensible display order. */
export function jurisdictionsPresent(source: LegislativeInstrument[] = LEGISLATIVE_INSTRUMENTS): Jurisdiction[] {
  const order = Object.keys(JURISDICTION_LABEL) as Jurisdiction[];
  const present = new Set(source.map((i) => i.jurisdiction));
  return order.filter((j) => present.has(j));
}

/** Distinct sector verticals referenced by at least one instrument. */
export function verticalsPresent(source: LegislativeInstrument[] = LEGISLATIVE_INSTRUMENTS): IndustryTag[] {
  const set = new Set<IndustryTag>();
  for (const i of source) for (const v of i.verticals) set.add(v);
  return [...set].sort();
}

/**
 * Filter by jurisdiction and/or vertical. A vertical filter keeps HORIZONTAL
 * instruments (empty verticals — economy-wide, so they apply to that sector too)
 * PLUS instruments explicitly tagged for that vertical — never hiding a rule that
 * genuinely applies. Null/undefined = no filter on that axis.
 */
export function filterInstruments(opts: {
  jurisdiction?: Jurisdiction | null;
  vertical?: IndustryTag | null;
  source?: LegislativeInstrument[];
}): LegislativeInstrument[] {
  const source = opts.source ?? LEGISLATIVE_INSTRUMENTS;
  return listInstruments(source).filter((i) => {
    if (opts.jurisdiction && i.jurisdiction !== opts.jurisdiction) return false;
    if (opts.vertical && i.verticals.length > 0 && !i.verticals.includes(opts.vertical)) return false;
    return true;
  });
}

/** The "updates feed": most-recently-verified/updated instruments first (by asOf,
 *  then in-force date). A view of the same cited data — the Market-Today pattern
 *  for law/reg. */
export function recentlyUpdated(limit = 6, source: LegislativeInstrument[] = LEGISLATIVE_INSTRUMENTS): LegislativeInstrument[] {
  return [...source]
    .sort((a, b) => {
      if (a.asOf !== b.asOf) return b.asOf.localeCompare(a.asOf);
      return (b.inForceDate ?? "").localeCompare(a.inForceDate ?? "");
    })
    .slice(0, limit);
}

/** The domain tie-in for the UI: an instrument's touched domains as {id,label},
 *  in canonical label order. Labels come from the SAME DOMAIN_LABEL the assessment
 *  surfaces use, so the chips match the vendor evidence they link to. */
export function domainLabelsFor(inst: LegislativeInstrument): { id: DomainId; label: string }[] {
  return inst.domains.map((id) => ({ id, label: DOMAIN_LABEL[id] ?? id }));
}
