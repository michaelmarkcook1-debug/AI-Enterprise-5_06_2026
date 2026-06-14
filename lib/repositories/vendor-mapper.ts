import type {
  DeploymentPreference,
  DomainId,
  EvidenceGrade,
  IndustryArchetype,
  RiskSeverity,
  Vendor,
} from "../types";

type Nullable<T> = T | null;

export interface PersistedEvidenceRecord {
  id: string;
  vendorId: string;
  domain: DomainId;
  subfactor: string;
  excerpt: string;
  sourceUrl: Nullable<string>;
  capturedAt: Date | string;
  evidenceGrade: EvidenceGrade;
  rawScore: number;
  freshnessDays: Nullable<number>;
}

export interface PersistedRiskFlagRecord {
  id: string;
  vendorId: string;
  severity: RiskSeverity;
  description: string;
  domain: DomainId;
  isFatalIfTriggered: boolean;
  fatalInIndustries: IndustryArchetype[];
}

export interface PersistedVendorIndustryAdoption {
  industry: IndustryArchetype;
  productionReferenceCount: number;
  deploymentDepthScore: number;
  confidence: number;
}

export interface PersistedVendorProfile {
  id: string;
  name: string;
  category: string;
  website: Nullable<string>;
  hq: Nullable<string>;
  ownership: Vendor["ownership"];
  summary: string;
  supportedDeployments: DeploymentPreference[];
  ecosystemFit: string[];
  useCaseFit: string[];
  evidence: PersistedEvidenceRecord[];
  risks: PersistedRiskFlagRecord[];
  industryAdoption: PersistedVendorIndustryAdoption[];
}

function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function toVendor(row: PersistedVendorProfile): Vendor {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    website: row.website ?? undefined,
    hq: row.hq ?? undefined,
    ownership: row.ownership,
    summary: row.summary,
    supportedDeployments: row.supportedDeployments,
    ecosystemFit: row.ecosystemFit,
    useCaseFit: row.useCaseFit,
    evidence: row.evidence.map((evidence) => ({
      id: evidence.id,
      vendorId: evidence.vendorId,
      domain: evidence.domain,
      subfactor: evidence.subfactor,
      excerpt: evidence.excerpt,
      sourceUrl: evidence.sourceUrl ?? undefined,
      capturedAt: toIsoString(evidence.capturedAt),
      grade: evidence.evidenceGrade,
      rawScore: evidence.rawScore,
      freshnessDays: evidence.freshnessDays ?? undefined,
    })),
    risks: row.risks.map((risk) => ({
      id: risk.id,
      vendorId: risk.vendorId,
      severity: risk.severity,
      description: risk.description,
      domain: risk.domain,
      isFatalIfTriggered: risk.isFatalIfTriggered,
      fatalInIndustries: risk.fatalInIndustries,
    })),
    industryAdoption: row.industryAdoption.map((adoption) => ({
      industry: adoption.industry,
      productionReferenceCount: adoption.productionReferenceCount,
      deploymentDepthScore: adoption.deploymentDepthScore,
      confidence: adoption.confidence,
    })),
  };
}
