// The Monitor view — "your shortlist, watched" (Phase 2 Wave 2).
// ───────────────────────────────────────────────────────────────
// Composes "what changed for YOU" ENTIRELY from the existing cached market data,
// filtered to the member's saved vendors/categories. NO per-user LLM, NO polling
// — just cached/DB reads + the pure static graph. Every item carries the same
// provenance + confidence labels as the public surface, and links back to it.

import {
  listMarketShareEstimates,
  listMarketCategories,
  listIntelligenceVendors,
  getBreakingNews,
} from "../intelligence/repository";
import { projectExposureToDependencyEdges } from "../graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId, NODE_TO_SLUG } from "../graph/encroachment";
import type { MemberWatchlistView } from "./watchlist";

// changePct is a RELATIVE percentage change ((cur-prev)/prev*100), matching the
// public surface — so this is ≥1% relative change in the estimate, not points.
const MOVE_THRESHOLD_PCT = 1;

export type Tier = "high" | "medium" | "seed";
function tierOf(confidence: number): Tier {
  return confidence >= 80 ? "high" : confidence >= 45 ? "medium" : "seed";
}

export interface RankingMove {
  vendorSlug: string;
  vendorName: string;
  categoryId: string;
  categoryName: string;
  estimatedShare: number;
  changePct: number;
  confidence: number;
}
export interface GraphAlert {
  kind: "encroachment" | "dependency";
  text: string;
  tier: Tier;
}
export interface MonitorNews {
  title: string;
  sourceName: string;
  sourceUrl?: string;
  vendorName: string | null;
  publishedAt: string;
}
export interface MonitorView {
  hasItems: boolean;
  hasSignal: boolean;
  savedVendors: { slug: string; name: string }[];
  savedCategories: { id: string; name: string }[];
  rankingMoves: RankingMove[];
  graphAlerts: GraphAlert[];
  news: MonitorNews[];
}

export async function buildMonitor(watchlist: MemberWatchlistView): Promise<MonitorView> {
  const vendorSet = new Set(watchlist.vendors);
  const categorySet = new Set(watchlist.categories);
  const hasItems = vendorSet.size > 0 || categorySet.size > 0;

  const [estimates, categories, vendors, breaking] = await Promise.all([
    listMarketShareEstimates().catch(() => []),
    listMarketCategories().catch(() => []),
    listIntelligenceVendors().catch(() => []),
    getBreakingNews({ days: 30, limit: 40 }).catch(() => null),
  ]);

  const nameBySlug = new Map(vendors.map((v) => [v.slug, v.name]));
  const nameById = new Map(vendors.map((v) => [v.id, v.name]));
  const slugById = new Map(vendors.map((v) => [v.id, v.slug])); // estimates are keyed by id; links need the slug
  const catName = new Map(categories.map((c) => [c.id as string, c.name]));
  const vName = (idOrSlug: string) => nameById.get(idOrSlug) ?? nameBySlug.get(idOrSlug) ?? idOrSlug;

  const savedVendors = [...vendorSet]
    .map((slug) => ({ slug, name: nameBySlug.get(slug) ?? slug }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const savedCategories = [...categorySet]
    .map((id) => ({ id, name: catName.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Ranking moves: estimates touching a saved vendor OR saved category, with
  //    a material move. Directional estimates (labelled in the UI). ──
  const rankingMoves: RankingMove[] = estimates
    .filter((e) => Math.abs(e.changePct ?? 0) >= MOVE_THRESHOLD_PCT)
    .filter((e) => vendorSet.has(e.vendorId) || categorySet.has(e.categoryId))
    .map((e) => ({
      vendorSlug: slugById.get(e.vendorId) ?? e.vendorId, // canonical slug for the link (id may diverge)
      vendorName: vName(e.vendorId),
      categoryId: e.categoryId,
      categoryName: catName.get(e.categoryId) ?? e.categoryId,
      estimatedShare: e.estimatedShare,
      changePct: e.changePct ?? 0,
      confidence: e.confidence,
    }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 20);

  // ── Graph alerts: dependency + encroachment edges touching a saved vendor.
  //    Use each edge's own curated rationale (no direction guesswork). ──
  const slugToNode = new Map<string, string>();
  for (const [nodeId, slug] of Object.entries(NODE_TO_SLUG)) {
    if (!slugToNode.has(slug)) slugToNode.set(slug, nodeId);
  }
  const savedNodeIds = new Set(
    [...vendorSet].map((s) => slugToNode.get(s)).filter((x): x is string => !!x),
  );
  const allEdges = projectExposureToDependencyEdges();
  const encroach = deriveEncroachmentEdges(allEdges, buildRolesByNodeId());
  const seen = new Set<string>();
  const graphAlerts: GraphAlert[] = [];
  const pushAlert = (kind: GraphAlert["kind"], text: string, confidence: number) => {
    if (seen.has(text)) return;
    seen.add(text);
    graphAlerts.push({ kind, text, tier: tierOf(confidence) });
  };
  for (const e of encroach) {
    if (savedNodeIds.has(e.fromVendorId) || savedNodeIds.has(e.toVendorId)) {
      pushAlert("encroachment", e.rationale, e.confidence);
    }
  }
  for (const e of allEdges) {
    if (e.direction !== "depends_on") continue;
    if (savedNodeIds.has(e.fromVendorId) || savedNodeIds.has(e.toVendorId)) {
      pushAlert("dependency", e.rationale, e.confidence);
    }
  }
  const trimmedAlerts = graphAlerts.slice(0, 12);

  // ── News: real-gated breaking items mentioning a saved vendor. ──
  const news: MonitorNews[] = (breaking?.items ?? [])
    .filter(
      (n) =>
        (n.primaryVendorId && vendorSet.has(n.primaryVendorId)) ||
        // n.vendors may carry vendor_-prefixed tokens; vendorSet holds bare slugs.
        (n.vendors ?? []).some((v) => vendorSet.has(v.replace(/^vendor_/, ""))),
    )
    .slice(0, 12)
    .map((n) => ({
      title: n.title,
      sourceName: n.sourceName,
      sourceUrl: n.sourceUrl,
      vendorName: n.primaryVendorName ?? null,
      publishedAt: n.publishedAt,
    }));

  const hasSignal = rankingMoves.length > 0 || trimmedAlerts.length > 0 || news.length > 0;

  return {
    hasItems,
    hasSignal,
    savedVendors,
    savedCategories,
    rankingMoves,
    graphAlerts: trimmedAlerts,
    news,
  };
}
