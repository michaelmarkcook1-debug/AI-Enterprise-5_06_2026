import type {
  ExposureClass,
  FinancialMetric,
  IndirectExposure,
  InvestmentProviderProfile,
  IPOEvidenceQuality,
  IPOForecast,
  IPOForecastConfidence,
  IPOForecastStatus,
  IPOProfile,
  MissingIPODataChecklist,
  PostIPOFluctuationBand,
  RiskShock,
  SimulationInput,
  ValuationMetric,
} from "./types";
import { productScopeIdsForVendor } from "../investor-tools/product-scope";

export const IPO_FORECAST_WARNING =
  "This is a modelled IPO forecast, not a factual listing date or investment recommendation. Timing and price bands are based on public signals, evidence confidence, and scenario assumptions. They should be updated when an S-1/F-1, price range, float, lock-up terms, or audited financials become available.";

export const IPO_FORECAST_SOURCE_ID = "source_prompt_pack_combined_investor_tools_ipo_forecast_2026_05_08";

export const DEFAULT_SIMULATION_INPUT: SimulationInput = {
  startingCapital: 10000,
  horizonYears: 5,
  riskProfile: "balanced",
  allocationStyle: "model_guided",
  investmentUniverse: "public_and_indirect",
  region: "Global",
  includePrivateExposure: "indirect_only",
  rebalanceFrequency: "annually",
  cashReservePct: 0,
  selectedVendorIds: [],
  manualAllocations: {},
  globalRiskClimate: "elevated",
  applySignalOverlay: false,
};

export const DEFAULT_RISK_SHOCK: RiskShock = {
  valuationCompressionPct: 0,
  capexSpikePct: 0,
  cloudGrowthSlowdownPct: 0,
  regulatoryShockSeverity: 0,
  ipoLockupSelloffPct: 0,
  infrastructureShortageSeverity: 0,
  modelCommoditisationSeverity: 0,
  enterpriseAdoptionSlowdownPct: 0,
};

export const INVESTMENT_PROVIDERS: InvestmentProviderProfile[] = [
  provider("msft", "microsoft", "Microsoft", "MSFT", "public_platform", "public", "public_direct", 88, 82, 76, 90, 45, 0, "low", 100, 45, 24, 52, 42, 58, 82, "E3", "Enterprise distribution, Azure, Copilot, identity, and governance.", "Valuation and AI monetisation proof."),
  provider("googl", "google", "Alphabet", "GOOGL", "public_platform", "public", "public_direct", 86, 84, 82, 89, 50, 0, "low", 100, 42, 22, 56, 68, 62, 82, "E3", "Full-stack AI, cloud, TPU, Gemini, and search cash engine.", "Regulatory pressure and search disruption."),
  provider("amzn", "aws", "Amazon", "AMZN", "public_platform", "public", "public_direct", 84, 81, 80, 86, 52, 0, "low", 100, 48, 24, 72, 45, 72, 80, "E3", "AWS AI, Bedrock, Trainium, and cloud infrastructure.", "Capex intensity and cloud competition."),
  provider("nvda", "nvidia", "Nvidia", "NVDA", "ai_infrastructure", "public", "public_direct", 98, 78, 85, 84, 66, 0, "medium", 100, 78, 28, 82, 36, 92, 86, "E3", "AI compute infrastructure leader.", "Valuation and capex cycle sensitivity."),
  provider("orcl", "oracle", "Oracle", "ORCL", "public_platform", "public", "public_direct", 72, 72, 70, 78, 46, 0, "low", 100, 52, 22, 66, 42, 70, 72, "E2", "AI cloud, database estate, sovereign regions, and enterprise apps.", "Execution perception gap and infrastructure concentration."),
  provider("now", "servicenow", "ServiceNow", "NOW", "enterprise_workflow_ai", "public", "public_direct", 78, 76, 72, 84, 48, 0, "medium", 100, 58, 20, 38, 34, 34, 76, "E3", "Workflow AI and agent control inside IT, HR, and service operations.", "Premium valuation and platform implementation complexity."),
  provider("crm", "salesforce", "Salesforce", "CRM", "enterprise_workflow_ai", "public", "public_direct", 76, 74, 73, 80, 44, 0, "medium", 100, 50, 20, 36, 38, 32, 75, "E3", "CRM/customer AI distribution and agent packaging.", "CRM-centric scope and monetisation clarity."),
  provider("snow", "snowflake", "Snowflake", "SNOW", "data_analytics_ai", "public", "public_direct", 78, 70, 76, 75, 58, 0, "medium_high", 100, 68, 24, 42, 32, 45, 75, "E2", "Governed enterprise data layer with AI application potential.", "Competition from Databricks, cloud hyperscalers, and platform breadth."),
  provider("sap", "sap", "SAP", "SAP", "enterprise_workflow_ai", "public", "public_direct", 66, 68, 58, 78, 30, 0, "low", 100, 36, 18, 28, 36, 26, 73, "E2", "Embedded AI in ERP and governed business workflows.", "Slower perceived AI cadence."),
  provider("ibm", "ibm", "IBM", "IBM", "public_platform", "public", "public_direct", 64, 62, 55, 70, 28, 0, "low", 100, 34, 18, 30, 34, 34, 78, "E3", "Governance, hybrid AI, and regulated-enterprise credibility.", "Momentum and developer mindshare."),
  provider("asml", "asml", "ASML", "ASML", "ai_infrastructure", "public", "public_direct", 82, 73, 68, 86, 42, 0, "medium", 100, 54, 18, 74, 44, 86, 82, "E3", "Critical semiconductor equipment exposure to AI infrastructure build-out.", "Export controls and semiconductor cycle risk."),
  provider("amd", "amd", "AMD", "AMD", "ai_infrastructure", "public", "public_direct", 84, 71, 78, 78, 64, 0, "medium_high", 100, 70, 24, 78, 35, 86, 78, "E2", "AI accelerator challenger with upside if ecosystem adoption broadens.", "Competitive gap versus Nvidia and margin pressure."),
  provider("avgo", "broadcom", "Broadcom", "AVGO", "ai_infrastructure", "public", "public_direct", 82, 74, 76, 82, 52, 0, "medium", 100, 62, 20, 70, 32, 82, 78, "E2", "Custom silicon and networking exposure to AI infrastructure.", "Customer concentration and valuation sensitivity."),
  provider("arm", "arm", "Arm", "ARM", "ai_infrastructure", "public", "public_direct", 76, 66, 70, 74, 62, 0, "medium_high", 100, 72, 24, 58, 36, 76, 72, "E2", "CPU IP and edge/inference architecture exposure.", "Valuation sensitivity and indirect AI revenue conversion."),
  provider("openai", "openai", "OpenAI", null, "ipo_watch", "private", "ipo_watch", 96, 65, 92, 70, 95, 80, "high", 20, 92, 86, 95, 72, 96, 55, "E2", "Category-defining frontier AI platform.", "Extreme valuation, compute cost, and IPO structure uncertainty."),
  provider("anthropic", "anthropic", "Anthropic", null, "ipo_watch", "private", "ipo_watch", 92, 68, 88, 73, 92, 78, "high", 20, 90, 84, 94, 64, 94, 55, "E2", "Strong enterprise model and coding momentum.", "Compute dependency and extreme valuation sensitivity."),
  provider("databricks", "databricks", "Databricks", null, "ipo_watch", "private", "ipo_watch", 86, 76, 82, 84, 86, 86, "medium_high", 20, 72, 72, 48, 30, 42, 60, "E2", "Enterprise data/AI infrastructure with clearer software economics.", "IPO multiple and Snowflake/platform competition."),
  provider("cerebras", "cerebras", "Cerebras", "CBRS", "ai_infrastructure", "public", "public_direct", 82, 62, 85, 58, 88, 90, "high", 100, 82, 78, 86, 36, 90, 58, "E3", "Wafer-scale inference challenger — IPO'd on Nasdaq May 2026 (~$56B), anchored by a $20B+ OpenAI compute commitment.", "Hardware cycle, historical customer concentration, and Nvidia competition."),
  provider("harvey", "harvey", "Harvey", null, "private_inaccessible", "private", "private_inaccessible", 76, 58, 78, 62, 82, 62, "high", 5, 88, 90, 28, 62, 35, 50, "E1", "Legal AI vertical specialist with strong mindshare.", "Private access, valuation uncertainty, and vertical concentration."),
  provider("cohere", "cohere", "Cohere", null, "private_inaccessible", "private", "private_inaccessible", 72, 56, 65, 62, 74, 54, "medium_high", 5, 80, 88, 72, 48, 78, 50, "E1", "Enterprise-focused model provider with regulated-market positioning.", "Competitive pressure from frontier labs and cloud platforms."),
  provider("mistral", "mistral", "Mistral", null, "private_inaccessible", "private", "private_inaccessible", 74, 60, 72, 66, 80, 58, "medium_high", 5, 78, 88, 66, 46, 74, 52, "E1", "European sovereign/open-model AI thesis.", "Private access and hyperscaler competition."),
  provider("glean", "glean", "Glean", null, "private_inaccessible", "private", "private_inaccessible", 68, 58, 66, 64, 76, 52, "medium_high", 5, 76, 88, 26, 34, 28, 48, "E1", "Enterprise search and knowledge-assistant adoption thesis.", "Private access and crowded enterprise assistant market."),
  // Perplexity is kept in INVESTMENT_PROVIDERS so the Commercial Models
  // inventory (model-inventory repository) can still surface the vendor.
  // It is EXPLICITLY EXCLUDED from every Investor-Tools surface by being
  // absent from IPO_PROCESS_STATES, IPO_EVIDENCE_SIGNALS, IPO_FORECASTS,
  // POST_IPO_FLUCTUATION_BANDS, and the exposure-class map below — AND
  // by being listed in INVESTOR_EXCLUDED_VENDOR_IDS for any future
  // investor-surface iteration that may consume INVESTMENT_PROVIDERS.
  // Source: Stage-2 Rev2 prompt 09.
  provider("perplexity", "perplexity", "Perplexity", null, "private_inaccessible", "private", "private_inaccessible", 70, 54, 76, 56, 84, 58, "high", 5, 86, 90, 46, 58, 54, 46, "E1", "AI answer engine and enterprise-search platform. Tracked for Commercial Models inventory and vendor intelligence only — NOT included in Investor Tools.", "Platform-only vendor; investor-side IPO/valuation modelling intentionally omitted."),
  provider("xai", "xai", "xAI", null, "private_inaccessible", "private", "private_inaccessible", 76, 52, 82, 58, 88, 56, "high", 5, 90, 92, 88, 64, 94, 44, "E1", "High-beta frontier model and distribution thesis.", "Private opacity, compute intensity, and governance uncertainty."),
  provider("writer", "writer", "Writer", null, "private_inaccessible", "private", "private_inaccessible", 66, 56, 64, 62, 72, 50, "medium_high", 5, 74, 86, 32, 36, 34, 48, "E1", "Enterprise generative AI platform with verticalized workflow positioning.", "Private access and differentiation versus broad platform vendors."),
  provider("hebbia", "hebbia", "Hebbia", null, "private_inaccessible", "private", "private_inaccessible", 64, 55, 63, 60, 74, 48, "medium_high", 5, 76, 88, 28, 34, 30, 46, "E1", "High-value knowledge-work AI for financial and professional services.", "Vertical concentration and private-market valuation opacity."),
  provider("rogo", "rogo", "Rogo", null, "private_inaccessible", "private", "private_inaccessible", 62, 54, 62, 58, 72, 46, "medium_high", 5, 74, 88, 28, 32, 28, 44, "E1", "Financial-services AI analyst thesis with domain workflow specificity.", "Early scale, private access, and category competition."),
  provider("cash", "cash", "Cash reserve", null, "cash", "cash", "cash", 0, 0, 0, 0, 0, 0, "low", 100, 0, 0, 0, 0, 0, 90, "E2", "Optional reserve to moderate scenario volatility.", "Inflation and opportunity-cost drag."),
];

/** Vendor ids that are tracked for Commercial Models / Capabilities /
 * Vendor Intelligence but MUST NOT appear in any Investor-Tools surface
 * (Investment Intelligence, Investment Simulator, IPO Watch, Public AI
 * Stocks, Indirect Exposure Map, Investor Briefings, Investor Watchlist).
 * Source: Stage-2 Rev2 prompt 09. */
export const INVESTOR_EXCLUDED_VENDOR_IDS: ReadonlySet<string> = new Set([
  "perplexity",
]);

/** True iff the vendor should appear in Investor-Tools surfaces. */
export function isInvestorTracked(vendorId: string): boolean {
  return !INVESTOR_EXCLUDED_VENDOR_IDS.has(vendorId);
}

export const INDIRECT_EXPOSURES: IndirectExposure[] = [
  // MSFT → OpenAI is the marquee relationship: Microsoft 365 Copilot,
  // GitHub Copilot, and Azure OpenAI all consume GPT under the hood.
  indirect("openai", "MSFT", "M365 Copilot / GitHub Copilot / Azure OpenAI dependency", 0.85, 0.7, 0.75, 0.2),
  indirect("anthropic", "AMZN", "investment / Bedrock cloud infrastructure", 0.7, 0.65, 0.7, 0.3),
  indirect("openai", "AMZN", "Bedrock hosted model marketplace", 0.4, 0.4, 0.55, 0.45),
  indirect("anthropic", "GOOGL", "investment / Vertex / TPU exposure", 0.7, 0.65, 0.65, 0.3),
  // Llama on Bedrock — Meta is the original owner, Amazon distributes.
  indirect("meta", "AMZN", "Bedrock hosted Llama distribution", 0.55, 0.55, 0.7, 0.35),
  // Mistral on Bedrock — Mistral owner, Amazon distributes.
  indirect("mistral", "AMZN", "Bedrock hosted Mistral distribution", 0.45, 0.5, 0.65, 0.35),
  // Compute infrastructure pillar — every frontier lab depends on NVIDIA.
  indirect("openai", "NVDA", "compute infrastructure / H100/B200 dependency", 0.8, 0.78, 0.8, 0.2),
  indirect("anthropic", "NVDA", "compute infrastructure / H100/B200 dependency", 0.78, 0.75, 0.78, 0.22),
  indirect("frontier_labs", "NVDA", "compute infrastructure (cohort)", 0.75, 0.75, 0.75, 0.25),
  indirect("meta", "NVDA", "compute infrastructure / training stack", 0.7, 0.7, 0.7, 0.25),
  // Other infrastructure relationships.
  indirect("ai_infrastructure", "ORCL", "cloud / OCI data-centre infrastructure", 0.65, 0.7, 0.6, 0.3),
  indirect("mistral", "ASML", "strategic investment / European AI sovereignty", 0.35, 0.2, 0.45, 0.55),
];

export const IPO_PROFILES: IPOProfile[] = [
  ipo("openai", "R3", 80, "high", 14, 88, "wait_for_lockup_candidate", 55, "Watch for governance structure, compute obligations, and filing specificity."),
  ipo("anthropic", "R3", 78, "high", 12, 86, "wait_for_lockup_candidate", 55, "Watch for cloud dependency disclosure and revenue concentration."),
  ipo("databricks", "R4", 86, "medium_high", 16, 72, "compounder_candidate", 60, "Watch for S-1 timing, net retention, and AI product attach."),
  ipo("cerebras", "R4", 90, "high", 18, 82, "trading_ipo", 58, "Watch for customer concentration and accelerator gross margin disclosure."),
  ipo("harvey", "R2", 62, "high", 10, 82, "avoid_until_s1_clarity", 50, "Watch for revenue scale, legal-sector concentration, and profitability path."),
  ipo("cohere", "R2", 54, "medium_high", 10, 74, "avoid_until_s1_clarity", 50, "Watch for model economics and enterprise customer proof."),
  ipo("mistral", "R2", 58, "medium_high", 10, 72, "trading_ipo", 52, "Watch for sovereign-AI demand, enterprise revenue, and model-cost discipline."),
  ipo("glean", "R2", 52, "medium_high", 10, 70, "avoid_until_s1_clarity", 48, "Watch for enterprise assistant retention and expansion rates."),
  // Perplexity excluded from Investor Tools per Stage-2 Rev2 prompt 09.
  ipo("xai", "R0", 56, "high", 8, 86, "avoid_until_s1_clarity", 44, "Standalone IPO is not modelled; watch only for credible standalone filing evidence."),
  ipo("writer", "R1", 50, "medium_high", 8, 68, "avoid_until_s1_clarity", 44, "Watch for enterprise ARR scale and platform differentiation."),
  ipo("hebbia", "R0", 48, "medium_high", 7, 70, "avoid_until_s1_clarity", 42, "No reliable month-level IPO forecast available until signal quality improves."),
  ipo("rogo", "R0", 46, "medium_high", 7, 70, "avoid_until_s1_clarity", 40, "No reliable month-level IPO forecast available until signal quality improves."),
];

export const IPO_EVIDENCE_QUALITY: IPOEvidenceQuality[] = [
  ipoEvidence("cerebras", "R4_or_R5", 74, "rumoured", true, "Completed — Cerebras IPO'd on Nasdaq May 2026 (~$56B). Retained for historical reference."),
  ipoEvidence("openai", "R3_or_R4", 56, "rumoured", true, "Possible process signals are modelled only; no confirmed listing date or offer terms are seeded."),
  ipoEvidence("anthropic", "R3", 54, "rumoured", true, "Large private funding may delay IPO; no confirmed filing or offer terms are seeded."),
  ipoEvidence("databricks", "R2_or_R3", 62, "rumoured", true, "Plausible software IPO watch, but timing remains modelled without a confirmed S-1/F-1."),
  ipoEvidence("cohere", "R2", 48, "rumoured", true, "Broad-window forecast only unless higher-quality process evidence emerges."),
  ipoEvidence("harvey", "R1_or_R2", 42, "rumoured", true, "Vertical AI watch item; no confirmed IPO process."),
  ipoEvidence("glean", "R1", 38, "none", true, "Month-level precision is weak; use broad-window treatment until credible process evidence appears."),
  ipoEvidence("mistral", "R1", 40, "none", true, "Strategic funding routes may precede any IPO; production use requires current source validation."),
  // Perplexity excluded from Investor Tools per Stage-2 Rev2 prompt 09.
  ipoEvidence("writer", "R0_or_R1", 32, "none", true, "No credible near-term IPO process signal in seed model."),
  ipoEvidence("hebbia", "R0", 20, "none", false, "No reliable month-level IPO forecast available."),
  ipoEvidence("rogo", "R0", 20, "none", false, "No reliable month-level IPO forecast available."),
  ipoEvidence("xai", "R0_standalone", 45, "none", false, "xAI standalone IPO is not modelled without credible standalone filing evidence."),
];

export const IPO_FORECASTS: IPOForecast[] = [
  ipoForecast("cerebras", "2026-05", "2026-05", "2026-05", "high", "R4_or_R5", "active_process", "speculative_ai_infrastructure", "LISTED on Nasdaq May 2026 (~$56B) — now tracked as a public provider (ticker CBRS). This forecast is retained for historical reference only."),
  ipoForecast("openai", "2027-05", "2026-12", "2027-09", "medium_low", "R3_or_R4", "model_estimate_not_fact", "mega_hype_valuation_sensitive", "Possible H2 2026 filing reports are not treated as confirmed listing evidence; valuation and compute-cost risk remain high."),
  ipoForecast("anthropic", "2027-09", "2026-12", "2027-12", "medium_low", "R3", "model_estimate_not_fact", "high_quality_compute_and_valuation_risk", "Large private fundraising may delay IPO; compute dependency and valuation risk are high."),
  ipoForecast("databricks", "2027-11", "2027-05", "2028-04", "medium", "R2_or_R3", "model_estimate_not_fact", "software_compounder_candidate", "Best fundamental software IPO candidate in this seed model if valuation is disciplined."),
  ipoForecast("cohere", "2027-12", "2027-09", "2028-06", "medium_low", "R2", "model_estimate_not_fact", "enterprise_ai_valuation_dependent", "Plausible enterprise AI IPO watch; scale appears smaller than mega labs in the seed model."),
  ipoForecast("harvey", "2028-06", "2028-01", "2029-12", "low_medium", "R1_or_R2", "model_estimate_not_fact", "vertical_ai_tam_proof_needed", "Strong legal AI vertical, but no confirmed IPO process in seed data."),
  ipoForecast("glean", "2028-09", "2028-01", "2029-12", "low_medium", "R1", "model_estimate_not_fact", "enterprise_knowledge_layer_watch", "Enterprise knowledge layer watch item; platform-suite competition risk remains material."),
  ipoForecast("mistral", "2028-11", "2028-01", "2029-12", "low_medium", "R1", "model_estimate_not_fact", "sovereign_ai_strategic_bet", "Strategic sovereign-AI funding route may precede IPO."),
  // Perplexity excluded from Investor Tools per Stage-2 Rev2 prompt 09.
  ipoForecast("writer", "2029-09", "2029-01", "2030-12", "low", "R0_or_R1", "model_estimate_not_fact", "enterprise_agentic_watch", "No credible near-term IPO process signal in seed model."),
  ipoForecast("hebbia", null, null, null, "very_low", "R0", "no_reliable_month_estimate", "too_early", "Disable month-level price model until IPO signal quality improves.", "No reliable month-level IPO forecast available."),
  ipoForecast("rogo", null, null, null, "very_low", "R0", "no_reliable_month_estimate", "too_early", "Disable month-level price model until IPO signal quality improves.", "No reliable month-level IPO forecast available."),
  ipoForecast("xai", null, null, null, "medium", "R0_standalone", "not_modelled_standalone", "spacex_linked_only", "Do not model xAI standalone IPO unless credible standalone filing emerges.", "xAI standalone IPO is not modelled. Use SpaceX-linked exposure if credible SpaceX IPO route emerges."),
];

export const POST_IPO_FLUCTUATION_BANDS: PostIPOFluctuationBand[] = [
  ...bands("cerebras", "high", [[20, 85], [5, 75], [-5, 70], [-15, 65], [-25, 55], [-40, 45], [-30, 55], [-25, 65], [-20, 70], [-20, 75]]),
  ...bands("openai", "medium_low", [[25, 110], [10, 95], [-5, 80], [-15, 70], [-25, 60], [-45, 50], [-40, 60], [-35, 75], [-30, 85], [-25, 95]]),
  ...bands("anthropic", "medium_low", [[15, 85], [5, 75], [-10, 65], [-20, 55], [-30, 50], [-45, 45], [-35, 55], [-30, 65], [-25, 75], [-20, 85]]),
  ...bands("databricks", "medium", [[10, 45], [5, 45], [0, 45], [-5, 45], [-10, 40], [-20, 35], [-15, 45], [-10, 50], [-10, 55], [-5, 60]]),
  ...bands("cohere", "medium_low", [[5, 35], [-5, 35], [-10, 35], [-15, 35], [-20, 30], [-30, 25], [-25, 35], [-20, 40], [-15, 45], [-15, 50]]),
  ...bands("harvey", "low_medium", [[10, 50], [0, 45], [-10, 40], [-15, 35], [-25, 30], [-35, 25], [-30, 35], [-25, 40], [-20, 45], [-15, 50]]),
  ...bands("glean", "low_medium", [[0, 35], [-5, 35], [-10, 30], [-15, 30], [-20, 25], [-30, 20], [-25, 30], [-20, 35], [-15, 40], [-10, 45]]),
  ...bands("mistral", "low_medium", [[5, 45], [0, 40], [-10, 35], [-15, 35], [-20, 30], [-30, 25], [-25, 35], [-20, 40], [-15, 45], [-10, 50]]),
  // Perplexity excluded from Investor Tools per Stage-2 Rev2 prompt 09.
  ...bands("writer", "low", [[0, 30], [-5, 30], [-10, 30], [-15, 25], [-20, 25], [-30, 20], [-25, 30], [-20, 35], [-15, 40], [-10, 45]]),
];

export const MISSING_IPO_DATA_CHECKLISTS: MissingIPODataChecklist[] = IPO_FORECASTS.flatMap((forecast) => missingIpoDataFor(forecast));

export const FINANCIAL_METRICS: FinancialMetric[] = INVESTMENT_PROVIDERS
  .filter((provider) => provider.publicStatus === "public")
  .flatMap((provider) => [
    financial(provider.id, "AI revenue conversion", provider.aiRevenueExposureScore, "FY2026 seed", "seed_estimate", "AI Enterprise seed model", provider.evidenceConfidence),
    financial(provider.id, "Capital efficiency", provider.aiCapitalEfficiencyScore, "FY2026 seed", "seed_estimate", "AI Enterprise seed model", provider.evidenceConfidence),
    financial(provider.id, "Retail access", provider.retailAccessScore, "Current seed", "seed_estimate", "AI Enterprise seed model", provider.evidenceConfidence),
  ]);

// Real market caps in $B (analyst estimate, as of 2026-06). Replaces the old
// index-based placeholder (`120 + index*140`) that rendered NVDA "540" / MSFT
// "120" — inverted and off by 1–2 orders of magnitude. Unknown ids → undefined
// (marketCap is optional) rather than a fabricated number.
const PUBLIC_MARKET_CAP_USD_B: Record<string, number> = {
  nvda: 5000, msft: 3100, googl: 2800, amzn: 2400, avgo: 1500, orcl: 900,
  asml: 420, amd: 360, sap: 330, crm: 280, ibm: 260, now: 250, arm: 180, snow: 85,
  cerebras: 56, // Listed on Nasdaq May 2026.
};

const PUBLIC_VALUATION_METRICS: ValuationMetric[] = INVESTMENT_PROVIDERS
  .filter((provider) => provider.publicStatus === "public")
  .map((provider) => ({
    providerId: provider.id,
    marketCap: PUBLIC_MARKET_CAP_USD_B[provider.id],
    enterpriseValue: PUBLIC_MARKET_CAP_USD_B[provider.id] != null ? Math.round(PUBLIC_MARKET_CAP_USD_B[provider.id] * 1.02) : undefined,
    evRevenue: Math.max(4, Math.round(provider.valuationRiskScore / 7)),
    evGrossProfit: Math.max(6, Math.round(provider.valuationRiskScore / 5)),
    evFcf: Math.max(12, Math.round(provider.valuationRiskScore / 2.2)),
    peRatio: Math.max(14, Math.round(provider.valuationRiskScore / 1.7)),
    pegRatio: Math.round((provider.valuationRiskScore / 45) * 10) / 10,
    capexRevenue: provider.capexRiskScore,
    sbcRevenue: Math.max(2, Math.round(provider.valuationRiskScore / 12)),
    rpoGrowth: provider.shortTermCatalystScore,
    fcfMargin: provider.aiCapitalEfficiencyScore - 45,
    valuationDate: "2026-06-18",
    confidence: provider.evidenceConfidence,
  }));

// Private-lab last-known valuations ($B, analyst estimate as of 2026-06 — most
// recent primary/secondary round or tender). Fixes the marquee labs showing
// "No valuation metrics": they're private with no public market cap, but a
// dated round valuation is the honest figure to surface. Lower confidence than
// a public market cap. Cerebras kept here until the IPO reclassification lands.
const PRIVATE_VALUATION_USD_B: Record<string, number> = {
  openai: 500, anthropic: 350, xai: 250, databricks: 130, perplexity: 18,
  mistral: 14, harvey: 11, glean: 7, cohere: 7,
};

const PRIVATE_VALUATION_METRICS: ValuationMetric[] = INVESTMENT_PROVIDERS
  .filter((provider) => provider.publicStatus !== "public" && PRIVATE_VALUATION_USD_B[provider.id] != null)
  .map((provider) => ({
    providerId: provider.id,
    marketCap: PRIVATE_VALUATION_USD_B[provider.id],
    // Private rounds don't publish public-market ratios; leave them undefined
    // rather than fabricate. The valuation itself + as-of date is the signal.
    valuationDate: "2026-06-18",
    confidence: 55,
  }));

export const VALUATION_METRICS: ValuationMetric[] = [...PUBLIC_VALUATION_METRICS, ...PRIVATE_VALUATION_METRICS];

function provider(
  id: string,
  providerId: string,
  name: string,
  ticker: string | null,
  exposureType: InvestmentProviderProfile["exposureType"],
  publicStatus: InvestmentProviderProfile["publicStatus"],
  investabilityStatus: InvestmentProviderProfile["investabilityStatus"],
  aiRevenueExposureScore: number,
  investmentAttractivenessScore: number,
  shortTermCatalystScore: number,
  longTermHoldScore: number,
  speculativeUpsideScore: number,
  ipoReadinessScore: number,
  ipoPricingRisk: InvestmentProviderProfile["ipoPricingRisk"],
  retailAccessScore: number,
  valuationRiskScore: number,
  liquidityRiskScore: number,
  capexRiskScore: number,
  regulatoryRiskScore: number,
  infrastructureDependencyScore: number,
  evidenceConfidence: number,
  evidenceGrade: InvestmentProviderProfile["evidenceGrade"],
  keyThesis: string,
  mainRisk: string,
): InvestmentProviderProfile {
  const aiProviderQualityScore = Math.round(
    aiRevenueExposureScore * 0.15
    + investmentAttractivenessScore * 0.12
    + shortTermCatalystScore * 0.1
    + longTermHoldScore * 0.15
    + speculativeUpsideScore * 0.06
    + Math.max(0, 100 - valuationRiskScore) * 0.08
    + Math.max(0, 100 - infrastructureDependencyScore) * 0.08
    + evidenceConfidence * 0.16
    + Math.max(0, 100 - regulatoryRiskScore) * 0.1,
  );
  const aiCapitalEfficiencyScore = Math.max(0, Math.min(100, Math.round(
    longTermHoldScore * 0.35
    + investmentAttractivenessScore * 0.25
    + Math.max(0, 100 - capexRiskScore) * 0.25
    + Math.max(0, 100 - infrastructureDependencyScore) * 0.15,
  )));
  const hypePenalty = Math.max(0, Math.min(40, Math.round(
    valuationRiskScore * 0.22
    + speculativeUpsideScore * 0.12
    - evidenceConfidence * 0.12
    - retailAccessScore * 0.05,
  )));
  return {
    id,
    providerId,
    name,
    slug: id,
    ticker,
    exposureClass: exposureClassFor(id, exposureType),
    exposureType,
    publicStatus,
    investabilityStatus,
    aiProviderQualityScore,
    aiRevenueExposureScore,
    investmentAttractivenessScore,
    shortTermCatalystScore,
    longTermHoldScore,
    speculativeUpsideScore,
    ipoReadinessScore,
    ipoPricingRisk,
    retailAccessScore,
    valuationRiskScore,
    liquidityRiskScore,
    capexRiskScore,
    regulatoryRiskScore,
    infrastructureDependencyScore,
    aiCapitalEfficiencyScore,
    hypePenalty,
    evidenceConfidence,
    evidenceGrade,
    keyThesis,
    mainRisk,
    dataStatus: evidenceGrade === "E3" ? "tested" : evidenceGrade === "E2" ? "documented" : "seed",
    lastUpdated: "2026-05-07",
    productScopeIds: productScopeIdsForVendor(id),
  };
}

function indirect(
  privateProviderId: string,
  publicTicker: string,
  exposureType: string,
  exposureStrength: number,
  revenueLinkage: number,
  confidence: number,
  dilutionPenalty: number,
): IndirectExposure {
  return {
    privateProviderId,
    publicTicker,
    exposureType,
    exposureStrength,
    revenueLinkage,
    confidence,
    dilutionPenalty,
    indirectExposureScore: Math.max(0, Math.min(100, Math.round(100 * exposureStrength * revenueLinkage * confidence * (1 - dilutionPenalty)))),
  };
}

function ipo(
  providerId: string,
  rumourStage: IPOProfile["rumourStage"],
  readinessScore: number,
  pricingRisk: IPOProfile["pricingRisk"],
  expectedFloat: number,
  lockupRisk: number,
  postIpoForecast: IPOProfile["postIpoForecast"],
  confidence: number,
  nextWatchEvent: string,
): IPOProfile {
  const rumourScore = { R0: 0, R1: 18, R2: 42, R3: 62, R4: 78, R5: 95 }[rumourStage];
  const pricingRiskScore = { low: 25, medium: 48, medium_high: 70, high: 88 }[pricingRisk];
  return {
    providerId,
    rumourStage,
    rumourQualityScore: rumourScore,
    readinessScore,
    pricingRisk,
    pricingRiskScore,
    expectedFloat,
    lockupRisk,
    lockupExpiryDate: readinessScore >= 80 ? "TBD after listing" : undefined,
    insiderSellingAtIPO: pricingRisk === "high",
    sellingShareholdersPct: pricingRiskScore > 70 ? 18 : 8,
    useOfProceeds: "Seed placeholder: growth, infrastructure, and general corporate purposes.",
    dualClassStructure: providerId === "openai" || providerId === "xai",
    firstEarningsDate: "TBD after listing",
    underwriterSupportRisk: Math.max(20, pricingRiskScore - 15),
    postIpoForecast,
    confidence,
    nextWatchEvent,
    missingEvidence: ["Audited S-1/F-1 financials", "Final float and lock-up structure", "Revenue scale and margin disclosure"],
  };
}

function exposureClassFor(id: string, exposureType: InvestmentProviderProfile["exposureType"]): ExposureClass {
  const explicit: Record<string, ExposureClass> = {
    msft: "core_public_ai_platform",
    googl: "core_public_ai_platform",
    amzn: "core_public_ai_platform",
    nvda: "ai_infrastructure_enabler",
    orcl: "ai_infrastructure_enabler",
    now: "enterprise_workflow_ai",
    crm: "enterprise_workflow_ai",
    snow: "data_analytics_ai_layer",
    sap: "enterprise_workflow_ai",
    ibm: "defensive_enterprise_ai",
    asml: "ai_infrastructure_enabler",
    amd: "ai_infrastructure_enabler",
    avgo: "ai_infrastructure_enabler",
    arm: "ai_infrastructure_enabler",
    openai: "frontier_private_ai_lab",
    anthropic: "frontier_private_ai_lab",
    databricks: "data_analytics_ai_layer",
    cerebras: "ai_infrastructure_ipo",
    harvey: "vertical_ai_specialist",
    cohere: "frontier_private_ai_lab",
    mistral: "sovereign_ai",
    glean: "enterprise_search_work_ai",
    // perplexity intentionally absent — platform-only vendor per Stage-2 Rev2 prompt 09.
    xai: "frontier_private_ai_lab",
    writer: "vertical_ai_specialist",
    hebbia: "vertical_ai_specialist",
    rogo: "vertical_ai_specialist",
    cash: "cash",
  };
  return explicit[id] ?? (exposureType === "cash" ? "cash" : "private_inaccessible");
}

function financial(
  providerId: string,
  metricName: string,
  value: number,
  period: string,
  sourceType: string,
  sourceName: string,
  confidence: number,
): FinancialMetric {
  return {
    providerId,
    metricName,
    value,
    period,
    sourceType,
    sourceName,
    confidence,
    capturedAt: "2026-05-07T00:00:00.000Z",
  };
}

function ipoEvidence(
  providerId: string,
  rumourQuality: IPOEvidenceQuality["rumourQuality"],
  confidenceScore: number,
  filingStatus: IPOEvidenceQuality["filingStatus"],
  forecastPermitted: boolean,
  uncertaintyNote: string,
): IPOEvidenceQuality {
  return {
    providerId,
    rumourQuality,
    sourceIds: [IPO_FORECAST_SOURCE_ID],
    sourceNames: ["AI Enterprise IPO forecast seed model"],
    sourceUrls: [],
    sourceDates: ["2026-05-08"],
    evidenceGrade: "E1",
    confidenceScore,
    filingStatus,
    hasConfirmedS1: false,
    hasConfirmedPriceRange: false,
    hasConfirmedFloat: false,
    hasConfirmedLockup: false,
    hasAuditedFinancials: false,
    uncertaintyNote,
    forecastPermitted,
  };
}

function ipoForecast(
  providerId: string,
  estimatedIpoMonth: string | null,
  credibleWindowStart: string | null,
  credibleWindowEnd: string | null,
  confidence: IPOForecastConfidence,
  rumourQuality: IPOForecast["rumourQuality"],
  forecastStatus: IPOForecastStatus,
  behaviourForecast: IPOForecast["behaviourForecast"],
  notes: string,
  forecastDisabledReason?: string,
): IPOForecast {
  const disabled = Boolean(forecastDisabledReason) || estimatedIpoMonth === null;
  return {
    providerId,
    estimatedIpoMonth,
    credibleWindowStart,
    credibleWindowEnd,
    confidence,
    confidenceScore: confidenceScoreForIpo(confidence),
    rumourQuality,
    forecastStatus,
    forecastStatusLabel: forecastStatus.replace(/_/g, " "),
    behaviourForecast,
    dataStatus: disabled ? "unknown" : "estimated",
    sourceRequired: true,
    sourceIds: [IPO_FORECAST_SOURCE_ID],
    evidenceGrade: "E1",
    sourceNames: ["AI Enterprise IPO forecast seed model"],
    sourceUrls: [],
    sourceDates: ["2026-05-08"],
    relativeTo: "ipo_offer_price",
    forecastDisabledReason,
    hasVerifiedOfferPrice: false,
    warning: IPO_FORECAST_WARNING,
    notes,
    uncertaintyNotes: [
      "Modelled estimate, not a factual listing date.",
      "No verified offer price, price range, float, lock-up terms, or audited financials are included in seed data.",
      "Source refresh is required before production use.",
    ],
  };
}

function bands(
  providerId: string,
  confidence: IPOForecastConfidence,
  ranges: Array<[number, number]>,
): PostIPOFluctuationBand[] {
  return ranges.map(([lowPct, highPct], index) => ({
    providerId,
    relativeTo: "ipo_offer_price",
    monthNumber: index + 1,
    lowPct,
    highPct,
    confidence,
    dataStatus: "estimated",
    sourceIds: [IPO_FORECAST_SOURCE_ID],
    uncertaintyNote: "Modelled percentage band relative to IPO offer price. This is not a share-price prediction or guaranteed return.",
  }));
}

function missingIpoDataFor(forecast: IPOForecast): MissingIPODataChecklist[] {
  const base: Array<Pick<MissingIPODataChecklist, "missingItem" | "importance" | "blockingStatus" | "howItChangesForecast">> = [
    {
      missingItem: "S-1/F-1 filing or confirmed confidential filing",
      importance: "critical",
      blockingStatus: forecast.estimatedIpoMonth ? "lowers_confidence" : "blocks_month_forecast",
      howItChangesForecast: "Would convert broad model signal into filing-backed IPO process evidence.",
    },
    {
      missingItem: "Offer price range and share count",
      importance: "critical",
      blockingStatus: "blocks_price_bands",
      howItChangesForecast: "Would allow absolute valuation and float analysis; without it, only relative percentage bands are shown.",
    },
    {
      missingItem: "Free float and lock-up terms",
      importance: "high",
      blockingStatus: "widens_bands",
      howItChangesForecast: "Would narrow M5-M7 lock-up risk assumptions and reduce post-IPO volatility bands.",
    },
    {
      missingItem: "Audited revenue, margin, free-cash-flow path, and compute commitments",
      importance: "high",
      blockingStatus: "widens_bands",
      howItChangesForecast: "Would tighten valuation-risk assumptions and improve confidence.",
    },
    {
      missingItem: "Underwriters, use of proceeds, customer concentration, and first earnings date",
      importance: "medium",
      blockingStatus: "lowers_confidence",
      howItChangesForecast: "Would improve timing, demand, and post-listing catalyst modelling.",
    },
  ];

  return base.map((item) => ({
    providerId: forecast.providerId,
    lastCheckedAt: "2026-05-08T00:00:00.000Z",
    ...item,
  }));
}

function confidenceScoreForIpo(confidence: IPOForecastConfidence) {
  const scores: Record<IPOForecastConfidence, number> = {
    very_low: 18,
    low: 30,
    low_medium: 42,
    medium_low: 48,
    medium: 58,
    medium_high: 66,
    high: 76,
  };
  return scores[confidence];
}
