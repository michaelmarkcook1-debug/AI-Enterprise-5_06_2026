export interface UseCase {
  id: string;
  label: string;
  riskTier: "low" | "medium" | "high" | "critical";
  reliabilityRequirement: number; // 1-5
  autonomyDefault: "advisory_only" | "human_in_loop" | "supervised_agent";
  category: string;
}

export const USE_CASES: UseCase[] = [
  { id: "knowledge_assistant", label: "Knowledge Assistant / Internal Search", riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only", category: "Productivity" },
  { id: "customer_service_agent", label: "Customer Service Agent", riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent", category: "Customer" },
  { id: "code_assistant", label: "Code Assistant / Developer Productivity", riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop", category: "Engineering" },
  { id: "contract_review", label: "Contract & Document Review", riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop", category: "Legal" },
  { id: "clinical_decision_support", label: "Clinical Decision Support", riskTier: "critical", reliabilityRequirement: 5, autonomyDefault: "human_in_loop", category: "Health" },
  { id: "sales_research", label: "Sales / Account Research", riskTier: "low", reliabilityRequirement: 3, autonomyDefault: "advisory_only", category: "Revenue" },
  { id: "financial_analysis", label: "Financial Analysis & Reporting", riskTier: "high", reliabilityRequirement: 5, autonomyDefault: "human_in_loop", category: "Finance" },
  { id: "marketing_content", label: "Marketing Content Generation", riskTier: "medium", reliabilityRequirement: 3, autonomyDefault: "human_in_loop", category: "Marketing" },
  { id: "operations_automation", label: "Back-Office Operations Automation", riskTier: "high", reliabilityRequirement: 4, autonomyDefault: "supervised_agent", category: "Operations" },
  { id: "data_analysis", label: "Data Analysis & BI Copilot", riskTier: "medium", reliabilityRequirement: 4, autonomyDefault: "human_in_loop", category: "Data" },
];

export const PRIMARY_OBJECTIVES = [
  { id: "productivity", label: "Workforce productivity uplift" },
  { id: "cost_reduction", label: "Cost reduction / automation" },
  { id: "revenue_growth", label: "Revenue growth / customer experience" },
  { id: "compliance", label: "Risk and compliance modernisation" },
  { id: "innovation", label: "New product / new market entry" },
  { id: "data_intelligence", label: "Data intelligence and decision support" },
];

export const ECOSYSTEMS = [
  "microsoft", "google_workspace", "salesforce", "aws", "azure", "gcp",
  "databricks", "snowflake", "servicenow", "sap", "oracle", "atlassian", "workday",
];
