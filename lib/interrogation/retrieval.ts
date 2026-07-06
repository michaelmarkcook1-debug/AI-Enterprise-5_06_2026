// AIE-05 — Deterministic evidence retrieval (NO LLM).
// ─────────────────────────────────────────────────────────────────────────────
// The evidence-first core: given the questioner's intent profile, assemble the
// cited evidence the synthesizer is allowed to speak to — and NOTHING else. This
// is plain code, not a model call, so WHAT evidence the synthesizer sees is
// decided deterministically here, which is what makes fabrication structurally
// impossible downstream (the reasoning model can only cite URLs on this bundle).
//
// Three layers, each item carrying its real citation:
//   • model       — the live LMArena frontier comparison (AIE-01)
//   • peer_public — the cited public-disclosure benchmark layer (segment-
//                   benchmarks + named disclosed adopters)
//   • peer_pool   — the PRIVATE anonymised contribution pool (AIE-07). Returns
//                   empty today; the slot exists so the synthesizer already
//                   knows how to show BOTH layers when the pool lands.
//
// The pure assembler (assembleEvidenceBundle) takes already-fetched inputs so it
// unit-tests without a DB or the model-inventory reader.

import {
  getFrontierComparison,
  COMPARE_CATEGORIES,
  type FrontierComparison,
} from "../model-inventory/frontier";
import { composeBenchmark, type ComposedBenchmark } from "../peer/segment-benchmarks";
import { exemplarsForSegment } from "../peer/segments";
import type { PeerCompany } from "../peer/types";
import {
  intentSegment,
  type IntentProfile,
  type EvidenceBundle,
  type EvidenceItem,
  type CoverageFlags,
} from "./types";

const LMARENA_FALLBACK_URL = "https://lmarena.ai/leaderboard";

/** Model-layer evidence from the frontier comparison: overall standings + a
 *  per-category leader line for each category with cited ratings. */
function modelEvidence(frontier: FrontierComparison): EvidenceItem[] {
  const present = frontier.columns.filter((c) => c.present);
  if (present.length === 0) return [];
  const url = frontier.sourceUrl ?? present.find((c) => c.sourceUrl)?.sourceUrl ?? LMARENA_FALLBACK_URL;
  const asOf = frontier.asOf ?? undefined;
  const items: EvidenceItem[] = [];

  const ranked = present
    .filter((c) => typeof c.overall === "number")
    .sort((a, b) => (a.overallRank ?? 99) - (b.overallRank ?? 99));
  if (ranked.length > 0) {
    const standings = ranked
      .map((c) => `${c.vendorName} ${c.modelName} ${Math.round(c.overall as number)}`)
      .join("; ");
    items.push({
      layer: "model",
      scopeLabel: "LMArena — overall",
      headline: `Overall frontier standings (LMArena Elo): ${standings}.`,
      detail: "Each vendor's single highest-overall-Elo model; independent crowd benchmark.",
      sourceUrl: url,
      sourcePublisher: "LMArena",
      sourceDate: asOf,
    });
  }

  for (const cat of COMPARE_CATEGORIES) {
    if (cat.key === "overall") continue;
    const leaderId = frontier.categoryLeaders[cat.key];
    if (!leaderId) continue;
    const leader = present.find((c) => c.vendorId === leaderId);
    const value = leader?.ratings[cat.key];
    if (!leader || typeof value !== "number") continue;
    // Rivals with a cited rating in the same category, for honest contrast.
    const rivals = present
      .filter((c) => c.vendorId !== leaderId && typeof c.ratings[cat.key] === "number")
      .map((c) => `${c.vendorName} ${Math.round(c.ratings[cat.key] as number)}`)
      .join(", ");
    items.push({
      layer: "model",
      scopeLabel: `LMArena — ${cat.label}`,
      headline: `${cat.label}: ${leader.vendorName}'s ${leader.modelName} leads at ${Math.round(value)} Elo${rivals ? ` (vs ${rivals})` : ""}.`,
      sourceUrl: leader.sourceUrl ?? url,
      sourcePublisher: "LMArena",
      sourceDate: leader.publishDate ?? asOf,
    });
  }
  return items;
}

/** Public peer-layer evidence from the composed benchmark (exact + adjacent
 *  layers), each stat kept with its real citation and honest fit note. */
function peerPublicEvidence(composed: ComposedBenchmark): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const layer of composed.layers) {
    for (const stat of layer.stats) {
      items.push({
        layer: "peer_public",
        scopeLabel: layer.scopeLabel,
        headline: stat.headline,
        detail: stat.detail,
        fitNote: stat.segmentFitNote,
        sourceUrl: stat.source.url,
        sourcePublisher: stat.source.publisher,
        sourceDate: stat.source.surveyDate,
      });
    }
  }
  return items;
}

/** Named, publicly-disclosed adopters in the segment — only those whose
 *  platform-integration signal carries a real cited URL (never an unbacked
 *  name). Capped so the bundle stays bounded for the ~180-word synthesis. */
function namedAdopterEvidence(exemplars: PeerCompany[], cap = 4): { items: EvidenceItem[]; disclosed: number } {
  const items: EvidenceItem[] = [];
  let disclosed = 0;
  for (const co of exemplars) {
    const sig = co.signals.find((s) => s.kind === "platform_integration" && (s.citations?.length ?? 0) > 0);
    if (!sig || !sig.summary) continue;
    disclosed++;
    if (items.length >= cap) continue;
    const cite = sig.citations!.find((c) => /^https?:\/\//.test(c.url));
    if (!cite) continue;
    items.push({
      layer: "peer_public",
      scopeLabel: "Named disclosed adopter",
      headline: `${co.name}: ${sig.summary}`,
      sourceUrl: cite.url,
      sourcePublisher: cite.publisher,
    });
  }
  return { items, disclosed };
}

/** Pure assembler — no DB, no LLM. Given the model comparison, the composed peer
 *  benchmark, the segment's named exemplars, and any private-pool items (empty
 *  until AIE-07), build the bundle + honest coverage flags. Unit-tested here. */
export function assembleEvidenceBundle(
  intent: IntentProfile,
  frontier: FrontierComparison,
  composed: ComposedBenchmark,
  exemplars: PeerCompany[],
  poolItems: EvidenceItem[] = [],
): EvidenceBundle {
  const model = modelEvidence(frontier);
  const peerPublic = peerPublicEvidence(composed);
  const named = namedAdopterEvidence(exemplars);

  const items = [...model, ...peerPublic, ...named.items, ...poolItems];

  const coverage: CoverageFlags = {
    exactSegmentMatch: composed.exact !== null,
    nearestPeerScope: composed.layers[0]?.scopeLabel ?? null,
    disclosedAdopters: named.disclosed,
    poolContributors: poolItems.length > 0 ? new Set(poolItems.map((i) => i.sourceUrl)).size : 0,
    hasModelData: model.length > 0,
  };

  return { intent, items, coverage };
}

/** Private anonymised contribution pool (AIE-07). Not built yet → always empty.
 *  When AIE-06/07 land, this returns cited, k-anonymity-floored pool items and
 *  NOTHING else about the interrogation flow changes. */
async function retrievePoolEvidence(_intent: IntentProfile): Promise<EvidenceItem[]> {
  return [];
}

/** Async wrapper: fetch the live model comparison + compose the peer benchmark
 *  for the intent's segment, then assemble. The one place retrieval touches the
 *  live data readers. */
export async function buildEvidenceBundle(intent: IntentProfile): Promise<EvidenceBundle> {
  const segment = intentSegment(intent);
  const [frontier, poolItems] = await Promise.all([
    getFrontierComparison(),
    retrievePoolEvidence(intent),
  ]);
  const composed = composeBenchmark(segment);
  const exemplars = exemplarsForSegment(segment);
  return assembleEvidenceBundle(intent, frontier, composed, exemplars, poolItems);
}
