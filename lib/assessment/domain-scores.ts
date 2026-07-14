// Phase 3 Assessment — read evidence + apply the rubric (on-the-fly, no LLM).
// ──────────────────────────────────────────────────────────────────────────
// Reads ONLY analyst_verified EvidenceRecord rows (the honest spine — never
// seed) and runs the deterministic domain rubric. Computed at read-time on the
// already-force-dynamic surfaces: a single indexed query + pure arithmetic, no
// LLM, no per-user cost. This module never writes a stored score.

import { getPrisma, hasDatabase } from "../prisma";
import type { DomainId } from "../types";
import {
  scoreAllDomains,
  scoreDomainFromEvidence,
  ASSESSMENT_DOMAINS,
  type DomainScore,
  type RubricEvidenceRow,
} from "./domain-rubric";
import { accreditedCorrectedGrade } from "./accredited-sources";
import { ARENA_ELO_SOURCE_URL } from "../system/elo-fetch";
import { loadModelQualityDetails } from "./model-quality-score";
import type { MqBlendResult } from "../system/model-quality-blend";
import { synthesizeDevSentimentDomain } from "../dev-sentiment/ranking-signal";
import { synthesizeSiliconMarketPosition } from "./silicon-capability";

export interface VendorScorecard {
  vendorId: string;
  domains: DomainScore[]; // all 12 framework domains, canonical order
  scoredCount: number;
  insufficientCount: number;
  hasAnyEvidence: boolean; // ≥1 analyst_verified row in any assessment domain
  totalEvidenceRows: number;
  /** Category-scoped capability domain: the vendor's model quality driven by
   *  its best model's Artificial Analysis INTELLIGENCE Index (E4 →
   *  band-capped at 4.0, cited; legacy Arena-Elo pillar as per-vendor
   *  fallback). null when the vendor has neither (insufficient — never a
   *  default). NOT folded into the 12-domain `domains`/`scoredCount` above;
   *  categories that weight model_quality (e.g. frontier_model_api) merge it
   *  into the ranked domain set explicitly. */
  modelQuality: DomainScore | null;
  /** The CODING-Index-driven variant of the same domain — the score the
   *  developer_coding_agent category ranks on (a coding buyer is buying
   *  coding capability; Artificial Analysis publishes a purpose-built
   *  measure). null when the vendor has no coding-indexed model — NO legacy
   *  fallback here: the old Elo pillar has no coding measure, and a coding
   *  score must never be inferred from an overall reading. */
  modelQualityCoding: DomainScore | null;
  /** Category-scoped developer-community signal (coding models), synthesized
   *  from the cited tri-source dev-sentiment aggregate. null for non-coding
   *  vendors OR when the signal is insufficient (coverage-discounted, never
   *  faked). Merged into the ranked domain set ONLY by coding categories when
   *  DEV_SENTIMENT_IN_RANKING is on — same pattern as modelQuality. */
  devSentiment: DomainScore | null;
  /** Category-scoped hardware/infra capability signal, synthesized from the cited
   *  capacity bands (lib/assessment/silicon-capability): silicon = MLPerf +
   *  accelerator share; cloud/neocloud = infra share + AI capex + backlog + fleet.
   *  null for vendors with no cited band (or the fab). Merged into the ranked
   *  domain set as `market_position` ONLY by categories that weight it (ai_silicon,
   *  ai_cloud_compute, neocloud_inference) — same pattern as modelQuality. */
  marketPosition: DomainScore | null;
}

const EMPTY_SCORECARD = (vendorId: string, now?: Date): VendorScorecard => {
  const domains = scoreAllDomains(new Map(), now);
  return {
    vendorId,
    domains,
    scoredCount: 0,
    insufficientCount: domains.length,
    hasAnyEvidence: false,
    totalEvidenceRows: 0,
    modelQuality: null,
    modelQualityCoding: null,
    // Curated + pure — present even for a vendor with no evidence rows (a coding
    // model dark on the live scorecard can still have a developer-sentiment signal).
    devSentiment: synthesizeDevSentimentDomain(vendorId),
    marketPosition: synthesizeSiliconMarketPosition(vendorId),
  };
};

function summarise(
  vendorId: string,
  domains: DomainScore[],
  totalEvidenceRows: number,
  modelQuality: DomainScore | null,
  modelQualityCoding: DomainScore | null,
): VendorScorecard {
  const scoredCount = domains.filter((d) => d.state === "scored").length;
  return {
    vendorId,
    domains,
    scoredCount,
    insufficientCount: domains.length - scoredCount,
    hasAnyEvidence: scoredCount > 0,
    totalEvidenceRows,
    modelQuality,
    modelQualityCoding,
    devSentiment: synthesizeDevSentimentDomain(vendorId),
    marketPosition: synthesizeSiliconMarketPosition(vendorId),
  };
}

const ASSESSMENT_DOMAIN_SET = new Set<DomainId>(ASSESSMENT_DOMAINS);

export interface RawEvidenceRow {
  domain: DomainId;
  evidenceGrade: RubricEvidenceRow["evidenceGrade"];
  rawScore: number;
  confidence: number | null;
  capturedAt: Date;
  sourceUrl: string | null;
}

/** Exported for the confidence-scale regression test (lib/assessment/domain-scores.test.ts) —
 *  pure, no DB access; groups + rescales raw DB rows into the rubric's row shape. */
export function groupByDomain(rows: RawEvidenceRow[]): Map<DomainId, RubricEvidenceRow[]> {
  const byDomain = new Map<DomainId, RubricEvidenceRow[]>();
  for (const r of rows) {
    // Only the 12 framework domains feed the scorecard (market_position excluded).
    if (!ASSESSMENT_DOMAIN_SET.has(r.domain)) continue;
    const list = byDomain.get(r.domain) ?? [];
    list.push({
      // Accredited-certification grade floor (rubric-calibration correction,
      // 2026-07 audit): an ISO/SOC 2/ISO 42001/FedRAMP/CSA-STAR source IS an
      // independent audit per the rubric's own E5 definition — floor it at E4
      // rather than leaving it mis-graded E2. Symmetric across all vendors.
      evidenceGrade: accreditedCorrectedGrade(r.evidenceGrade, r.sourceUrl),
      rawScore: r.rawScore,
      // EvidenceRecord.confidence is written 0–1 (the classifier's Zod schema
      // enforces min(0).max(1) — lib/agents/evidence-classifier.ts:45) but the
      // rubric's confidence blend (domain-rubric.ts) is on a 0–100 scale, same
      // as its own null-fallback branch (EVIDENCE_MODIFIER × freshness × 100).
      // Scale here, the single read boundary, so every row lands on 0–100.
      confidence: r.confidence == null ? null : r.confidence * 100,
      capturedAt: r.capturedAt,
      sourceUrl: r.sourceUrl,
    });
    byDomain.set(r.domain, list);
  }
  return byDomain;
}

const EVIDENCE_SELECT = {
  domain: true,
  evidenceGrade: true,
  rawScore: true,
  confidence: true,
  capturedAt: true,
  sourceUrl: true,
} as const;

/**
 * Synthesize the model_quality DomainScores (both drivers) for each vendor.
 * PRIMARY: the Artificial Analysis index blends from the cited
 * ModelQualityBenchmark rows — intelligence-driven (frontier ranking, vendor
 * profile) and coding-driven (developer_coding_agent ranking), each from the
 * vendor's best model on THAT index (model-quality-score.ts).
 * FALLBACK (INTELLIGENCE driver only, per vendor with no rows yet — e.g.
 * Artificial Analysis doesn't track it): the legacy single Arena-Elo pillar
 * through the rubric, so nothing regresses before the first benchmark seed
 * runs. The coding driver has NO fallback — the Elo pillar has no coding
 * measure, and a coding score must never be inferred from an overall reading.
 * Vendors with neither are absent → model_quality stays insufficient wherever
 * active (no default, no fabrication). Never writes anything.
 */
async function fetchModelQualityScores(
  vendorIds: string[],
  now: Date,
): Promise<Map<string, { intelligence: DomainScore | null; coding: DomainScore | null }>> {
  const out = new Map<string, { intelligence: DomainScore | null; coding: DomainScore | null }>();
  if (!hasDatabase() || vendorIds.length === 0) return out;
  // 1. Primary: index blends from cited benchmark rows (one query, both drivers).
  const details = await loadModelQualityDetails(vendorIds, now);
  for (const [vendorId, d] of details) {
    out.set(vendorId, { intelligence: d.intelligence?.score ?? null, coding: d.coding?.score ?? null });
  }
  // 2. Legacy fallback for vendors with no INTELLIGENCE score yet (single Arena Elo).
  const missing = vendorIds.filter((id) => !out.get(id)?.intelligence);
  if (missing.length > 0) {
    try {
      const rows = await getPrisma().intelligencePillarScore.findMany({
        where: { vendorId: { in: missing }, pillar: "model_quality" },
        select: { vendorId: true, capabilityScore: true, evidenceGrade: true, confidence: true },
      });
      for (const r of rows) {
        const evRow: RubricEvidenceRow = {
          evidenceGrade: r.evidenceGrade,
          rawScore: r.capabilityScore,
          confidence: r.confidence,
          // Single row: freshnessFactor(now,now) cancels → no inflation.
          capturedAt: now,
          sourceUrl: ARENA_ELO_SOURCE_URL,
        };
        const cur = out.get(r.vendorId) ?? { intelligence: null, coding: null };
        cur.intelligence = scoreDomainFromEvidence("model_quality", [evRow], now);
        out.set(r.vendorId, cur);
      }
    } catch {
      // Honest absence on read failure — those vendors stay insufficient.
    }
  }
  return out;
}

/**
 * Per-index model-quality breakdown for the vendor profile (the cited "why"
 * behind the 0–5) — the intelligence-driven blend, whose contributions list
 * every present index. Empty for vendors with no benchmark rows. Read-time.
 */
export async function getModelQualityBreakdown(
  vendorIds: string[],
  now: Date = new Date(),
): Promise<Map<string, MqBlendResult>> {
  const details = await loadModelQualityDetails(vendorIds, now);
  const out = new Map<string, MqBlendResult>();
  for (const [vendorId, d] of details) {
    if (d.intelligence) out.set(vendorId, d.intelligence.blend);
  }
  return out;
}

/**
 * The 12-domain 0–5 scorecard for one vendor, from its analyst_verified
 * evidence. `vendorId` is the plain entity id (= EvidenceRecord.vendorId).
 * Returns an all-insufficient scorecard (hasAnyEvidence:false) when there is no
 * database or the read fails — so callers fall back to the honest unavailable
 * state rather than ever inventing a score.
 */
export async function getVendorScorecard(vendorId: string, now: Date = new Date()): Promise<VendorScorecard> {
  if (!hasDatabase()) return EMPTY_SCORECARD(vendorId, now);
  try {
    const rows = (await getPrisma().evidenceRecord.findMany({
      where: { vendorId, reviewStatus: "analyst_verified" },
      select: EVIDENCE_SELECT,
      orderBy: { capturedAt: "desc" },
      take: 5000,
    })) as RawEvidenceRow[];
    const domains = scoreAllDomains(groupByDomain(rows), now);
    const inScopeRows = rows.filter((r) => ASSESSMENT_DOMAIN_SET.has(r.domain)).length;
    const mq = (await fetchModelQualityScores([vendorId], now)).get(vendorId);
    return summarise(vendorId, domains, inScopeRows, mq?.intelligence ?? null, mq?.coding ?? null);
  } catch {
    return EMPTY_SCORECARD(vendorId, now);
  }
}

/**
 * Batched scorecards for a set of vendors (the category surface) — one grouped
 * query instead of N. Always returns a Map keyed by every requested vendorId
 * (all-insufficient for vendors with no evidence).
 */
export async function getVendorScorecardsBatch(
  vendorIds: string[],
  now: Date = new Date(),
): Promise<Map<string, VendorScorecard>> {
  const result = new Map<string, VendorScorecard>();
  for (const id of vendorIds) result.set(id, EMPTY_SCORECARD(id, now));
  if (!hasDatabase() || vendorIds.length === 0) return result;
  try {
    const rows = (await getPrisma().evidenceRecord.findMany({
      where: { vendorId: { in: vendorIds }, reviewStatus: "analyst_verified" },
      select: { ...EVIDENCE_SELECT, vendorId: true },
      orderBy: { capturedAt: "desc" },
      take: 20000,
    })) as (RawEvidenceRow & { vendorId: string })[];

    const mqByVendor = await fetchModelQualityScores(vendorIds, now);

    const byVendor = new Map<string, RawEvidenceRow[]>();
    for (const r of rows) {
      const list = byVendor.get(r.vendorId) ?? [];
      list.push(r);
      byVendor.set(r.vendorId, list);
    }
    for (const [vendorId, vendorRows] of byVendor) {
      const domains = scoreAllDomains(groupByDomain(vendorRows), now);
      const inScopeRows = vendorRows.filter((r) => ASSESSMENT_DOMAIN_SET.has(r.domain)).length;
      const mq = mqByVendor.get(vendorId);
      result.set(vendorId, summarise(vendorId, domains, inScopeRows, mq?.intelligence ?? null, mq?.coding ?? null));
    }
    // Vendors with a model_quality signal but NO analyst_verified evidence rows
    // are still EMPTY_SCORECARD above — attach their model_quality so a category
    // that weights it (frontier/coding) still sees the real capability signal.
    for (const [vendorId, mq] of mqByVendor) {
      if (!byVendor.has(vendorId)) {
        const base = result.get(vendorId);
        if (base) result.set(vendorId, { ...base, modelQuality: mq.intelligence, modelQualityCoding: mq.coding });
      }
    }
    return result;
  } catch {
    return result;
  }
}
