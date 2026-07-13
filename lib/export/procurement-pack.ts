// Procurement-pack export — data assembly (Piece C13/C-export).
// ─────────────────────────────────────────────────────────────
// PURE core (buildProcurementPackData) + a thin async wrapper that fetches real
// scorecards. This is NOT a parallel scoring engine: every number here is read
// straight from VendorScorecard/DomainScore (lib/assessment/domain-scores.ts,
// domain-rubric.ts) and computeWeightedComposite (composite.ts) — the exact same
// functions the live vendor/category pages call. The pack can never show a
// number the live page doesn't already show. HONEST BY CONSTRUCTION: an
// insufficient-evidence domain keeps state "insufficient_evidence" all the way
// through to the PDF/CSV row — there is no code path that turns it into a blank
// or a zero.

import { DOMAIN_LABEL } from "../assessment/domain-labels";
import { DOMAIN_BAND_TEXT, type DomainScore } from "../assessment/domain-rubric";
import { getVendorScorecardsBatch, type VendorScorecard } from "../assessment/domain-scores";
import {
  computeWeightedComposite,
  normalizeWeights,
  activeDomains,
  DEFAULT_DOMAIN_WEIGHTS,
  type DomainWeights,
} from "../assessment/composite";
import { buildMethodologyNote } from "../assessment/category-weights";
import type { DomainId, EvidenceGrade } from "../types";

export interface PackCitation {
  sourceUrl: string;
  evidenceGrade: EvidenceGrade;
  capturedAt: string;
}

export interface PackDomainRow {
  domain: DomainId;
  label: string;
  state: "scored" | "insufficient_evidence";
  score: number | null;
  bandText: string | null;
  confidence: number | null;
  lowConfidence: boolean;
  evidenceCount: number;
  bestGrade: EvidenceGrade | null;
  weightPct: number; // this pack's weighting, normalized %
  defaultWeightPct: number; // framework-default weighting, normalized % — for the side-by-side
  citations: PackCitation[];
  topSource: string | null; // freshest citation's URL (citations are newest-first, deduped — see domain-rubric.ts)
}

export interface PackVendorRow {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  note: string | null; // shortlist note, when this pack came from a saved decision
  composite: number;
  coverage: number; // RAW coverage 0–1 — weight-independent honesty metric
  confidence: number;
  scoredCount: number;
  domainTotal: number;
  totalEvidenceRows: number;
  domains: PackDomainRow[];
}

export type ProcurementPackKind = "decision" | "category" | "vendor";

export interface ProcurementPackData {
  kind: ProcurementPackKind;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  asOfDate: string | null; // evidence freshness date the weighting/shortlist was built against
  generatedAt: string; // ISO date — passed in, never read internally (determinism)
  weightingLabel: string;
  weightingIsDefault: boolean;
  methodologyNote: string;
  vendors: PackVendorRow[];
}

export interface PackVendorInput {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  note?: string | null;
  scorecard: VendorScorecard;
}

export interface BuildPackInput {
  kind: ProcurementPackKind;
  title: string;
  categoryId?: string | null;
  categoryName?: string | null;
  asOfDate?: string | null;
  generatedAt: string;
  weights: Partial<DomainWeights>;
  weightingLabel: string;
  vendors: PackVendorInput[];
}

function buildDomainRow(d: DomainScore, weightPct: number, defaultWeightPct: number): PackDomainRow {
  const base = { domain: d.domain, label: DOMAIN_LABEL[d.domain], weightPct, defaultWeightPct };
  if (d.state === "insufficient_evidence") {
    return {
      ...base,
      state: "insufficient_evidence",
      score: null,
      bandText: null,
      confidence: null,
      lowConfidence: false,
      evidenceCount: 0,
      bestGrade: null,
      citations: [],
      topSource: null,
    };
  }
  return {
    ...base,
    state: "scored",
    score: d.score,
    bandText: DOMAIN_BAND_TEXT[d.bandLabel],
    confidence: d.confidence,
    lowConfidence: d.lowConfidence,
    evidenceCount: d.evidenceCount,
    bestGrade: d.bestGrade,
    citations: d.citations.map((c) => ({ sourceUrl: c.sourceUrl, evidenceGrade: c.evidenceGrade, capturedAt: c.capturedAt })),
    topSource: d.citations[0]?.sourceUrl ?? null,
  };
}

/**
 * PURE. Builds the full pack from already-fetched scorecards — no DB, no LLM,
 * no Date.now()/Math.random() (generatedAt is a required input). Same weights
 * object drives every vendor's composite AND every domain's printed weight%,
 * so the PDF's "weighting used" column and its composite numbers can never
 * silently disagree with each other.
 */
export function buildProcurementPackData(input: BuildPackInput): ProcurementPackData {
  const norm = normalizeWeights(input.weights);
  const defaultNorm = normalizeWeights(DEFAULT_DOMAIN_WEIGHTS);
  const active = activeDomains(input.weights);
  const weightingIsDefault = active.every((d) => Math.abs((norm[d] ?? 0) - (defaultNorm[d] ?? 0)) < 1e-9);

  const vendors: PackVendorRow[] = input.vendors.map((v) => {
    const weighted = computeWeightedComposite(v.scorecard.domains, input.weights);
    const domains = v.scorecard.domains.map((d) =>
      buildDomainRow(d, Math.round((norm[d.domain] ?? 0) * 1000) / 10, Math.round((defaultNorm[d.domain] ?? 0) * 1000) / 10),
    );
    return {
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      vendorSlug: v.vendorSlug,
      note: v.note ?? null,
      composite: weighted.composite,
      coverage: weighted.rawCoverage,
      confidence: weighted.confidence,
      scoredCount: weighted.scoredCount,
      domainTotal: weighted.domainTotal,
      totalEvidenceRows: v.scorecard.totalEvidenceRows,
      domains,
    };
  });

  return {
    kind: input.kind,
    title: input.title,
    categoryId: input.categoryId ?? null,
    categoryName: input.categoryName ?? null,
    asOfDate: input.asOfDate ?? null,
    generatedAt: input.generatedAt,
    weightingLabel: input.weightingLabel,
    weightingIsDefault,
    methodologyNote: input.categoryId
      ? buildMethodologyNote(input.categoryId)
      : "Vendors are scored on a 0–5 scale by evidence standard — a domain only reaches 4–5 when audit-grade " +
        "(E4/E5) evidence supports it, and a domain with no reviewed evidence prints \"insufficient evidence,\" " +
        "never a guessed score. This weighting affects only the composite ranking below, never the domain scores themselves.",
    vendors,
  };
}

/**
 * Async wrapper: fetches real scorecards for the given vendors and assembles
 * the pack. Thin — all the logic lives in the pure builder above.
 */
export async function assembleProcurementPack(
  input: Omit<BuildPackInput, "vendors"> & { vendorRefs: { vendorId: string; vendorName: string; vendorSlug: string; note?: string | null }[] },
  fetchScorecards: (ids: string[]) => Promise<Map<string, VendorScorecard>> = getVendorScorecardsBatch,
): Promise<ProcurementPackData> {
  const scorecards = await fetchScorecards(input.vendorRefs.map((v) => v.vendorId));
  const vendors: PackVendorInput[] = input.vendorRefs.map((v) => ({
    ...v,
    scorecard: scorecards.get(v.vendorId) ?? {
      vendorId: v.vendorId,
      domains: [],
      scoredCount: 0,
      insufficientCount: 0,
      hasAnyEvidence: false,
      totalEvidenceRows: 0,
      modelQuality: null,
      modelQualityCoding: null,
      devSentiment: null,
      marketPosition: null,
    },
  }));
  return buildProcurementPackData({ ...input, vendors });
}

/** Safe for a Content-Disposition filename: strips anything that isn't
 *  alphanumeric/space/dash/underscore (blocks header-injection via CR/LF or
 *  quote characters in a user-supplied decision/vendor/category name), then
 *  collapses whitespace to single dashes. Never empty. */
export function safeFilename(title: string): string {
  const cleaned = title
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned || "procurement-pack";
}
