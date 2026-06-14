import type { Vendor as AssessmentVendor, DeploymentPreference, IndustryArchetype, DomainId, EvidenceGrade } from "../types";
import { DOMAIN_TO_PILLAR } from "../types";
import { INTELLIGENCE_VENDORS, VENDOR_PILLAR_SCORES } from "./seed";
import type { Vendor as IntelligenceVendor } from "./types";

const INDUSTRY_MAP: Record<string, IndustryArchetype> = {
  "Financial services": "regulated_financial",
  "Healthcare": "health_life_sciences",
  "Legal": "legal_professional",
  "Public sector": "public_sector_education",
  "Technology": "enterprise_software",
  "Commercial enterprise": "commercial_enterprise",
  "Regulated enterprise": "regulated_financial",
  "Enterprise service operations": "commercial_enterprise",
  "Customer operations": "commercial_enterprise",
};

const DEPLOYMENT_MAP: Record<string, DeploymentPreference> = {
  saas: "saas",
  vpc: "vpc",
  hybrid: "hybrid",
  sovereign: "sovereign",
  on_prem: "on_prem",
};

const USE_CASE_MAP: Record<string, string> = {
  "Frontier model/API": "knowledge_assistant",
  "Enterprise assistant": "knowledge_assistant",
  "Developer/coding agent": "code_assistant",
  "Agent platform": "operations_automation",
  "RAG/enterprise search": "knowledge_assistant",
  "Workflow automation AI": "operations_automation",
  "CRM/customer AI": "customer_service_agent",
  "ITSM/HR/service AI": "operations_automation",
  "Cloud AI platform": "data_analysis",
  "Regulated-industry AI": "contract_review",
  "Legal AI": "contract_review",
  "Financial services AI": "financial_analysis",
  "Data AI": "data_analysis",
};

export function getIntelligenceAssessmentVendors(): AssessmentVendor[] {
  return INTELLIGENCE_VENDORS.map(toAssessmentVendor);
}

function toAssessmentVendor(vendor: IntelligenceVendor): AssessmentVendor {
  const pillarScores = VENDOR_PILLAR_SCORES.filter((score) => score.vendorId === vendor.id);
  const domains = Object.keys(DOMAIN_TO_PILLAR) as DomainId[];

  return {
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    hq: vendor.headquarters,
    ownership: vendor.ownershipType === "public" ? "public" : "private",
    summary: vendor.description,
    supportedDeployments: Array.from(new Set(vendor.deploymentOptions.map((option) => DEPLOYMENT_MAP[option]).filter(Boolean))),
    ecosystemFit: vendor.supportedEcosystems,
    useCaseFit: Array.from(new Set(vendor.supportedUseCases.map((useCase) => USE_CASE_MAP[useCase] ?? "knowledge_assistant"))),
    evidence: domains.map((domain, index) => {
      const pillarScore = pillarScores.find((score) => score.pillar === DOMAIN_TO_PILLAR[domain]);
      const grade = pillarScore?.evidenceGrade ?? "E2";
      const rawScore = Math.max(45, Math.min(96, (pillarScore?.capabilityScore ?? vendor.overallScore) - (index % 3) * 2));
      return {
        id: `ev_${vendor.id}_${domain}`,
        vendorId: vendor.id,
        domain,
        subfactor: `${domain.replace(/_/g, " ")} intelligence signal`,
        excerpt: `${vendor.name} ${domain.replace(/_/g, " ")} score is based on seeded AI Enterprise intelligence with ${grade} evidence status.`,
        capturedAt: vendor.lastUpdated,
        grade: grade as EvidenceGrade,
        rawScore,
      };
    }),
    risks: vendor.riskProfile.map((risk, index) => ({
      id: `risk_${vendor.id}_${index}`,
      vendorId: vendor.id,
      severity: vendor.confidenceScore < 68 ? "severe" : "moderate",
      description: risk,
      domain: index % 2 === 0 ? "vendor_maturity_lockin" : "governance_compliance",
      fatalInIndustries: vendor.confidenceScore < 65 ? ["regulated_financial", "critical_infrastructure_defence"] : undefined,
    })),
    industryAdoption: vendor.industryStrength.flatMap((strength) => {
      const industry = INDUSTRY_MAP[strength.industry];
      if (!industry) return [];
      return [{
        industry,
        productionReferenceCount: Math.max(2, Math.round(strength.score / 4)),
        deploymentDepthScore: strength.score,
        confidence: vendor.confidenceScore,
      }];
    }),
  };
}
