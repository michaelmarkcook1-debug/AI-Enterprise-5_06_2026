import type { EvidenceGrade, IndustryArchetype, PillarId } from "../types";

export type EvidenceStatus = "inferred" | "documented" | "tested" | "verified";

export type NewsCategory =
  | "Product launch"
  | "Enterprise control"
  | "Agentic AI"
  | "Infrastructure"
  | "Market movement"
  | "Partnership"
  | "Regulation"
  | "Pricing"
  | "Risk event"
  | "Strategy signal";

export type MarketCategoryId =
  | "frontier_model_api"
  | "enterprise_assistant"
  | "developer_coding_agent"
  | "agent_platform"
  | "rag_enterprise_search"
  | "workflow_automation_ai"
  | "crm_customer_ai"
  | "itsm_hr_service_ai"
  | "cloud_ai_platform"
  | "regulated_industry_ai";

export interface Vendor {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  headquarters?: string;
  ownershipType: string;
  supportedIndustries: string[];
  supportedUseCases: string[];
  supportedEcosystems: string[];
  deploymentOptions: string[];
  autonomyLevelMax: string;
  overallScore: number;
  confidenceScore: number;
  marketPosition: string;
  strategy: string;
  productCapabilities: string[];
  enterpriseControls: string[];
  agenticCapability: string;
  industryStrength: { industry: string; score: number; note: string }[];
  riskProfile: string[];
  analystInterpretation: string;
  lastUpdated: string;
  // Optional cross-tab enrichment (added when folding the Query-v2 entity
  // model into the repository spine). roleTags carries the multi-role
  // membership a vendor has across categories (e.g. Microsoft is platform +
  // application + investor + infrastructure). infraBand places infrastructure
  // vendors in their layer (silicon / cloud_compute / neocloud / data_platform).
  // Both optional so every existing vendor record stays valid without change.
  roleTags?: string[];
  infraBand?: string;
}

export interface VendorPillarScore {
  vendorId: string;
  pillar: PillarId;
  capabilityScore: number;
  evidenceGrade: EvidenceGrade;
  confidence: number;
  strengths: string[];
  risks: string[];
  missingEvidence: string[];
}

export interface MarketCategory {
  id: MarketCategoryId;
  name: string;
  description: string;
}

export interface MarketShareEstimate {
  vendorId: string;
  categoryId: MarketCategoryId;
  reportedShare?: number;
  estimatedShare: number;
  confidence: number;
  source: string;
  sourceDate: string;
  methodology: string;
  previousEstimate?: number;
  changePct: number;
}

export interface VendorMomentum {
  vendorId: string;
  period: string;
  momentumScore: number;
  newsVelocity: number;
  productVelocity: number;
  adoptionSignal: number;
  hiringSignal: number;
  customerSignal: number;
  partnerSignal: number;
  marketShareMovement: number;
  riskSignal: number;
  confidence: number;
}

export interface SuggestedScoreImpact {
  pillar: PillarId;
  direction: "up" | "down" | "watch";
  magnitude: number;
  rationale: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl?: string;
  sourceKind?: "seed" | "real";
  sourceNote?: string;
  publishedAt: string;
  vendors: string[];
  categories: NewsCategory[];
  impactScore: number;
  confidenceScore: number;
  affectedPillars: PillarId[];
  whyItMatters: string;
  suggestedScoreImpact: SuggestedScoreImpact[];
  relatedVendors: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
}

export interface Capability {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface VendorCapability {
  vendorId: string;
  capabilityId: string;
  status: EvidenceStatus;
  maturityScore: number;
  evidenceGrade: EvidenceGrade;
  lastVerified: string;
  notes: string;

  // ─── Phase 5 audit-grade extensions ───
  // All optional so legacy seed records remain valid. The render guard
  // (`capabilityRenderState` in lib/intelligence/capabilities-truthfulness.ts)
  // treats absence of these fields as seed/inferred and labels accordingly.
  productScopeIds?: string[];
  confidenceScore?: number;       // 0-100
  dataStatus?: "verified" | "documented" | "estimated" | "inferred" | "seed" | "stale" | "disputed" | "unknown" | "unsupported";
  freshnessStatus?: "fresh" | "stale" | "unknown";
  sourceIds?: string[];
  sourceUrls?: string[];
  sourceNames?: string[];
  sourceDate?: string;
  uncertaintyNote?: string;
  truthRecordIds?: string[];
  formulaVersion?: string;
  calculationTrace?: string;
  isSeedScore?: boolean;
  isCalculated?: boolean;
  isVerified?: boolean;
}

export interface AssessmentRun {
  id: string;
  userInputs: unknown;
  result: unknown;
  createdAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  vendors: string[];
  categories: string[];
  industries: string[];
  alertRules: {
    riskThreshold?: number;
    momentumChangePct?: number;
    categories?: NewsCategory[];
  };
  createdAt: string;
}

export interface EvidenceSource {
  id: string;
  entityType: "vendor" | "news" | "market_share" | "capability" | "momentum";
  entityId: string;
  sourceType: EvidenceStatus | "analyst_estimate" | "proxy_signal";
  sourceName: string;
  sourceUrl?: string;
  capturedAt: string;
  evidenceGrade: EvidenceGrade;
  confidence: number;
  notes: string;
}

export interface MarketDashboard {
  generatedAt: string;
  topVendors: Vendor[];
  winningVendors: { vendor: Vendor; reason: string; confidence: number }[];
  losingVendors: { vendor: Vendor; reason: string; confidence: number }[];
  weeklyMovers: { vendor: Vendor; changePct: number; reason: string; confidence: number }[];
  majorNews: NewsItem[];
  categoryShare: {
    category: MarketCategory;
    leaders: { vendor: Vendor; estimate: MarketShareEstimate }[];
  }[];
  agenticMomentum: { vendor: Vendor; momentum: VendorMomentum }[];
  riskAlerts: { vendor: Vendor; alert: string; severity: "high" | "medium" | "watch"; confidence: number }[];
  sectorLeaders: { industry: string; vendors: { vendor: Vendor; score: number }[] }[];
}

export interface RankInput {
  industry?: IndustryArchetype;
  useCase?: string;
  categoryId?: MarketCategoryId;
  riskTolerance?: 1 | 2 | 3 | 4 | 5;
  vendorIds?: string[];
}
