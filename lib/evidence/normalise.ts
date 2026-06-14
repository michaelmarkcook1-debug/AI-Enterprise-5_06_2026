/**
 * Connector → Evidence normalisation.
 *
 * Each connector returns its own raw payload; this helper normalises into a
 * common EvidenceSource shape so downstream code (truth engine, dashboard,
 * simulator) consumes one schema regardless of source.
 */

import type { ConnectorHealth, FetchResult } from "../connectors/types";
import { freshnessOf, type FreshnessStatus } from "./freshness";
import { confidenceFor } from "./confidence";
import type { EvidenceGrade } from "../types";

export interface NormalisedEvidenceSource {
  id: string; // synthesised from connectorId + sourceUrl
  connectorId: string;
  sourceName: string;
  sourceUrl?: string;
  sourceType: ConnectorHealth["tier"];
  capturedAt: string;
  sourceDate?: string; // when the underlying record was published, if known
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: FreshnessStatus;
  recordCount: number;
  notes?: string;
}

export function normaliseFetchResult(
  health: ConnectorHealth,
  result: FetchResult<unknown>,
  opts: { sourceDate?: string; corroborating?: number; contradicting?: number } = {},
): NormalisedEvidenceSource {
  const freshness = freshnessOf(opts.sourceDate ?? result.fetchedAt, health.tier);
  const confidence = confidenceFor({
    evidenceGrade: health.defaultEvidenceGrade,
    freshness,
    corroboratingSources: opts.corroborating,
    contradictingSources: opts.contradicting,
    baselineFloor: health.defaultConfidenceFloor,
  });
  return {
    id: `${health.id}::${result.sourceUrl ?? result.fetchedAt}`,
    connectorId: health.id,
    sourceName: health.label,
    sourceUrl: result.sourceUrl,
    sourceType: health.tier,
    capturedAt: result.fetchedAt,
    sourceDate: opts.sourceDate ?? result.fetchedAt,
    evidenceGrade: health.defaultEvidenceGrade,
    confidenceScore: confidence,
    freshnessStatus: freshness,
    recordCount: result.recordCount,
    notes: result.error,
  };
}
