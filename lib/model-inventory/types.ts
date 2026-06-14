/**
 * Commercial LLM Models by Vendor — type model.
 *
 * Truth-engine compatible: every CommercialModel record carries source +
 * evidence + uncertainty metadata. The repository's truthfulness gates
 * (repository.ts) enforce:
 *   - verified status requires evidenceGrade ≥ E3 + non-empty sourceIds
 *   - first-party requires ownerVendorId === vendorId
 *   - hosted third-party never counts as first-party
 *   - deprecated/retired excluded from active counts
 *   - unknown / source-refresh-required surfaces as a distinct UI state
 */

import type { EvidenceGrade } from "../types";

export type OwnershipType =
  | "first_party"
  | "hosted_third_party"
  | "marketplace"
  | "byollm"
  | "open_weight"
  | "underlying_product_model"
  | "unknown";

export type AvailabilityStage =
  | "ga"
  | "preview"
  | "beta"
  | "deprecated"
  | "retired"
  | "unknown";

export type CommercialAvailability =
  | "commercially_available"
  | "commercially_available_preview"
  | "enterprise_only"
  | "api_available"
  | "hosted_on_marketplace"
  | "underlying_product_model"
  | "not_commercially_available"
  | "unknown";

export type ModelCategory =
  | "llm_text"
  | "multimodal"
  | "reasoning"
  | "coding"
  | "embedding"
  | "reranking"
  | "guardrail_safety"
  | "speech_audio"
  | "image_generation"
  | "video_generation"
  | "ocr_document_ai"
  | "time_series"
  | "domain_specific"
  | "unknown";

export type ModelDataStatus =
  | "verified"
  | "documented"
  | "estimated"
  | "inferred"
  | "seed"
  | "stale"
  | "unknown"
  | "disputed";

export type FreshnessStatus = "fresh" | "stale" | "unknown";

export type ModelSourceType =
  | "official_model_docs"
  | "official_api_models_endpoint"
  | "official_model_catalog"
  | "official_product_docs"
  | "official_marketplace_docs"
  | "official_pricing_page"
  | "reputable_news"
  | "seed_placeholder"
  | "unknown";

export type LifecycleStatus = "active" | "preview" | "beta" | "deprecated" | "retired" | "unknown";

export interface CommercialModel {
  id: string;
  vendorId: string;
  vendorName: string;
  ownerVendorId: string;
  ownerVendorName: string;
  hostingVendorId: string | null;
  hostingVendorName: string | null;
  modelName: string;
  modelId: string | null;
  modelFamily: string;
  modelCategory: ModelCategory;
  modality: string[];
  availabilityStage: AvailabilityStage;
  commercialAvailability: CommercialAvailability;
  ownershipType: OwnershipType;
  accessChannel: string | null;
  contextWindow: number | null;
  inputModalities: string[];
  outputModalities: string[];
  toolSupport: string[];
  pricingSummary: string | null;
  sourceIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
  sourceDate: string;
  capturedAt: string;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: ModelDataStatus;
  uncertaintyNote: string;
  lifecycleStatus: LifecycleStatus;
  deprecationDate: string | null;
  lastVerifiedAt: string | null;
}

export interface CommercialModelSource {
  id: string;
  vendorId: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: ModelSourceType;
  capturedAt: string;
  sourceDate: string;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: FreshnessStatus;
  notes: string;
}

export interface VendorModelSummary {
  vendorId: string;
  vendorName: string;
  firstPartyActiveCount: number;
  hostedThirdPartyCount: number;
  previewBetaCount: number;
  deprecatedRetiredCount: number;
  primaryModelFamilies: string[];
  confidenceScore: number;
  dataStatus: ModelDataStatus;
  lastVerifiedAt: string | null;
  uncertaintyBadge: string | null;
  sourceCount: number;
  // Distinguishes "we have records but they're seed-only" from "we have nothing".
  hasSourceBackedFirstParty: boolean;
  isInfrastructureOnly: boolean;
  refreshRequired: boolean;
}

export interface ModelInventoryDashboardSummary {
  totalTrackedVendors: number;
  vendorsWithFirstPartyModels: number;
  vendorsWithHostedThirdPartyModels: number;
  vendorsUnknownOrUnverified: number;
  staleInventoryCount: number;
  latestSourceRefresh: string | null;
}
