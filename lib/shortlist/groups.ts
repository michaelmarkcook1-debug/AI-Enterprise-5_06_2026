// Shortlist monitor groups — decisions (by type) + the watchlist.
// ─────────────────────────────────────────────────────────────────────────────
// Assembles the monitor the way the owner asked: vendors grouped by the DECISION
// TYPE they came from (each saved Interrogate decision carries a market-category
// `category` = its type), plus the flat Watchlist as its own group. Every vendor
// card is computed ONCE over the union of all groups, so the cross-shortlist
// encroachment overlap ("competes with your X") sees the user's whole portfolio,
// not just one group.
//
// Vendor-key discipline (fixes the latent Alibaba/Moonshot/Zhipu bug): decisions
// store entity ids, the watchlist stores slugs. Both resolve to an ENTITIES entry
// here, and the scorecard/Shield reads take the right id per source downstream —
// so a shortlisted Alibaba Qwen is never dropped as "not covered". Unknown/stale
// vendor keys are skipped (honest — we show what resolves, nothing invented).

import { ENTITIES, type Entity } from "../intelligence/entities";
import { MARKET_CATEGORIES } from "../intelligence/seed";
import { listMemberDecisions } from "../member/decisions";
import { getMemberWatchlist } from "../member/watchlist";
import { shortlistScorecards, type ShortlistVendorCard } from "./scorecard";

const CATEGORY_LABEL = new Map(MARKET_CATEGORIES.map((c) => [c.id, c.name]));
const ENTITY_BY_ID = new Map(ENTITIES.map((e) => [e.id, e]));
const ENTITY_BY_SLUG = new Map(ENTITIES.map((e) => [e.slug, e]));

export interface MonitorGroup {
  /** "decision" groups are removable via the decision; "watchlist" is curated in place. */
  kind: "decision" | "watchlist";
  /** The MemberDecision id (for the remove-group / remove-vendor routes); null for the watchlist. */
  decisionId: string | null;
  /** Group heading — the decision name, or "Watchlist". */
  title: string;
  /** The decision type shown as a chip — the market-category label, or "Watched". */
  typeLabel: string;
  /** Vendor cards in original order; may be empty (honest empty group). */
  cards: ShortlistVendorCard[];
}

export interface ShortlistMonitorView {
  groups: MonitorGroup[];
  /** Distinct vendors tracked across all groups. */
  vendorCount: number;
}

type EntityLite = Pick<Entity, "id" | "slug" | "name" | "primaryRole">;
const lite = (e: Entity): EntityLite => ({ id: e.id, slug: e.slug, name: e.name, primaryRole: e.primaryRole });

/**
 * Build the whole monitor for a member. One scorecard batch over the deduped
 * union of every group's vendors; groups then reference cards by vendor id.
 */
export async function buildShortlistMonitor(
  subscriberId: string,
  now: Date = new Date(),
): Promise<ShortlistMonitorView> {
  const [decisions, watchlist] = await Promise.all([
    listMemberDecisions(subscriberId),
    getMemberWatchlist(subscriberId),
  ]);

  // Resolve each group's raw keys to real entities (skip unknown/stale keys).
  const decisionGroups = decisions.map((d) => ({
    decision: d,
    entities: d.shortlist
      .map((s) => ENTITY_BY_ID.get(s.vendorId))
      .filter((e): e is Entity => !!e),
  }));
  const watchlistEntities = watchlist.vendors
    .map((slug) => ENTITY_BY_SLUG.get(slug))
    .filter((e): e is Entity => !!e);

  // Deduped union → one scorecard computation (cross-shortlist overlap spans all).
  const unionById = new Map<string, Entity>();
  for (const g of decisionGroups) for (const e of g.entities) unionById.set(e.id, e);
  for (const e of watchlistEntities) unionById.set(e.id, e);
  const cards = await shortlistScorecards([...unionById.values()].map(lite), now);

  const groups: MonitorGroup[] = [];
  for (const g of decisionGroups) {
    groups.push({
      kind: "decision",
      decisionId: g.decision.id,
      title: g.decision.name,
      typeLabel: CATEGORY_LABEL.get(g.decision.category) ?? g.decision.category,
      cards: g.entities.map((e) => cards.get(e.id)).filter((c): c is ShortlistVendorCard => !!c),
    });
  }
  if (watchlistEntities.length > 0) {
    groups.push({
      kind: "watchlist",
      decisionId: null,
      title: "Watchlist",
      typeLabel: "Watched",
      cards: watchlistEntities.map((e) => cards.get(e.id)).filter((c): c is ShortlistVendorCard => !!c),
    });
  }

  return { groups, vendorCount: unionById.size };
}
