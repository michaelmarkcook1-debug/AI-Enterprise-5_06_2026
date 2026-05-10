import type { EvidenceGrade } from "../types";
import type { FreshnessStatus, TruthDataStatus } from "../investing/types";

export interface TruthRecord {
  id: string;
  entityType: string;
  entityId: string;
  claim: string;
  value: string | number | boolean | null;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  capturedAt: string;
  lastVerified: string;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: FreshnessStatus;
  dataStatus: TruthDataStatus;
  uncertaintyNotes: string[];
  validationRequired: boolean;
  blockingStatus: "none" | "warning" | "blocked";
}

export interface EvidenceSourceRecord {
  id: string;
  entityType: string;
  entityId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate: string;
  capturedAt: string;
  publisher: string;
  isOfficialSource: boolean;
  isPrimarySource: boolean;
  isLicensedSource: boolean;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: "fresh" | "stale" | "unknown";
  notes: string;
}

export interface Claim {
  id: string;
  entityType: string;
  entityId: string;
  claimType: string;
  claimText: string;
  numericValue?: number;
  value?: string | number | boolean | null;
  unit?: string;
  period?: string;
  geography?: string;
  sourceIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
  sourceDates: string[];
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: TruthDataStatus;
  uncertaintyNote: string;
  createdAt: string;
  updatedAt: string;
  capturedAt: string;
  lastVerifiedAt: string;
  staleAfter: string;
  expiryDate: string;
  isEstimated: boolean;
  isSeedData: boolean;
  isUserGenerated: boolean;
  isModelGenerated: boolean;
  sourceClaimIds?: string[];
  reasoningSummary?: string;
}

export interface RenderedClaim {
  claimId: string;
  entityId: string;
  entityType: string;
  displayText: string;
  value: string;
  unit?: string;
  dataStatus: TruthDataStatus;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  sourceIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
  sourceDates: string[];
  capturedAt: string;
  lastVerifiedAt: string;
  staleAfter: string;
  uncertaintyNote: string;
  isEstimated: boolean;
  isSeedData: boolean;
  isUserGenerated: boolean;
  isModelGenerated: boolean;
  warnings: string[];
}
