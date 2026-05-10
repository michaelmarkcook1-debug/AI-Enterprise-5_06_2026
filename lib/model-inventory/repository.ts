/**
 * Commercial Model inventory — repository helpers.
 *
 * Truthfulness gates baked in:
 *   isVerified()             — requires E3+ AND non-empty sourceIds
 *   isFirstParty()           — requires ownerVendorId === vendorId
 *   isHostedThirdParty()     — owner ≠ vendor and ownership flag agrees
 *   isActive()               — excludes deprecated / retired / unknown stages
 *   refreshRequired()        — flags entries where ownership/availability is unknown
 *
 * Counters NEVER conflate first-party with hosted third-party.
 */

import { INVESTMENT_PROVIDERS } from "../investing/seed";
import {
  INFRASTRUCTURE_ONLY_VENDOR_IDS,
  SEED_MODELS,
  SEED_MODEL_SOURCES,
} from "./seed";
import type {
  CommercialModel,
  CommercialModelSource,
  ModelInventoryDashboardSummary,
  VendorModelSummary,
} from "./types";

const STALE_AFTER_DAYS = 90;

// ────────────────── Truthfulness gates ──────────────────

export function isVerified(model: CommercialModel): boolean {
  const grade = model.evidenceGrade;
  const gradeRank: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };
  return (gradeRank[grade] ?? 0) >= 3 && model.sourceIds.length > 0;
}

export function isFirstParty(model: CommercialModel): boolean {
  return model.ownerVendorId === model.vendorId && model.ownershipType === "first_party";
}

export function isHostedThirdParty(model: CommercialModel): boolean {
  return model.ownerVendorId !== model.vendorId && model.ownershipType === "hosted_third_party";
}

export function isActive(model: CommercialModel): boolean {
  if (model.availabilityStage === "deprecated" || model.availabilityStage === "retired") return false;
  if (model.availabilityStage === "unknown") return false;
  if (model.dataStatus === "unknown") return false;
  return true;
}

export function isPreviewOrBeta(model: CommercialModel): boolean {
  return model.availabilityStage === "preview" || model.availabilityStage === "beta";
}

export function isDeprecatedOrRetired(model: CommercialModel): boolean {
  return model.availabilityStage === "deprecated" || model.availabilityStage === "retired";
}

export function refreshRequired(model: CommercialModel): boolean {
  return model.dataStatus === "unknown" || model.evidenceGrade === "E0" || model.evidenceGrade === "E1";
}

export function isStale(source: CommercialModelSource, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(source.sourceDate).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_AFTER_DAYS || source.freshnessStatus === "stale";
}

export function isStaleModel(model: CommercialModel, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(model.sourceDate).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_AFTER_DAYS || model.dataStatus === "stale";
}

// ────────────────── Public accessors ──────────────────

export function getCommercialModels(): CommercialModel[] {
  return SEED_MODELS;
}

export function getCommercialModelSources(): CommercialModelSource[] {
  return SEED_MODEL_SOURCES;
}

export function getModelsByVendor(vendorId: string): CommercialModel[] {
  return SEED_MODELS.filter((m) => m.vendorId === vendorId);
}

export function groupModelsByOwnership(models: CommercialModel[]) {
  return {
    firstParty: models.filter(isFirstParty),
    hostedThirdParty: models.filter(isHostedThirdParty),
    underlyingProductModel: models.filter((m) => m.ownershipType === "underlying_product_model"),
    openWeight: models.filter((m) => m.ownershipType === "open_weight"),
    unknown: models.filter((m) => m.ownershipType === "unknown"),
  };
}

// ────────────────── Counters ──────────────────

export function activeModelCount(models: CommercialModel[]): number {
  return models.filter(isActive).length;
}

export function hostedThirdPartyCount(models: CommercialModel[]): number {
  return models.filter(isHostedThirdParty).length;
}

export function verifiedModelCount(models: CommercialModel[]): number {
  return models.filter(isVerified).length;
}

export function staleInventoryCount(now = new Date()): number {
  return SEED_MODELS.filter((m) => isStaleModel(m, now)).length;
}

// ────────────────── Vendor summaries ──────────────────

export function getVendorModelSummary(vendorId: string, vendorName: string, now = new Date()): VendorModelSummary {
  const models = getModelsByVendor(vendorId);
  const firstPartyActive = models.filter((m) => isFirstParty(m) && isActive(m));
  const hostedActive = models.filter((m) => isHostedThirdParty(m) && isActive(m));
  const previewBeta = models.filter(isPreviewOrBeta);
  const deprecated = models.filter(isDeprecatedOrRetired);
  const refreshFlagged = models.filter(refreshRequired);

  const families = Array.from(new Set(models.map((m) => m.modelFamily).filter(Boolean)));
  const sourceCount = new Set(models.flatMap((m) => m.sourceIds)).size;

  // Confidence: average of model confidenceScore for source-backed records.
  const sourceBacked = models.filter((m) => m.sourceIds.length > 0);
  const confidenceScore =
    sourceBacked.length === 0 ? 0 :
    Math.round(sourceBacked.reduce((sum, m) => sum + m.confidenceScore, 0) / sourceBacked.length);

  // Latest verifiedAt from any model record.
  const lastVerifiedAt =
    models.map((m) => m.lastVerifiedAt).filter((d): d is string => Boolean(d)).sort().slice(-1)[0] ?? null;

  // Pick the worst-case dataStatus to report at the vendor level.
  const dataStatus =
    models.some((m) => m.dataStatus === "disputed") ? "disputed" :
    models.length === 0 ? "unknown" :
    models.every((m) => m.dataStatus === "verified") ? "verified" :
    models.some((m) => m.dataStatus === "stale" || isStaleModel(m, now)) ? "stale" :
    models.some((m) => m.dataStatus === "verified" || m.dataStatus === "documented") ? "documented" :
    models.some((m) => m.dataStatus === "seed") ? "seed" :
    "unknown";

  let uncertaintyBadge: string | null = null;
  if (refreshFlagged.length > 0 && firstPartyActive.length === 0 && hostedActive.length === 0) {
    uncertaintyBadge = "Source refresh required";
  } else if (sourceBacked.length === 0) {
    uncertaintyBadge = "No source-backed records";
  } else if (models.some((m) => isStaleModel(m, now))) {
    uncertaintyBadge = "Stale source — refresh required";
  }

  const isInfrastructureOnly = INFRASTRUCTURE_ONLY_VENDOR_IDS.includes(vendorId) && models.length === 0;

  return {
    vendorId,
    vendorName,
    firstPartyActiveCount: firstPartyActive.length,
    hostedThirdPartyCount: hostedActive.length,
    previewBetaCount: previewBeta.length,
    deprecatedRetiredCount: deprecated.length,
    primaryModelFamilies: families.slice(0, 4),
    confidenceScore,
    dataStatus,
    lastVerifiedAt,
    uncertaintyBadge,
    sourceCount,
    hasSourceBackedFirstParty: firstPartyActive.length > 0 && firstPartyActive.some((m) => m.sourceIds.length > 0),
    isInfrastructureOnly,
    refreshRequired: refreshFlagged.length > 0 && firstPartyActive.length === 0 && hostedActive.length === 0,
  };
}

export function getAllVendorSummaries(now = new Date()): VendorModelSummary[] {
  return INVESTMENT_PROVIDERS
    .filter((p) => p.id !== "cash")
    .map((p) => getVendorModelSummary(p.id, p.name, now))
    .sort((a, b) => b.firstPartyActiveCount + b.hostedThirdPartyCount - (a.firstPartyActiveCount + a.hostedThirdPartyCount));
}

export function getDashboardSummary(now = new Date()): ModelInventoryDashboardSummary {
  const summaries = getAllVendorSummaries(now);
  const allSources = SEED_MODEL_SOURCES;
  const latestSourceRefresh =
    allSources.map((s) => s.sourceDate).sort().slice(-1)[0] ?? null;
  return {
    totalTrackedVendors: summaries.length,
    vendorsWithFirstPartyModels: summaries.filter((s) => s.firstPartyActiveCount > 0).length,
    vendorsWithHostedThirdPartyModels: summaries.filter((s) => s.hostedThirdPartyCount > 0).length,
    vendorsUnknownOrUnverified: summaries.filter((s) => s.refreshRequired || s.dataStatus === "unknown").length,
    staleInventoryCount: staleInventoryCount(now),
    latestSourceRefresh,
  };
}
