import type { Claim, RenderedClaim } from "./types";

export function renderClaim(claim: Claim, now = new Date("2026-05-07T00:00:00.000Z")): RenderedClaim {
  const warnings: string[] = [];
  const stale = new Date(claim.staleAfter).getTime() < now.getTime();
  const hasConflictingSources = claim.dataStatus === "disputed";

  if (claim.evidenceGrade === "E0" && !claim.isSeedData) warnings.push("Unknown");
  if (claim.isSeedData) warnings.push("Seed estimate - not verified");
  if (stale) warnings.push("Stale data - refresh required");
  if (claim.confidenceScore < 40) warnings.push("Low confidence");
  if (hasConflictingSources) warnings.push("Conflicting sources");
  if (claim.uncertaintyNote) warnings.push(claim.uncertaintyNote);

  const value = claim.evidenceGrade === "E0" && !claim.isSeedData
    ? "Unknown"
    : claim.isSeedData
      ? "Seed estimate - not verified"
      : String(claim.value ?? claim.numericValue ?? "Unknown");

  return {
    claimId: claim.id,
    entityId: claim.entityId,
    entityType: claim.entityType,
    displayText: `${claim.claimText}: ${value}`,
    value,
    unit: claim.unit,
    dataStatus: stale ? "stale" : claim.dataStatus,
    evidenceGrade: claim.evidenceGrade,
    confidenceScore: claim.confidenceScore,
    sourceIds: claim.sourceIds,
    sourceUrls: claim.sourceUrls,
    sourceNames: claim.sourceNames,
    sourceDates: claim.sourceDates,
    capturedAt: claim.capturedAt,
    lastVerifiedAt: claim.lastVerifiedAt,
    staleAfter: claim.staleAfter,
    uncertaintyNote: claim.uncertaintyNote,
    isEstimated: claim.isEstimated,
    isSeedData: claim.isSeedData,
    isUserGenerated: claim.isUserGenerated,
    isModelGenerated: claim.isModelGenerated,
    warnings,
  };
}
