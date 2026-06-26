// IT-services / GSI delivery-partnership SEED — faithful transcription of
// condensed_ai_model_it_services_partner_analysis.txt (AnalystGenius, 2026-06-26).
// ───────────────────────────────────────────────────────────────────────────
// This is CURATED ANALYST data (like the category taxonomy), NOT fabricated
// numbers. The file's THREE partnership categories are preserved verbatim and
// NEVER merged. Hedged claims keep a weaker evidence tier. Nothing here is
// invented: every edge traces to the source file; the source string is stamped
// on every row; partnerships carry NO path to a vendor score (firewall).

export const PARTNERSHIP_SOURCE = "AnalystGenius curated 2026-06-26";

export type PartnershipTier = "direct_named" | "cloud_certified" | "observed_implementer";
export type EvidenceTierPartnership = "strong" | "moderate" | "plausible_unverified";
export type PartnershipProvenance = "analyst_curated_seed" | "news_confirmed";
export type DeliveryPartnerKind =
  | "global_si"
  | "strategy_consultancy"
  | "regional_si"
  | "platform_hybrid";

export interface DeliveryPartnerSeed {
  id: string;
  name: string;
  slug: string;
  kind: DeliveryPartnerKind;
  /** IBM-type firm that is BOTH an AI platform owner and an SI (encroachment flag). */
  platformHybrid: boolean;
}

export interface DeliveryPartnershipSeed {
  deliveryPartnerId: string;
  aiVendorId: string;
  partnershipTier: PartnershipTier;
  evidenceTier: EvidenceTierPartnership;
  provenance: PartnershipProvenance;
  source: string;
  implementationAreas: string[];
  industries: string[];
  regions: string[];
}

// ── 21-house roster (the prompt roster). kind/platformHybrid per the file's framing. ──
export const DELIVERY_PARTNERS: DeliveryPartnerSeed[] = [
  { id: "accenture", name: "Accenture", slug: "accenture", kind: "global_si", platformHybrid: false },
  { id: "capgemini", name: "Capgemini", slug: "capgemini", kind: "global_si", platformHybrid: false },
  { id: "cognizant", name: "Cognizant", slug: "cognizant", kind: "global_si", platformHybrid: false },
  { id: "infosys", name: "Infosys", slug: "infosys", kind: "global_si", platformHybrid: false },
  { id: "tcs", name: "TCS", slug: "tcs", kind: "global_si", platformHybrid: false },
  { id: "wipro", name: "Wipro", slug: "wipro", kind: "global_si", platformHybrid: false },
  { id: "hcltech", name: "HCLTech", slug: "hcltech", kind: "global_si", platformHybrid: false },
  { id: "deloitte", name: "Deloitte", slug: "deloitte", kind: "strategy_consultancy", platformHybrid: false },
  { id: "pwc", name: "PwC", slug: "pwc", kind: "strategy_consultancy", platformHybrid: false },
  { id: "kpmg", name: "KPMG", slug: "kpmg", kind: "strategy_consultancy", platformHybrid: false },
  { id: "ibm-consulting", name: "IBM Consulting", slug: "ibm-consulting", kind: "platform_hybrid", platformHybrid: true },
  { id: "dxc", name: "DXC Technology", slug: "dxc", kind: "global_si", platformHybrid: false },
  { id: "ntt-data", name: "NTT DATA", slug: "ntt-data", kind: "global_si", platformHybrid: false },
  { id: "sopra-steria", name: "Sopra Steria", slug: "sopra-steria", kind: "regional_si", platformHybrid: false },
  { id: "kyndryl", name: "Kyndryl", slug: "kyndryl", kind: "global_si", platformHybrid: false },
  { id: "mckinsey", name: "McKinsey", slug: "mckinsey", kind: "strategy_consultancy", platformHybrid: false },
  { id: "bcg", name: "BCG", slug: "bcg", kind: "strategy_consultancy", platformHybrid: false },
  { id: "cgi", name: "CGI", slug: "cgi", kind: "global_si", platformHybrid: false },
  { id: "avanade", name: "Avanade", slug: "avanade", kind: "global_si", platformHybrid: false },
  { id: "fujitsu", name: "Fujitsu", slug: "fujitsu", kind: "global_si", platformHybrid: false },
  { id: "lg-cns", name: "LG CNS", slug: "lg-cns", kind: "regional_si", platformHybrid: false },
];

// ── Per-AI-vendor implementation areas (file §2 "Main implementation areas"). ──
const VENDOR_AREAS: Record<string, string[]> = {
  openai: ["Agentic enterprise workflows", "Software engineering (Codex)", "Public sector AI", "Cybersecurity", "Enterprise productivity"],
  anthropic: ["Regulated enterprise AI", "Financial services", "Tax/legal/advisory workflows", "Cybersecurity", "Mission-critical systems", "PE & knowledge work"],
  google: ["Gemini Enterprise", "Agentic enterprise workflows", "Sector-specific AI agents", "Finance close", "Life sciences", "Software engineering", "Sovereign/distributed cloud"],
  microsoft: ["Microsoft 365 Copilot", "Enterprise productivity", "Digital workplace", "Software engineering", "Manufacturing/factory intelligence", "Agentic workflows"],
  mistral: ["European sovereign AI", "Industrial AI", "Regulated enterprise AI", "Secure large-scale deployment"],
  meta: ["Custom enterprise models", "Private/sovereign AI", "Open-weight deployment", "Hybrid cloud / on-prem"],
  cohere: ["Secure enterprise AI", "Knowledge work", "Financial services", "Telecoms", "Private AI"],
  ibm: ["Hybrid cloud", "AI governance", "Regulated industries", "Mainframe modernization", "Cybersecurity", "AIOps", "Enterprise automation"],
};

// ── §4 industry map + §5 region map: a partnership is tagged with an industry/region
//    only where BOTH the SI and the vendor are listed for it (source-grounded; no guess). ──
const INDUSTRY_MAP: { label: string; sis: string[]; vendors: string[] }[] = [
  { label: "Software engineering", sis: ["accenture", "cognizant", "infosys", "tcs", "ntt-data", "dxc"], vendors: ["openai", "microsoft", "anthropic", "google"] },
  { label: "Financial services", sis: ["deloitte", "kpmg", "pwc", "ibm-consulting", "tcs", "accenture"], vendors: ["anthropic", "ibm", "google", "microsoft"] },
  { label: "Healthcare & life sciences", sis: ["cognizant", "kpmg", "accenture", "deloitte"], vendors: ["anthropic", "google", "microsoft"] },
  { label: "Manufacturing & industrial", sis: ["accenture", "capgemini", "sopra-steria", "tcs", "ntt-data", "wipro"], vendors: ["google", "microsoft", "mistral", "meta"] },
  { label: "Public sector", sis: ["accenture", "dxc", "ibm-consulting", "cgi", "sopra-steria"], vendors: ["openai", "anthropic", "ibm", "mistral", "meta"] },
  { label: "Cybersecurity", sis: ["ibm-consulting", "accenture", "pwc", "deloitte"], vendors: ["openai", "ibm", "anthropic", "microsoft"] },
  { label: "Retail & consumer", sis: ["accenture", "cognizant", "capgemini", "infosys"], vendors: ["openai", "google", "microsoft", "cohere"] },
  { label: "Telecoms", sis: ["infosys", "cognizant", "accenture", "ntt-data"], vendors: ["anthropic", "cohere", "google", "microsoft"] },
];

const REGION_MAP: { label: string; sis: string[]; vendors: string[] }[] = [
  { label: "United States", sis: ["accenture", "deloitte", "pwc", "kpmg", "ibm-consulting", "cognizant", "dxc"], vendors: ["openai", "anthropic", "microsoft", "google", "ibm"] },
  { label: "India", sis: ["tcs", "infosys", "wipro", "hcltech", "cognizant"], vendors: ["microsoft", "openai", "google", "anthropic"] },
  { label: "France / Western Europe", sis: ["capgemini", "sopra-steria", "accenture"], vendors: ["mistral", "google", "microsoft", "openai"] },
  { label: "UK / Europe", sis: ["accenture", "deloitte", "pwc", "kpmg", "capgemini", "dxc", "ibm-consulting"], vendors: ["anthropic", "microsoft", "google", "openai"] },
  { label: "Japan", sis: ["ntt-data", "fujitsu", "ibm-consulting", "accenture"], vendors: ["microsoft", "google", "cohere", "meta"] },
  { label: "Canada", sis: ["accenture", "ibm-consulting", "deloitte", "mckinsey"], vendors: ["cohere", "microsoft", "google", "openai"] },
  { label: "Middle East", sis: ["ibm-consulting", "accenture", "tcs", "infosys", "deloitte", "pwc"], vendors: ["ibm", "openai", "google", "microsoft", "cohere"] },
];

function tagsFor(map: typeof INDUSTRY_MAP, partnerId: string, vendorId: string): string[] {
  return map.filter((m) => m.sis.includes(partnerId) && m.vendors.includes(vendorId)).map((m) => m.label);
}

// ── Raw edges: [partnerId, aiVendorId, partnershipTier, evidenceTier]. ──
// Tiers from file §6 channels; evidence weakened exactly where the file hedges.
type EdgeTuple = [string, string, PartnershipTier, EvidenceTierPartnership];
const EDGES: EdgeTuple[] = [
  // OpenAI — direct frontier alliance (§6.1) → direct_named
  ["accenture", "openai", "direct_named", "strong"], ["capgemini", "openai", "direct_named", "strong"],
  ["mckinsey", "openai", "direct_named", "strong"], ["bcg", "openai", "direct_named", "strong"],
  ["cognizant", "openai", "direct_named", "strong"], ["infosys", "openai", "direct_named", "strong"],
  ["tcs", "openai", "direct_named", "strong"], ["cgi", "openai", "direct_named", "strong"],
  ["pwc", "openai", "direct_named", "strong"],
  ["ibm-consulting", "openai", "observed_implementer", "moderate"], // "IBM, specifically around enterprise security AI" (hybrid)

  // Anthropic — direct frontier alliance → direct_named
  ["accenture", "anthropic", "direct_named", "strong"], ["deloitte", "anthropic", "direct_named", "strong"],
  ["pwc", "anthropic", "direct_named", "strong"], ["kpmg", "anthropic", "direct_named", "strong"],
  ["cognizant", "anthropic", "direct_named", "strong"], ["dxc", "anthropic", "direct_named", "strong"],
  ["infosys", "anthropic", "direct_named", "strong"],
  ["tcs", "anthropic", "observed_implementer", "moderate"], // "subject to further validation for formal status"

  // Google Gemini — cloud competency channel (§6.2) → cloud_certified
  ["accenture", "google", "cloud_certified", "strong"], ["capgemini", "google", "cloud_certified", "strong"],
  ["cognizant", "google", "cloud_certified", "strong"], ["deloitte", "google", "cloud_certified", "strong"],
  ["hcltech", "google", "cloud_certified", "strong"], ["infosys", "google", "cloud_certified", "strong"],
  ["kpmg", "google", "cloud_certified", "strong"], ["kyndryl", "google", "cloud_certified", "strong"],
  ["mckinsey", "google", "cloud_certified", "strong"], ["pwc", "google", "cloud_certified", "strong"],
  ["tcs", "google", "cloud_certified", "strong"],

  // Microsoft Copilot / Azure OpenAI — cloud competency channel → cloud_certified
  ["accenture", "microsoft", "cloud_certified", "strong"], ["avanade", "microsoft", "cloud_certified", "strong"],
  ["infosys", "microsoft", "cloud_certified", "strong"], ["tcs", "microsoft", "cloud_certified", "strong"],
  ["wipro", "microsoft", "cloud_certified", "strong"], ["cognizant", "microsoft", "cloud_certified", "strong"],
  ["capgemini", "microsoft", "cloud_certified", "strong"], ["ntt-data", "microsoft", "cloud_certified", "strong"],

  // Mistral — direct model-company alliance → direct_named
  ["accenture", "mistral", "direct_named", "strong"], ["sopra-steria", "mistral", "direct_named", "strong"],

  // Meta Llama — open-model implementation (§ "not a classic partner channel") → observed_implementer
  ["accenture", "meta", "observed_implementer", "moderate"], // via NVIDIA AI Foundry / AI Refinery
  ["ibm-consulting", "meta", "observed_implementer", "plausible_unverified"],
  ["tcs", "meta", "observed_implementer", "plausible_unverified"],
  ["dxc", "meta", "observed_implementer", "plausible_unverified"],
  ["ntt-data", "meta", "observed_implementer", "plausible_unverified"], // "plausible implementers... direct evidence weaker"

  // Cohere — direct (strong pair) + broader ecosystem (hedged)
  ["accenture", "cohere", "direct_named", "strong"], ["mckinsey", "cohere", "direct_named", "strong"],
  ["fujitsu", "cohere", "observed_implementer", "plausible_unverified"],
  ["lg-cns", "cohere", "observed_implementer", "plausible_unverified"], // "broader ecosystem... not all classic IT services"

  // IBM Granite / watsonx — IBM Consulting is the platform owner's own GSI → direct_named (hybrid)
  ["ibm-consulting", "ibm", "direct_named", "strong"],

  // xAI Grok — "No major global SI channel clearly evidenced" → NO edges (honest absence).
];

export const DELIVERY_PARTNERSHIPS: DeliveryPartnershipSeed[] = EDGES.map(
  ([partnerId, aiVendorId, partnershipTier, evidenceTier]) => ({
    deliveryPartnerId: partnerId,
    aiVendorId,
    partnershipTier,
    evidenceTier,
    provenance: "analyst_curated_seed" as const,
    source: PARTNERSHIP_SOURCE,
    implementationAreas: VENDOR_AREAS[aiVendorId] ?? [],
    industries: tagsFor(INDUSTRY_MAP, partnerId, aiVendorId),
    regions: tagsFor(REGION_MAP, partnerId, aiVendorId),
  }),
);

/** Set of AI vendor ids referenced by partnerships — for the FK-validity guard test. */
export const DELIVERY_PARTNERSHIP_VENDOR_IDS = [...new Set(DELIVERY_PARTNERSHIPS.map((p) => p.aiVendorId))];
