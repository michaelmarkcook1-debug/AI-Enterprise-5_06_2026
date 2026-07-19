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
import { intelVendorId } from "../intelligence/vendor-id";
import { MARKET_CATEGORIES } from "../intelligence/seed";
import { listMemberDecisions } from "../member/decisions";
import { getMemberWatchlist } from "../member/watchlist";
import { getCategoryCompositeWithMeta } from "../ranking/category-composite";
import { getScoreHistory } from "../ranking/score-history";
import {
  shortlistScorecards,
  positioningFromCategoryRank,
  applyPositioning,
  computeMomentum,
  applyMomentum,
  type ShortlistVendorCard,
} from "./scorecard";

// Widened to string keys: a decision's stored `category` is a plain string, so
// the lookup must accept one (the map's values are the human labels).
const CATEGORY_LABEL = new Map<string, string>(MARKET_CATEGORIES.map((c) => [c.id, c.name]));
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

  // Category-rank positioning overlay (follow-up 1): a decision group's vendors
  // that have NO cited market_position band (model providers) get their standing
  // in that decision's OWN category composite — the standing the buyer is actually
  // deciding on — instead of a blank "insufficient". Deduped per category; any
  // failure leaves the honest insufficient base untouched (never fabricates).
  const rankCache = new Map<string, Map<string, { rank: number; tier: string | null; total: number }>>();
  async function rankInfoFor(categoryId: string) {
    const hit = rankCache.get(categoryId);
    if (hit) return hit;
    const m = new Map<string, { rank: number; tier: string | null; total: number }>();
    try {
      const { composite } = await getCategoryCompositeWithMeta(categoryId);
      if (composite) {
        const total = composite.ranked.length;
        for (const r of composite.ranked) if (r.rank != null) m.set(r.vendorId, { rank: r.rank, tier: r.tier, total });
      }
    } catch {
      /* leave empty → the base insufficient positioning stands */
    }
    rankCache.set(categoryId, m);
    return m;
  }

  // Momentum overlay (follow-up 2): "has anything changed" from the SAME real
  // score-history the ranking hover charts already track — never a per-visitor
  // "since you last looked" (no such store exists, and the shared prod test seat
  // couldn't honor a per-user one anyway). Scoped to a decision's category, same
  // reasoning as positioning above; the Watchlist has no single category context,
  // so its vendors honestly get no momentum rather than a guessed one.
  const momentumCache = new Map<string, ReturnType<typeof computeMomentum>>();
  async function momentumFor(vendorId: string, categoryId: string) {
    const key = `${categoryId}:${vendorId}`;
    if (momentumCache.has(key)) return momentumCache.get(key) ?? null;
    let m: ReturnType<typeof computeMomentum> = null;
    try {
      m = computeMomentum(await getScoreHistory(vendorId, categoryId));
    } catch {
      /* leave null — the card stays without a momentum read, never fabricated */
    }
    momentumCache.set(key, m);
    return m;
  }

  const groups: MonitorGroup[] = [];
  for (const g of decisionGroups) {
    const catLabel = CATEGORY_LABEL.get(g.decision.category) ?? g.decision.category;
    const rankInfo = await rankInfoFor(g.decision.category);
    const groupCards: ShortlistVendorCard[] = [];
    for (const e of g.entities) {
      let card = cards.get(e.id);
      if (!card) continue;
      // Look up by both id vocabularies — the composite may key on the entity id
      // or the intel-spine id (they diverge for alibaba/moonshot/zhipu).
      const ri = rankInfo.get(e.id) ?? rankInfo.get(intelVendorId(e));
      if (card.positioning.state === "insufficient" && ri) {
        card = applyPositioning(card, positioningFromCategoryRank(ri.rank, ri.tier, ri.total, catLabel));
      }
      const momentum = await momentumFor(e.id, g.decision.category);
      if (momentum) card = applyMomentum(card, momentum);
      groupCards.push(card);
    }
    groups.push({
      kind: "decision",
      decisionId: g.decision.id,
      title: g.decision.name,
      typeLabel: catLabel,
      cards: groupCards,
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
