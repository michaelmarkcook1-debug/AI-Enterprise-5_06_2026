import type { EvidenceSourceRecord, Claim, TruthRecord } from "./types";

export const PROMPT_PACK_EVIDENCE_SOURCE: EvidenceSourceRecord = {
  id: "source_prompt_pack_zero_hallucination_2026_05_07",
  entityType: "platform_scope",
  entityId: "ai_enterprise_investor_tools",
  sourceType: "user_supplied_prompt_pack",
  sourceName: "AI Enterpise zero-hallucination investor tools prompt pack",
  sourceDate: "2026-05-07",
  capturedAt: "2026-05-07T00:00:00.000Z",
  publisher: "Product owner supplied seed pack",
  isOfficialSource: false,
  isPrimarySource: false,
  isLicensedSource: false,
  evidenceGrade: "E1",
  confidenceScore: 30,
  freshnessStatus: "unknown",
  notes: "Controls seed inventory and guardrails. It is not external verification of product availability or financial metrics.",
};

export const COMBINED_IPO_FORECAST_PROMPT_PACK_SOURCE: EvidenceSourceRecord = {
  id: "source_prompt_pack_combined_investor_tools_ipo_forecast_2026_05_08",
  entityType: "investor_tools_ipo_forecast",
  entityId: "ipo_forecast_seed_model",
  sourceType: "user_supplied_prompt_pack",
  sourceName: "AI Enterpise combined investor tools truth engine IPO forecast prompt pack",
  sourceDate: "2026-05-08",
  capturedAt: "2026-05-08T00:00:00.000Z",
  publisher: "Product owner supplied seed pack",
  isOfficialSource: false,
  isPrimarySource: false,
  isLicensedSource: false,
  evidenceGrade: "E1",
  confidenceScore: 30,
  freshnessStatus: "unknown",
  notes: "Controls modelled seed forecast structure. It is not a verified filing, offer price, listing date, or investment recommendation.",
};

export const EVIDENCE_SOURCES: EvidenceSourceRecord[] = [
  PROMPT_PACK_EVIDENCE_SOURCE,
  COMBINED_IPO_FORECAST_PROMPT_PACK_SOURCE,
];

export const CLAIMS: Claim[] = [
  claim({
    id: "claim_investor_tools_not_financial_advice",
    entityType: "module",
    entityId: "investor_tools",
    claimType: "disclaimer",
    claimText: "Investor Tools are for market intelligence and hypothetical scenario modelling only. They are not financial advice.",
    value: "Not financial advice",
    evidenceGrade: "E1",
    confidenceScore: 100,
    dataStatus: "documented",
    uncertaintyNote: "Required platform copy supplied by product owner.",
  }),
  claim({
    id: "claim_product_scope_seed_inventory",
    entityType: "product_scope",
    entityId: "all_seed_inventory",
    claimType: "inventory_status",
    claimText: "Product inventory entries are seed scope records until refreshed against official or licensed sources.",
    value: "Seed estimate - not verified",
    evidenceGrade: "E1",
    confidenceScore: 30,
    dataStatus: "seed",
    uncertaintyNote: "The prompt pack explicitly says the inventory is not guaranteed exhaustive and must carry uncertainty labels.",
    isSeedData: true,
    isEstimated: true,
  }),
  claim({
    id: "claim_ipo_forecast_modelled_not_fact",
    entityType: "investor_tools_ipo_forecast",
    entityId: "all_ipo_forecasts",
    claimType: "disclaimer",
    claimText: "IPO forecast windows and post-IPO bands are modelled estimates, not factual listing dates, offer prices, share-price predictions, or investment recommendations.",
    value: "Modelled estimate - not fact",
    evidenceGrade: "E1",
    confidenceScore: 100,
    dataStatus: "documented",
    uncertaintyNote: "Required platform copy supplied by product owner.",
    sourceIds: [COMBINED_IPO_FORECAST_PROMPT_PACK_SOURCE.id],
    sourceNames: [COMBINED_IPO_FORECAST_PROMPT_PACK_SOURCE.sourceName],
    sourceDates: [COMBINED_IPO_FORECAST_PROMPT_PACK_SOURCE.sourceDate],
  }),
];

export function listEvidenceSources() {
  return EVIDENCE_SOURCES;
}

export function listClaims() {
  return CLAIMS;
}

export function listTruthRecords(): TruthRecord[] {
  return CLAIMS.map((item) => ({
    id: `truth_${item.id}`,
    entityType: item.entityType,
    entityId: item.entityId,
    claim: item.claimText,
    value: item.value ?? item.numericValue ?? null,
    sourceType: item.isSeedData ? "seed_data" : "user_supplied_prompt_pack",
    sourceName: item.sourceNames[0] ?? "Unknown",
    sourceUrl: item.sourceUrls[0],
    sourceDate: item.sourceDates[0],
    capturedAt: item.capturedAt,
    lastVerified: item.lastVerifiedAt,
    evidenceGrade: item.evidenceGrade,
    confidenceScore: item.confidenceScore,
    freshnessStatus: new Date(item.staleAfter).getTime() < new Date("2026-05-08T00:00:00.000Z").getTime() ? "stale" : "fresh",
    dataStatus: item.dataStatus,
    uncertaintyNotes: [item.uncertaintyNote].filter(Boolean),
    validationRequired: item.evidenceGrade === "E0" || item.isSeedData || item.confidenceScore < 60,
    blockingStatus: item.evidenceGrade === "E0" && !item.isSeedData ? "blocked" : item.isSeedData ? "warning" : "none",
  }));
}

export function validateClaimSupport(claim: Claim) {
  const sourceIds = new Set(EVIDENCE_SOURCES.map((source) => source.id));
  const missingSources = claim.sourceIds.filter((sourceId) => !sourceIds.has(sourceId));
  const missingModelTrace = claim.isModelGenerated && (!claim.sourceClaimIds || claim.sourceClaimIds.length === 0);
  return {
    isValid: missingSources.length === 0 && (claim.evidenceGrade !== "E0" || claim.isSeedData) && !missingModelTrace,
    missingSources,
    warnings: [
      ...(claim.evidenceGrade === "E0" && !claim.isSeedData ? ["Claim has no evidence and cannot be rendered as verified."] : []),
      ...(missingModelTrace ? ["Model-generated claim is missing source claim traceability."] : []),
    ],
  };
}

function claim(input: Partial<Claim> & Pick<Claim, "id" | "entityType" | "entityId" | "claimType" | "claimText" | "evidenceGrade" | "confidenceScore" | "dataStatus" | "uncertaintyNote">): Claim {
  const now = "2026-05-07T00:00:00.000Z";
  return {
    numericValue: undefined,
    value: input.value ?? input.claimText,
    unit: input.unit,
    period: input.period,
    geography: input.geography,
    sourceIds: input.sourceIds ?? [PROMPT_PACK_EVIDENCE_SOURCE.id],
    sourceUrls: input.sourceUrls ?? [],
    sourceNames: input.sourceNames ?? [PROMPT_PACK_EVIDENCE_SOURCE.sourceName],
    sourceDates: input.sourceDates ?? [PROMPT_PACK_EVIDENCE_SOURCE.sourceDate],
    createdAt: now,
    updatedAt: now,
    capturedAt: now,
    lastVerifiedAt: "1970-01-01T00:00:00.000Z",
    staleAfter: "2026-06-06T00:00:00.000Z",
    expiryDate: "2026-06-06T00:00:00.000Z",
    isEstimated: input.isEstimated ?? false,
    isSeedData: input.isSeedData ?? false,
    isUserGenerated: input.isUserGenerated ?? false,
    isModelGenerated: input.isModelGenerated ?? false,
    ...input,
  };
}
