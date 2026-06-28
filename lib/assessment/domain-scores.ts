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
  ASSESSMENT_DOMAINS,
  type DomainScore,
  type RubricEvidenceRow,
} from "./domain-rubric";

export interface VendorScorecard {
  vendorId: string;
  domains: DomainScore[]; // all 12 framework domains, canonical order
  scoredCount: number;
  insufficientCount: number;
  hasAnyEvidence: boolean; // ≥1 analyst_verified row in any assessment domain
  totalEvidenceRows: number;
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
  };
};

function summarise(vendorId: string, domains: DomainScore[], totalEvidenceRows: number): VendorScorecard {
  const scoredCount = domains.filter((d) => d.state === "scored").length;
  return {
    vendorId,
    domains,
    scoredCount,
    insufficientCount: domains.length - scoredCount,
    hasAnyEvidence: scoredCount > 0,
    totalEvidenceRows,
  };
}

const ASSESSMENT_DOMAIN_SET = new Set<DomainId>(ASSESSMENT_DOMAINS);

interface RawEvidenceRow {
  domain: DomainId;
  evidenceGrade: RubricEvidenceRow["evidenceGrade"];
  rawScore: number;
  confidence: number | null;
  capturedAt: Date;
  sourceUrl: string | null;
}

function groupByDomain(rows: RawEvidenceRow[]): Map<DomainId, RubricEvidenceRow[]> {
  const byDomain = new Map<DomainId, RubricEvidenceRow[]>();
  for (const r of rows) {
    // Only the 12 framework domains feed the scorecard (market_position excluded).
    if (!ASSESSMENT_DOMAIN_SET.has(r.domain)) continue;
    const list = byDomain.get(r.domain) ?? [];
    list.push({
      evidenceGrade: r.evidenceGrade,
      rawScore: r.rawScore,
      confidence: r.confidence,
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
    return summarise(vendorId, domains, inScopeRows);
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

    const byVendor = new Map<string, RawEvidenceRow[]>();
    for (const r of rows) {
      const list = byVendor.get(r.vendorId) ?? [];
      list.push(r);
      byVendor.set(r.vendorId, list);
    }
    for (const [vendorId, vendorRows] of byVendor) {
      const domains = scoreAllDomains(groupByDomain(vendorRows), now);
      const inScopeRows = vendorRows.filter((r) => ASSESSMENT_DOMAIN_SET.has(r.domain)).length;
      result.set(vendorId, summarise(vendorId, domains, inScopeRows));
    }
    return result;
  } catch {
    return result;
  }
}
