// Generator: transform the 16-vertical CITED peer-sourcing research (2026-07-12)
// into test-valid PeerCompany[] for lib/peer/peer-adoption-sourced.ts.
//
// Every entry below traces to a real, named, fetched source URL (compiled by
// per-vertical research agents, FACTUAL-DATA-ONLY). The transform enforces the
// dataset's honesty contract BY CONSTRUCTION so it can't drift from the rubric:
//   • platform_integration = the one DISCLOSED, cited adoption (band computed
//     from `adoptions` via the same rule as lib/peer/rubric.ts);
//   • the other 4 signals = not_disclosed (we sourced adoption evidence only —
//     under-claim, never invent talent/patent/product/automation signals);
//   • vendorIds validated against the tracked allowlist (untracked dropped).
import { writeFileSync } from "node:fs";

// The 29 tracked vendor ids (TRACKED_VENDOR_NAMES keys) — the ONLY allowed cross-links.
const TRACKED = new Set([
  "openai","microsoft","google","anthropic","aws","salesforce","servicenow","oracle","sap",
  "ibm","cohere","mistral","glean","moveworks","writer","hebbia","rogo","harvey","databricks",
  "snowflake","meta","deepseek","alibaba","moonshot","minimax","ai21","xai","perplexity","nvidia",
]);

// The 57 company ids already in peer-adoption-data.ts — must not collide.
const EXISTING = new Set([
  "jpmorgan-chase","morgan-stanley","goldman-sachs","citigroup","wells-fargo","bank-of-america",
  "capital-one","pfizer","roche","eli-lilly","merck","astrazeneca","johnson-and-johnson","sanofi",
  "novartis","gsk","walmart","kroger","home-depot","lowes","target","costco","best-buy","siemens",
  "schneider-electric","rockwell-automation","ge-aerospace","honeywell","abb","caterpillar",
  "state-farm","travelers","aig","liberty-mutual","allstate","progressive","chubb","att","t-mobile",
  "verizon","deutsche-telekom","vodafone","comcast","bp","shell","exxonmobil","nextera-energy",
  "duke-energy","chevron","constellation-energy","tesla","mercedes-benz","toyota","bmw","volkswagen",
  "ford","gm",
]);

const INDUSTRY = {
  financial_services: "Banking & capital markets",
  insurance: "Insurance",
  healthcare: "Healthcare providers",
  pharma_life_sciences: "Pharmaceuticals & life sciences",
  legal: "Legal services",
  professional_services: "Professional services",
  technology_software: "Technology & software",
  manufacturing: "Manufacturing",
  retail_consumer: "Retail & consumer",
  telecom_media: "Telecom & media",
  public_sector: "Public sector",
  education: "Education",
  energy_utilities: "Energy & utilities",
  transport_logistics: "Transport & logistics",
  real_estate: "Real estate",
  aerospace_defence: "Aerospace & defence",
};

// Same rule as lib/peer/rubric.ts computePeerBand("platform_integration", ...).
function band(adoptions) {
  if (adoptions >= 4) return 4;
  if (adoptions >= 2) return 3;
  if (adoptions >= 1) return 2;
  return 1;
}

// ── RAW CITED DATA ─────────────────────────────────────────────────────────
// Fields: id, name, vertical, sizeBand, region, vendorIds, adoptions, summary, cite{title,url,publisher,tier,publishedAt?}
// adoptions defaults to 1 (one disclosed deployment → "Developing"); set to 2 only
// where the company made genuinely distinct platform decisions (each cited).
const RAW = [
  // ── financial_services ──
  { id:"klarna", name:"Klarna", vertical:"financial_services", sizeBand:"enterprise", region:"europe", vendorIds:["openai"], summary:"OpenAI-powered customer-service assistant handled two-thirds of chats (2.3M conversations) in its first month — the work of ~700 full-time agents across 23 markets.", cite:{title:"Klarna AI assistant handles two-thirds of customer service chats in its first month", url:"https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/", publisher:"Klarna", tier:"company_primary", publishedAt:"2024-02-27"} },
  { id:"commonwealth-bank", name:"Commonwealth Bank of Australia", vertical:"financial_services", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["anthropic","aws"], adoptions:2, summary:"Expanded strategic partnership with and investment in Anthropic (scam/fraud prevention, customer service), built on its AWS/Amazon Bedrock platform.", cite:{title:"Commonwealth Bank deepens partnership with Anthropic", url:"https://www.commbank.com.au/articles/newsroom/2025/03/anthropic.html", publisher:"Commonwealth Bank of Australia", tier:"company_primary", publishedAt:"2025-03-14"} },
  { id:"deutsche-bank", name:"Deutsche Bank", vertical:"financial_services", sizeBand:"global_enterprise", region:"europe", vendorIds:["google"], summary:"Built 'DB Lumina', an AI research assistant powered by Google Gemini on Vertex AI, serving ~5,000 users across Deutsche Bank Research.", cite:{title:"Deutsche Bank delivers AI-powered financial research with DB Lumina", url:"https://cloud.google.com/blog/topics/financial-services/deutsche-bank-delivers-ai-powered-financial-research-with-db-lumina", publisher:"Google Cloud", tier:"vendor_disclosure", publishedAt:"2025-09-24"} },
  { id:"moodys", name:"Moody's", vertical:"financial_services", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Deployed 'Moody's CoPilot' to ~14,000 employees and a customer-facing Research Assistant, both built on Microsoft Azure OpenAI Service with proprietary data.", cite:{title:"Moody's and Microsoft develop enhanced risk, data, analytics, research and collaboration solutions powered by generative AI", url:"https://news.microsoft.com/source/2023/06/29/moodys-and-microsoft-develop-enhanced-risk-data-analytics-research-and-collaboration-solutions-powered-by-generative-ai/", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2023-06-29"} },
  { id:"natwest", name:"NatWest Group", vertical:"financial_services", sizeBand:"global_enterprise", region:"europe", vendorIds:["ibm"], summary:"Launched 'Cora+', a generative-AI upgrade to its Cora digital assistant developed with IBM (watsonx, RAG); Cora handled 10.8M customer queries in 2023.", cite:{title:"NatWest launches Cora+, the latest generative AI upgrade to its digital assistant", url:"https://www.natwestgroup.com/news-and-insights/news-room/press-releases/data-and-technology/2024/jun/natwest-launches-cora-plus-the-latest-generative-ai-upgrade-to-t.html", publisher:"NatWest Group", tier:"company_primary", publishedAt:"2024-06-10"} },
  { id:"nubank", name:"Nubank", vertical:"financial_services", sizeBand:"enterprise", region:"latam", vendorIds:["openai"], summary:"Partnered with OpenAI (GPT-4o) for an enterprise-search tool and a Call Center Copilot; the assistant resolves 55% of Tier-1 inquiries across 2M+ monthly chats.", cite:{title:"Nubank builds trusted financial products with OpenAI", url:"https://openai.com/index/nubank/", publisher:"OpenAI", tier:"vendor_disclosure", publishedAt:"2025-03-13"} },

  // ── insurance (new only — existing set has US P&C: state-farm/travelers/aig/etc.) ──
  { id:"zurich-insurance", name:"Zurich Insurance Group", vertical:"insurance", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Uses Azure OpenAI Service to build multimodal GenAI tools that process unstructured data (reports, images, emails) across languages to accelerate underwriting.", cite:{title:"Zurich Insurance — Azure OpenAI Service customer story", url:"https://www.microsoft.com/en/customers/story/19760-zurich-insurance-azure-open-ai-service", publisher:"Microsoft Customer Stories", tier:"vendor_disclosure", publishedAt:"2024-11-15"} },
  { id:"allianz", name:"Allianz", vertical:"insurance", sizeBand:"global_enterprise", region:"europe", vendorIds:["openai","microsoft","deepseek"], adoptions:2, summary:"AllianzGPT runs OpenAI GPT-4o and DALL-E inside the Allianz Azure Cloud (Microsoft), with a ring-fenced internal DeepSeek model recently added; 60,000+ active users and 10M+ prompts.", cite:{title:"AI at Allianz: the impact of AllianzGPT", url:"https://www.allianz.com/en/mediacenter/news/articles/250218-ai-at-allianz-the-impact-of-allianzgpt.html", publisher:"Allianz", tier:"company_primary", publishedAt:"2025-02-18"} },
  { id:"axa", name:"AXA", vertical:"insurance", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"'AXA Secure GPT', an internal generative-AI platform built on Microsoft's Azure OpenAI Service, is being rolled out toward all 140,000 employees in a data-private tenant.", cite:{title:"AXA offers secure generative AI to employees", url:"https://www.axa.com/en/press/press-releases/axa-offers-securegenerative-ai-to-employees", publisher:"AXA", tier:"company_primary", publishedAt:"2023-07-27"} },
  { id:"swiss-re", name:"Swiss Re", vertical:"insurance", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft"], summary:"Rolled out Copilot for Microsoft 365 to 3,000 users across HR, communications and parts of its core business.", cite:{title:"Microsoft and Swiss Re drive innovation with generative AI rollout", url:"https://news.microsoft.com/source/emea/2024/09/microsoft-and-swiss-re-drive-innovation-with-generative-ai-rollout/", publisher:"Microsoft Source EMEA", tier:"vendor_disclosure", publishedAt:"2024-09-03"} },
  { id:"generali-france", name:"Generali France", vertical:"insurance", sizeBand:"enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Deployed Microsoft 365 Copilot (3,700 users) and built ~50 agents on Copilot Studio and Azure OpenAI for claims management, email summarization, RFP responses and voice assistance.", cite:{title:"Generali — Microsoft 365 Copilot customer story", url:"https://www.microsoft.com/en/customers/story/25382-generali-microsoft-365-copilot", publisher:"Microsoft Customer Stories", tier:"vendor_disclosure", publishedAt:"2025-09-30"} },

  // ── healthcare ──
  { id:"stanford-health-care", name:"Stanford Health Care", vertical:"healthcare", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Deployed Microsoft/Nuance DAX Copilot ambient clinical documentation enterprise-wide across care providers.", cite:{title:"DAX Copilot deployed enterprise-wide at Stanford Health Care", url:"https://www.prnewswire.com/news-releases/dax-copilot-to-automate-the-creation-of-clinical-documentation-reduce-physician-burnout-and-expand-access-to-care-deployed-enterprise-wide-at-stanford-health-care-302085286.html", publisher:"PR Newswire (Nuance/Microsoft)", tier:"vendor_disclosure", publishedAt:"2024-03-11"} },
  { id:"northwestern-medicine", name:"Northwestern Medicine", vertical:"healthcare", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Deployed Microsoft/Nuance DAX Copilot embedded in Epic; disclosed a 24% decrease in time spent on notes.", cite:{title:"Northwestern Medicine and Nuance's DAX Copilot", url:"https://www.hospitalmanagement.net/news/northwestern-medicine-nuances-dax-copilot/", publisher:"Hospital Management", tier:"press", publishedAt:"2024-08-16"} },
  { id:"vanderbilt-umc", name:"Vanderbilt University Medical Center", vertical:"healthcare", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Launched Microsoft/Nuance DAX Copilot (embedded in Epic) for clinical documentation in ambulatory and ED settings.", cite:{title:"DAX Copilot technology for clinical documentation launching at VUMC", url:"https://news.vumc.org/2024/12/31/dax-copilot-technology-for-clinical-documentation-launching-at-vumc/", publisher:"Vanderbilt Health News", tier:"company_primary", publishedAt:"2024-12-31"} },
  { id:"providence", name:"Providence", vertical:"healthcare", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Built 'ProvARIA', an in-house clinical inbox message-triage tool on Microsoft Azure OpenAI Service, within an expanded Microsoft/Nuance collaboration.", cite:{title:"Providence and Microsoft enable AI innovation at scale", url:"https://www.prnewswire.com/news-releases/providence-and-microsoft-enable-ai-innovation-at-scale-to-improve-the-future-of-care-302084162.html", publisher:"PR Newswire (Nuance/Microsoft)", tier:"vendor_disclosure", publishedAt:"2024-03-08"} },
  { id:"upmc", name:"UPMC", vertical:"healthcare", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Deployed ambient listening in exam rooms with Microsoft DAX Copilot in an Epic-native workflow; 1,700 providers cut 'pajama time' ~1.8 hrs/day.", cite:{title:"Ambient AI at UPMC: data-driven relief for burned-out clinicians", url:"https://dhinsights.org/insight/ambient-ai-at-upmc-data-driven-relief-for-burned-out-clinicians", publisher:"Digital Health Insights", tier:"press", publishedAt:"2025-01-01"} },
  { id:"hca-healthcare", name:"HCA Healthcare", vertical:"healthcare", sizeBand:"global_enterprise", region:"north_america", vendorIds:["google"], summary:"Built the 'Nurse Handoff' app with Google Cloud generative-AI foundation models (piloted at 5 hospitals), atop its Google Healthcare Data Engine partnership.", cite:{title:"Nurse Handoff AI chart app: HCA Healthcare and better patient outcomes", url:"https://cloud.google.com/transform/nurse-handoff-ai-chart-app-hca-healthcare-better-patient-outcomes", publisher:"Google Cloud", tier:"vendor_disclosure", publishedAt:"2025-07-29"} },
  { id:"mayo-clinic", name:"Mayo Clinic", vertical:"healthcare", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Announced a strategic collaboration with Microsoft to build and deploy a Mayo-owned frontier AI model for healthcare.", cite:{title:"Mayo Clinic and Microsoft collaborate to develop a frontier AI model for healthcare", url:"https://news.microsoft.com/source/2026/06/02/mayo-clinic-and-microsoft-collaborate-to-develop-a-frontier-ai-model-for-healthcare/", publisher:"Microsoft News", tier:"vendor_disclosure", publishedAt:"2026-06-02"} },
  { id:"manchester-nhs", name:"Manchester University NHS Foundation Trust", vertical:"healthcare", sizeBand:"enterprise", region:"europe", vendorIds:["microsoft"], summary:"Helped test and is expanding Microsoft Dragon Copilot (MHRA-certified ambient AI clinical documentation) across its workforce.", cite:{title:"Microsoft launches ambient AI assistant to the NHS", url:"https://www.digitalhealth.net/2025/09/microsoft-launches-ambient-ai-assistant-to-the-nhs/", publisher:"Digital Health", tier:"press", publishedAt:"2025-09-01"} },

  // ── legal ──
  { id:"ao-shearman", name:"A&O Shearman", vertical:"legal", sizeBand:"global_enterprise", region:"europe", vendorIds:["openai"], summary:"Deployed the GPT-4-based legal AI tool Harvey firmwide to ~3,500 lawyers across 43 offices after a large beta.", cite:{title:"A&O announces exclusive launch partnership with Harvey", url:"https://www.aoshearman.com/en/news/ao-announces-exclusive-launch-partnership-with-harvey", publisher:"A&O Shearman", tier:"company_primary", publishedAt:"2023-02-15"} },
  { id:"macfarlanes", name:"Macfarlanes", vertical:"legal", sizeBand:"enterprise", region:"europe", vendorIds:["openai"], summary:"Rolled out Harvey (built on OpenAI/ChatGPT technology) firmwide after a pilot of 70+ fee earners and knowledge lawyers.", cite:{title:"Macfarlanes progresses AI strategy, announcing partnership with Harvey", url:"https://www.macfarlanes.com/what-we-think/2023/macfarlanes-progresses-ai-strategy-announcing-partnership-with-harvey/", publisher:"Macfarlanes", tier:"company_primary", publishedAt:"2023-09-21"} },
  { id:"ashurst", name:"Ashurst", vertical:"legal", sizeBand:"global_enterprise", region:"europe", vendorIds:["openai"], summary:"Rolled out Harvey (OpenAI-based) to all 4,300+ lawyers/staff across every office after a 525-user pilot.", cite:{title:"Ashurst launches global Harvey partnership following firmwide trial", url:"https://legaltechnology.com/2024/06/25/ashurst-launches-global-harvey-partnership-following-firmwide-trial/", publisher:"Legal IT Insider", tier:"press", publishedAt:"2024-06-25"} },
  { id:"clifford-chance", name:"Clifford Chance", vertical:"legal", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft"], summary:"Adopted Microsoft 365 Copilot and rolled it out globally to lawyers and business professionals after extensive trials.", cite:{title:"Clifford Chance — Microsoft 365 Copilot customer story", url:"https://www.microsoft.com/en/customers/story/19404-clifford-chance-microsoft-365-copilot", publisher:"Microsoft", tier:"vendor_disclosure"} },
  { id:"dla-piper", name:"DLA Piper", vertical:"legal", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft"], summary:"One of the first major law firms to adopt Microsoft 365 Copilot, reporting early experiments saving up to 36 hours/week.", cite:{title:"DLA Piper — Microsoft 365 Copilot customer story", url:"https://www.microsoft.com/en/customers/story/19584-dla-piper-microsoft-365-copilot", publisher:"Microsoft", tier:"vendor_disclosure"} },
  { id:"gunderson-dettmer", name:"Gunderson Dettmer", vertical:"legal", sizeBand:"enterprise", region:"north_america", vendorIds:["perplexity"], summary:"Rolled out Perplexity Enterprise firmwide; ~80% of lawyers active, handling 35,000+ queries/month.", cite:{title:"Gunderson Dettmer — Perplexity Enterprise customer", url:"https://www.perplexity.ai/enterprise/customers/gunderson", publisher:"Perplexity", tier:"vendor_disclosure", publishedAt:"2025-05-01"} },
  { id:"freshfields", name:"Freshfields", vertical:"legal", sizeBand:"global_enterprise", region:"europe", vendorIds:["anthropic"], summary:"Signed a multi-year deal to deploy Anthropic's Claude to thousands of lawyers across 33 offices, co-developing agentic workflows.", cite:{title:"Anthropic's legal plug-in and Claude in Big Law", url:"https://fortune.com/2026/05/12/anthropic-legal-plug-in-release-claude-cowork-big-law/", publisher:"Fortune", tier:"press", publishedAt:"2026-05-12"} },
  { id:"quinn-emanuel", name:"Quinn Emanuel Urquhart & Sullivan", vertical:"legal", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Named (with Anthropic) as using Claude on live matters; a firm partner built its internal litigation platform on Claude.", cite:{title:"Anthropic's legal plug-in and Claude in Big Law", url:"https://fortune.com/2026/05/12/anthropic-legal-plug-in-release-claude-cowork-big-law/", publisher:"Fortune", tier:"press", publishedAt:"2026-05-12"} },
  { id:"holland-knight", name:"Holland & Knight", vertical:"legal", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Named in the joint Anthropic announcement as using Claude on live legal matters.", cite:{title:"Anthropic's legal plug-in and Claude in Big Law", url:"https://fortune.com/2026/05/12/anthropic-legal-plug-in-release-claude-cowork-big-law/", publisher:"Fortune", tier:"press", publishedAt:"2026-05-12"} },

  // ── pharma_life_sciences (new only) ──
  { id:"moderna", name:"Moderna", vertical:"pharma_life_sciences", sizeBand:"enterprise", region:"north_america", vendorIds:["openai"], summary:"Deployed OpenAI's ChatGPT Enterprise across all business functions; employees built ~750 custom GPTs in two months.", cite:{title:"Moderna and OpenAI", url:"https://openai.com/index/moderna/", publisher:"OpenAI", tier:"vendor_disclosure", publishedAt:"2024-04-24"} },
  { id:"recursion", name:"Recursion Pharmaceuticals", vertical:"pharma_life_sciences", sizeBand:"mid_market", region:"north_america", vendorIds:["nvidia"], summary:"Completed the NVIDIA-powered BioHive-2 DGX SuperPOD (504 H100 GPUs) to train drug-discovery foundation models, backed by a $50M NVIDIA investment.", cite:{title:"Recursion announces completion of NVIDIA-powered BioHive-2", url:"https://ir.recursion.com/news-releases/news-release-details/recursion-announces-completion-nvidia-powered-biohive-2-largest", publisher:"Recursion Pharmaceuticals", tier:"company_primary", publishedAt:"2024-05-21"} },
  { id:"novo-nordisk", name:"Novo Nordisk", vertical:"pharma_life_sciences", sizeBand:"global_enterprise", region:"europe", vendorIds:["nvidia"], summary:"Selected the NVIDIA-built Gefion supercomputer and will use NVIDIA BioNeMo for generative-AI drug discovery and protein engineering.", cite:{title:"NVIDIA partners with Novo Nordisk and DCAI to advance drug discovery", url:"https://nvidianews.nvidia.com/news/nvidia-partners-with-novo-nordisk-and-dcai-to-advance-drug-discovery", publisher:"NVIDIA", tier:"vendor_disclosure"} },
  { id:"genentech", name:"Genentech", vertical:"pharma_life_sciences", sizeBand:"global_enterprise", region:"north_america", vendorIds:["nvidia"], summary:"In a multi-year strategic collaboration with NVIDIA, uses the BioNeMo platform to power its 'lab-in-a-loop' drug-discovery framework.", cite:{title:"Genentech drug discovery with NVIDIA BioNeMo", url:"https://blogs.nvidia.com/blog/genentech-drug-discovery-bionemo/", publisher:"NVIDIA", tier:"vendor_disclosure"} },
  { id:"amgen", name:"Amgen", vertical:"pharma_life_sciences", sizeBand:"global_enterprise", region:"north_america", vendorIds:["nvidia","aws"], adoptions:2, summary:"Uses NVIDIA BioNeMo and DGX SuperPOD for genomics/drug-discovery models, and expanded an AWS collaboration (Bedrock, SageMaker) for pharmaceutical manufacturing.", cite:{title:"Genomics AI: Amgen builds on NVIDIA DGX SuperPOD", url:"https://blogs.nvidia.com/blog/genomics-ai-amgen-superpod/", publisher:"NVIDIA", tier:"vendor_disclosure", publishedAt:"2024-01-08"} },

  // ── technology_software (non-vendor adopters only) ──
  { id:"notion", name:"Notion", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Integrated Claude Managed Agents to power agent orchestration and AI writing/search features inside its workspace product.", cite:{title:"Notion — Anthropic customer story", url:"https://claude.com/customers/notion", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"replit", name:"Replit", vertical:"technology_software", sizeBand:"mid_market", region:"north_america", vendorIds:["anthropic","google"], adoptions:2, summary:"Standardized its Agent coding platform on Claude as the underlying model, deployed on Google Cloud's agent platform.", cite:{title:"Replit — Anthropic customer story", url:"https://claude.com/customers/replit", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"figma", name:"Figma", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Uses Claude to power code generation in its in-product Figma Sites and Figma Make features.", cite:{title:"Figma — Anthropic customer story", url:"https://claude.com/customers/figma", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"box", name:"Box", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Built document creation into its AI agent using Claude's Skills API, routing across Claude Sonnet and Opus.", cite:{title:"Box — Anthropic customer story", url:"https://claude.com/customers/box", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"slack", name:"Slack (Salesforce)", vertical:"technology_software", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Uses Claude models to power in-product AI search and channel/thread summaries and recaps.", cite:{title:"Slack — Anthropic customer story", url:"https://claude.com/customers/slack", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"hubspot", name:"HubSpot", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Adopted Claude Code for engineering and Claude Projects for marketing/CS, reporting a ~40% productivity increase.", cite:{title:"HubSpot — Anthropic customer story", url:"https://claude.com/customers/hubspot", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"dust", name:"Dust", vertical:"technology_software", sizeBand:"smb", region:"europe", vendorIds:["anthropic"], summary:"Selected Claude for its model-agnostic AI-agent platform's deep-research and tool-calling orchestration.", cite:{title:"Dust — Anthropic customer story", url:"https://claude.com/customers/dust", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"gitlab", name:"GitLab", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Deployed Claude Enterprise across internal teams and integrated Anthropic's API into its product; reported 25–50% productivity gains.", cite:{title:"GitLab — Anthropic Enterprise customer story", url:"https://claude.com/customers/gitlab-enterprise", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"jamf", name:"Jamf", vertical:"technology_software", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic","aws"], adoptions:2, summary:"Apple device-management vendor rolled out Claude Enterprise and Claude on Amazon Bedrock with SOC2/ISO-27001-compatible controls.", cite:{title:"Jamf — Anthropic customer story", url:"https://claude.com/customers/jamf", publisher:"Anthropic", tier:"vendor_disclosure"} },

  // ── professional_services ──
  { id:"pwc", name:"PwC", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["openai"], summary:"Rolled out ChatGPT Enterprise to 100,000+ employees across the US, UK and Middle East and became OpenAI's first reseller.", cite:{title:"PwC to become OpenAI's first reseller and largest enterprise user", url:"https://www.cnbc.com/2024/05/29/pwc-to-become-openais-first-reseller-and-largest-enterprise-user.html", publisher:"CNBC", tier:"press", publishedAt:"2024-05-29"} },
  { id:"ey", name:"EY (Ernst & Young)", vertical:"professional_services", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Launched the EY.ai platform and its secure LLM 'EYQ' (a US$1.4bn investment), built on Microsoft Azure OpenAI.", cite:{title:"EY announces launch of AI platform EY.ai following US$1.4b investment", url:"https://www.ey.com/en_gl/newsroom/2023/09/ey-announces-launch-of-artificial-intelligence-platform-ey-ai-following-us-1-4b-investment", publisher:"EY", tier:"company_primary", publishedAt:"2023-09-13"} },
  { id:"deloitte", name:"Deloitte", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic","nvidia"], adoptions:2, summary:"Made Claude available to 470,000+ people globally (Anthropic's largest enterprise deployment) and launched 'Zora AI' agents built on the NVIDIA AI stack.", cite:{title:"Deloitte–Anthropic partnership", url:"https://www.anthropic.com/news/deloitte-anthropic-partnership", publisher:"Anthropic", tier:"vendor_disclosure", publishedAt:"2025-10-06"} },
  { id:"kpmg", name:"KPMG US", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["google"], summary:"Deployed Google Cloud's Gemini Enterprise firm-wide to 55,000+ US employees, with nearly 90% accessing the tool within two weeks.", cite:{title:"KPMG firmwide adoption of Gemini Enterprise", url:"https://kpmg.com/us/en/media/news/kpmg-firmwide-adoption-gemini-enterprise.html", publisher:"KPMG", tier:"company_primary", publishedAt:"2025-10-09"} },
  { id:"accenture", name:"Accenture", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic","nvidia"], adoptions:2, summary:"Formed the Accenture Anthropic Business Group (30,000 trained on Claude, Claude Code to tens of thousands of developers) and an NVIDIA Business Group.", cite:{title:"Accenture and Anthropic launch multi-year partnership", url:"https://newsroom.accenture.com/news/2025/accenture-and-anthropic-launch-multi-year-partnership-to-drive-enterprise-ai-innovation-and-value-across-industries", publisher:"Accenture", tier:"company_primary", publishedAt:"2025-12-09"} },
  { id:"mckinsey", name:"McKinsey & Company", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["openai","cohere","microsoft"], adoptions:2, summary:"Built its internal generative-AI platform 'Lilli' (used by ~72% of ~43,000 staff), running on OpenAI models via Microsoft Azure and on Cohere models.", cite:{title:"Consulting giant McKinsey unveils its own generative AI tool: Lilli", url:"https://venturebeat.com/ai/consulting-giant-mckinsey-unveils-its-own-generative-ai-tool-for-employees-lilli", publisher:"VentureBeat", tier:"press", publishedAt:"2023-08-18"} },
  { id:"bcg", name:"Boston Consulting Group", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["openai"], summary:"Nearly 90% of its ~33,000 employees use AI (about 50% daily); BCG says it has created more custom GPTs than any other OpenAI customer.", cite:{title:"OpenAI, Anthropic are turning consultants into an AI fight", url:"https://www.aol.com/articles/openai-anthropic-turning-consultants-fight-101401968.html", publisher:"Business Insider (via AOL)", tier:"press", publishedAt:"2026-03-03"} },
  { id:"bain", name:"Bain & Company", vertical:"professional_services", sizeBand:"global_enterprise", region:"north_america", vendorIds:["openai"], summary:"Expanded its global services alliance with OpenAI, establishing an internal OpenAI Center of Excellence.", cite:{title:"Bain & Company announces expanded partnership with OpenAI", url:"https://www.bain.com/about/media-center/press-releases/2024/bain-and-company-announces-expanded-partnership-with-openai-to-accelerate-delivery-of-ai-solutions-and-meet-fast-growing-client-needs/", publisher:"Bain & Company", tier:"company_primary", publishedAt:"2024-10-22"} },

  // ── manufacturing (new only) ──
  { id:"hyundai", name:"Hyundai Motor Group", vertical:"manufacturing", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["nvidia"], summary:"Deploying NVIDIA Omniverse Enterprise and Isaac Sim for factory digital twins, backed by an NVIDIA Blackwell AI factory (50,000 GPUs).", cite:{title:"Hyundai Motor Group AI factory with NVIDIA", url:"https://nvidianews.nvidia.com/news/hyundai-motor-group-ai-factory", publisher:"NVIDIA", tier:"vendor_disclosure", publishedAt:"2025-10-31"} },
  { id:"foxconn", name:"Foxconn (Hon Hai)", vertical:"manufacturing", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["nvidia"], summary:"Building AI factories and 3D digital twins of production lines on NVIDIA Omniverse with Isaac and Metropolis frameworks.", cite:{title:"NVIDIA partners with Foxconn to build factories and systems for the AI industrial revolution", url:"https://nvidianews.nvidia.com/news/nvidia-partners-with-foxconn-to-build-factories-and-systemsfor-the-ai-industrial-revolution", publisher:"NVIDIA", tier:"vendor_disclosure", publishedAt:"2023-10-17"} },
  { id:"schaeffler", name:"Schaeffler", vertical:"manufacturing", sizeBand:"enterprise", region:"europe", vendorIds:["nvidia","microsoft"], adoptions:2, summary:"Uses Siemens Industrial Copilot (built on Microsoft Azure OpenAI) for automation code, and NVIDIA's Mega Omniverse Blueprint to simulate material-handling robots.", cite:{title:"NVIDIA Omniverse physical-AI operating system expands to more industries and partners", url:"https://nvidianews.nvidia.com/news/nvidia-omniverse-physical-ai-operating-system-expands-to-more-industries-and-partners", publisher:"NVIDIA", tier:"vendor_disclosure", publishedAt:"2025-03-18"} },
  { id:"tsmc", name:"TSMC", vertical:"manufacturing", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["nvidia"], summary:"Deploying NVIDIA accelerated computing across its fabs — cuLitho for computational lithography plus Metropolis and TAO for defect detection.", cite:{title:"NVIDIA and TSMC bring AI into fabs to advance semiconductor design and manufacturing", url:"https://nvidianews.nvidia.com/news/nvidia-and-tsmc-bring-ai-into-fabs-to-advance-semiconductor-design-and-manufacturing", publisher:"NVIDIA", tier:"vendor_disclosure", publishedAt:"2026-05-31"} },
  { id:"rolls-royce", name:"Rolls-Royce", vertical:"manufacturing", sizeBand:"enterprise", region:"europe", vendorIds:["databricks"], summary:"Worked with Databricks (Mosaic AI) to train conditional-GAN generative models on legacy simulation data to accelerate aero-engine design.", cite:{title:"Rolls-Royce and Databricks Mosaic AI", url:"https://www.databricks.com/blog/rolls-royce-mosaic-ai", publisher:"Databricks", tier:"vendor_disclosure", publishedAt:"2024-08-08"} },
  { id:"michelin", name:"Michelin", vertical:"manufacturing", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Implemented Microsoft 365 Copilot and an in-house GenAI chatbot 'Aurora' powered by Azure OpenAI to boost employee productivity.", cite:{title:"AI-powered success: 1,000 stories of customer transformation and innovation", url:"https://www.microsoft.com/en-us/microsoft-cloud/blog/2025/07/24/ai-powered-success-with-1000-stories-of-customer-transformation-and-innovation/", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2025-07-24"} },
  { id:"sandvik", name:"Sandvik", vertical:"manufacturing", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Built a 'Manufacturing Copilot' on Azure OpenAI and Azure AI Search to give easy access to years of product documentation.", cite:{title:"AI-powered success: 1,000 stories of customer transformation and innovation", url:"https://www.microsoft.com/en-us/microsoft-cloud/blog/2025/07/24/ai-powered-success-with-1000-stories-of-customer-transformation-and-innovation/", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2025-07-24"} },
  { id:"toshiba", name:"Toshiba", vertical:"manufacturing", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["microsoft"], summary:"Deployed Microsoft 365 Copilot to 10,000 employees to optimize usage and effectiveness.", cite:{title:"AI-powered success: 1,000 stories of customer transformation and innovation", url:"https://www.microsoft.com/en-us/microsoft-cloud/blog/2025/07/24/ai-powered-success-with-1000-stories-of-customer-transformation-and-innovation/", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2025-07-24"} },
  { id:"volvo-group", name:"Volvo Group", vertical:"manufacturing", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft"], summary:"Built a solution on Azure AI services and Azure AI Document Intelligence to simplify document processing.", cite:{title:"AI-powered success: 1,000 stories of customer transformation and innovation", url:"https://www.microsoft.com/en-us/microsoft-cloud/blog/2025/07/24/ai-powered-success-with-1000-stories-of-customer-transformation-and-innovation/", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2025-07-24"} },

  // ── retail_consumer (new only) ──
  { id:"loreal", name:"L'Oréal Groupe", vertical:"retail_consumer", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai","nvidia"], adoptions:2, summary:"Built 'Beauty Genius' on Microsoft Azure OpenAI Service and is scaling its 'CREAITECH' generative-AI content platform on NVIDIA AI Enterprise.", cite:{title:"L'Oréal — Azure OpenAI customer story (Beauty Genius)", url:"https://www.microsoft.com/en/customers/story/25570-loreal-azure-openai", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2025-10-29"} },
  { id:"rakuten", name:"Rakuten", vertical:"retail_consumer", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["anthropic"], summary:"Deployed Claude Managed Agents across product, sales, marketing and finance, and uses Claude Code for software development.", cite:{title:"Rakuten — Anthropic customer story", url:"https://claude.com/customers/rakuten", publisher:"Anthropic", tier:"vendor_disclosure"} },
  { id:"intuit", name:"Intuit", vertical:"retail_consumer", sizeBand:"enterprise", region:"north_america", vendorIds:["anthropic","aws"], summary:"Integrated Anthropic's Claude (via Amazon Bedrock) into TurboTax and announced a multi-year partnership for custom Claude-based AI agents.", cite:{title:"Intuit and Anthropic partner to bring trusted financial intelligence and custom AI agents", url:"https://investors.intuit.com/news-events/press-releases/detail/1305/intuit-and-anthropic-partner-to-bring-trusted-financial-intelligence-and-custom-ai-agents-to-consumers-and-businesses", publisher:"Intuit", tier:"company_primary"} },

  // ── telecom_media (new only) ──
  { id:"telus", name:"TELUS", vertical:"telecom_media", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Launched a customer-facing GenAI support tool via its Fuel iX engine + Microsoft Azure OpenAI; answered 50,000+ queries with +28% info-find rate.", cite:{title:"TELUS unveils GenAI customer support tool powered by Fuel iX and Microsoft Azure OpenAI Service", url:"https://www.newswire.ca/news-releases/telus-unveils-genai-customer-support-tool-powered-by-fuel-ix-and-microsoft-azure-openai-service-to-enhance-customer-experience-879815483.html", publisher:"TELUS (Newswire.ca)", tier:"company_primary", publishedAt:"2024-05-06"} },
  { id:"sk-telecom", name:"SK Telecom", vertical:"telecom_media", sizeBand:"global_enterprise", region:"asia_pacific", vendorIds:["anthropic","openai"], adoptions:2, summary:"Invested $100M in Anthropic to fine-tune Claude into a telco-specific LLM, and formed an exclusive B2C partnership with OpenAI for its subscribers.", cite:{title:"SK Telecom partnership announcement", url:"https://www.anthropic.com/news/skt-partnership-announcement", publisher:"Anthropic", tier:"vendor_disclosure", publishedAt:"2023-08-15"} },

  // ── public_sector ──
  { id:"uk-ministry-of-justice", name:"UK Ministry of Justice", vertical:"public_sector", sizeBand:"global_enterprise", region:"europe", vendorIds:["openai"], summary:"Adopted ChatGPT Enterprise for 2,500 civil servants — the first UK department to use OpenAI's UK data residency — after a time-saving pilot.", cite:{title:"Ministry of Justice adopts ChatGPT Enterprise", url:"https://www.theregister.com/2025/10/24/ministry_of_justice_chatgpt/", publisher:"The Register", tier:"press", publishedAt:"2025-10-24"} },
  { id:"us-federal-government", name:"US Federal Government (GSA OneGov)", vertical:"public_sector", sizeBand:"global_enterprise", region:"north_america", vendorIds:["anthropic"], summary:"Via a GSA OneGov agreement, Anthropic offered Claude for Enterprise and Claude for Government (FedRAMP High) to all three branches for $1.", cite:{title:"Anthropic offers Claude to government agencies via GSA OneGov", url:"https://fedscoop.com/anthropic-government-agencies-onegov-general-services-administration-artificial-intelligence/", publisher:"FedScoop", tier:"press", publishedAt:"2025-08-12"} },
  { id:"uk-government-gds", name:"UK Government (cross-department)", vertical:"public_sector", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft"], summary:"A cross-department trial of Microsoft 365 Copilot across 20,000+ civil servants saved an average 26 minutes/day — nearly two weeks per person per year.", cite:{title:"Landmark government trial shows AI could save civil servants nearly 2 weeks a year", url:"https://www.gov.uk/government/news/landmark-government-trial-shows-ai-could-save-civil-servants-nearly-2-weeks-a-year", publisher:"UK Dept for Science, Innovation and Technology", tier:"company_primary", publishedAt:"2025-06-02"} },

  // ── education ──
  { id:"california-state-university", name:"California State University", vertical:"education", sizeBand:"global_enterprise", region:"north_america", vendorIds:["openai"], summary:"Deployed ChatGPT Edu to 460,000+ students and 63,000+ faculty/staff across 23 campuses — described as the largest single ChatGPT implementation.", cite:{title:"California State University to become first AI-powered university system in US with OpenAI", url:"https://news.csun.edu/uncategorized/california-state-university-to-become-first-ai-powered-university-system-in-us-with-openai/", publisher:"California State University", tier:"company_primary", publishedAt:"2025-02-04"} },
  { id:"arizona-state-university", name:"Arizona State University", vertical:"education", sizeBand:"enterprise", region:"north_america", vendorIds:["openai"], summary:"First university to deploy ChatGPT at an enterprise level, activating 200+ projects across the majority of its colleges.", cite:{title:"Arizona State University and OpenAI", url:"https://openai.com/index/asu/", publisher:"OpenAI", tier:"vendor_disclosure", publishedAt:"2024-01-18"} },

  // ── energy_utilities (new only) ──
  { id:"enerjisa-uretim", name:"Enerjisa Üretim", vertical:"energy_utilities", sizeBand:"enterprise", region:"mea", vendorIds:["microsoft","openai"], summary:"Built 'OnePact AI' on Azure OpenAI Service to query IoT/operational data across 20+ hydro, wind and solar plants.", cite:{title:"Enerjisa Üretim — Azure OpenAI customer story", url:"https://www.microsoft.com/en/customers/story/1711956075760053884-enerjisauretim-azure-energy-en-turkiye", publisher:"Microsoft", tier:"vendor_disclosure"} },
  { id:"eaton", name:"Eaton", vertical:"energy_utilities", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft"], summary:"Used Microsoft 365 Copilot to document ~9,000 standard operating procedures, cutting time per SOP from ~1 hour to ~10 minutes.", cite:{title:"Eaton — Microsoft 365 Copilot customer story", url:"https://www.microsoft.com/en/customers/story/19830-eaton-microsoft-365-copilot", publisher:"Microsoft", tier:"vendor_disclosure"} },
  { id:"national-grid", name:"National Grid", vertical:"energy_utilities", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft"], summary:"Using Microsoft Copilot and Azure to automate document management, report generation and regulatory/finance/legal workflows.", cite:{title:"Enlit Europe 2024: rewiring the energy industry's operational core with cloud and AI", url:"https://www.microsoft.com/en-us/microsoft-cloud/blog/energy-and-resources/2024/10/17/enlit-europe-2024-rewiring-the-energy-industrys-operational-core-with-cloud-and-ai/", publisher:"Microsoft Cloud Blog", tier:"vendor_disclosure", publishedAt:"2024-10-17"} },
  { id:"edf", name:"EDF", vertical:"energy_utilities", sizeBand:"global_enterprise", region:"europe", vendorIds:["mistral"], summary:"Named a launch customer of 'Mistral for Industrial Engineering' for engineering/simulation applications in the energy sector.", cite:{title:"Mistral physical AI: Airbus, BMW industrial launch", url:"https://thenextweb.com/news/mistral-physical-ai-airbus-bmw-industrial-launch", publisher:"The Next Web", tier:"press", publishedAt:"2026-05-28"} },
  { id:"itron", name:"Itron", vertical:"energy_utilities", sizeBand:"enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Integrated Microsoft Azure OpenAI Service so utility users can query strategic datasets in natural language for decision-making.", cite:{title:"Itron to integrate Microsoft Azure OpenAI Service to empower utilities", url:"https://investors.itron.com/news-releases/news-release-details/itron-integrate-microsoft-azure-openai-service-empower-utility", publisher:"Itron", tier:"company_primary", publishedAt:"2024-02-01"} },

  // ── transport_logistics ──
  { id:"cma-cgm", name:"CMA CGM Group", vertical:"transport_logistics", sizeBand:"global_enterprise", region:"europe", vendorIds:["mistral"], summary:"Signed a 5-year, €100m partnership with Mistral AI for custom AI across cargo release, shipping-document processing, claims and customer requests.", cite:{title:"CMA CGM Group adopts custom-designed AI solutions with Mistral AI", url:"https://www.cmacgm-group.com/en/news-media/cma-cgm-group-adopts-custom-designed-ai-solutions-mistral-ai", publisher:"CMA CGM Group", tier:"company_primary", publishedAt:"2025-04-08"} },
  { id:"ch-robinson", name:"C.H. Robinson", vertical:"transport_logistics", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Built generative-AI agents on Microsoft Azure AI Foundry / Azure OpenAI to automate emailed price quotes, load tenders and scheduling (2,600 quotes/day).", cite:{title:"C.H. Robinson brings generative AI to the freight shipment lifecycle", url:"https://www.chrobinson.com/en-us/about-us/newsroom/press-releases/2024/generative-ai-for-freight-shipment-lifecycle/", publisher:"C.H. Robinson", tier:"company_primary", publishedAt:"2024-10-31"} },
  { id:"alstom", name:"Alstom", vertical:"transport_logistics", sizeBand:"global_enterprise", region:"europe", vendorIds:["microsoft","openai"], summary:"Deployed Azure OpenAI Service to validate and auto-generate engineering specifications, reporting a 25% quality improvement.", cite:{title:"Alstom — Azure OpenAI Service customer story", url:"https://www.microsoft.com/en/customers/story/1779144753409953376-alstom-azure-openai-service-travel-and-transportation-en-france", publisher:"Microsoft", tier:"vendor_disclosure", publishedAt:"2024-06-13"} },
  { id:"air-india", name:"Air India", vertical:"transport_logistics", sizeBand:"enterprise", region:"asia_pacific", vendorIds:["microsoft","openai"], summary:"Deployed 'AI.g', a generative-AI virtual agent on Azure OpenAI Service (GPT-4 + RAG), handling 30,000+ daily customer queries and automating ~97% of interactions.", cite:{title:"Air India successfully deploys airline industry's first generative AI virtual agent", url:"https://www.airindia.com/in/en/newsroom/press-release/air-india-successfully-deploys-airline-industry-s-first-generati.html", publisher:"Air India", tier:"company_primary"} },
  { id:"air-france-klm", name:"Air France-KLM", vertical:"transport_logistics", sizeBand:"global_enterprise", region:"europe", vendorIds:["google"], summary:"Launched a 'generative AI factory' with Accenture and Google Cloud to accelerate AI adoption across the group.", cite:{title:"Aviation's operational AI revolution (Air France-KLM GenAI factory)", url:"https://www.travelandtourworld.com/news/article/lufthansa-group-joins-air-france-klm-emirates-american-airlines-and-delta-air-lines-as-ai-sparks-aviations-biggest-operational-revolution-in-modern-history-exclusive/", publisher:"Travel And Tour World", tier:"press"} },

  // ── real_estate ──
  { id:"cushman-wakefield", name:"Cushman & Wakefield", vertical:"real_estate", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Partnered with Microsoft to deploy Azure OpenAI Service and Copilot for Microsoft 365 to its brokers for custom copilots and productivity.", cite:{title:"Cushman & Wakefield collaborates with Microsoft to enhance AI technology platform", url:"https://www.cushmanwakefield.com/en/news/2024/01/cushman-and-wakefield-collaborates-with-microsoft-to-enhance-ai-technology-platform", publisher:"Cushman & Wakefield", tier:"company_primary", publishedAt:"2024-01-01"} },
  { id:"jll", name:"JLL (Jones Lang LaSalle)", vertical:"real_estate", sizeBand:"global_enterprise", region:"north_america", vendorIds:["microsoft","openai"], summary:"Built 'JLL GPT', a proprietary commercial-real-estate LLM on Microsoft Azure, and the JLL Falcon analytics platform used by 47,000+ professionals.", cite:{title:"JLL Falcon kicks off new era of AI-powered CRE innovation", url:"https://www.jll.com/en-us/newsroom/jll-falcon-kicks-off-new-era-of-ai-powered-cre-innovation", publisher:"JLL", tier:"company_primary", publishedAt:"2024-10-29"} },

  // ── aerospace_defence ──
  { id:"lockheed-martin", name:"Lockheed Martin", vertical:"aerospace_defence", sizeBand:"global_enterprise", region:"north_america", vendorIds:["nvidia"], summary:"Deployed an internal generative-AI 'AI Factory' running on NVIDIA DGX SuperPOD, used by 8,000+ engineers (the foundation model is Lockheed-internal; NVIDIA is the compute).", cite:{title:"Empowering innovation with secure generative AI across the enterprise", url:"https://www.lockheedmartin.com/en-us/news/features/2024/empowering-innovation-with-secure-generative-ai-across-enterprise.html", publisher:"Lockheed Martin", tier:"company_primary", publishedAt:"2024-10-08"} },
  { id:"airbus", name:"Airbus", vertical:"aerospace_defence", sizeBand:"global_enterprise", region:"europe", vendorIds:["mistral"], summary:"Named a launch customer of 'Mistral for Industrial Engineering' for aerospace engineering-simulation applications.", cite:{title:"Mistral physical AI: Airbus, BMW industrial launch", url:"https://thenextweb.com/news/mistral-physical-ai-airbus-bmw-industrial-launch", publisher:"The Next Web", tier:"press", publishedAt:"2026-05-28"} },
];

// ── TRANSFORM + VALIDATE ────────────────────────────────────────────────────
const errors = [];
const seen = new Set();
const notDisclosed = (kind) => ({ kind, status: "not_disclosed", citations: [] });

const companies = RAW.map((r) => {
  const adoptions = r.adoptions ?? 1;
  // validation
  if (!INDUSTRY[r.vertical]) errors.push(`${r.id}: unknown vertical ${r.vertical}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) errors.push(`${r.id}: bad id slug`);
  if (EXISTING.has(r.id)) errors.push(`${r.id}: COLLIDES with an existing peer-adoption-data id`);
  if (seen.has(r.id)) errors.push(`${r.id}: duplicate within sourced set`);
  seen.add(r.id);
  if (!Array.isArray(r.vendorIds) || r.vendorIds.length === 0) errors.push(`${r.id}: no vendorIds`);
  for (const v of r.vendorIds) if (!TRACKED.has(v)) errors.push(`${r.id}: UNTRACKED vendor ${v}`);
  if (!/^https:\/\/.+/.test(r.cite.url)) errors.push(`${r.id}: cite url not https`);
  if (!["company_primary","vendor_disclosure","press","analyst_index"].includes(r.cite.tier)) errors.push(`${r.id}: bad tier ${r.cite.tier}`);
  if ((r.summary ?? "").length <= 20) errors.push(`${r.id}: summary too short`);

  const cite = { title: r.cite.title, url: r.cite.url, publisher: r.cite.publisher, tier: r.cite.tier };
  if (r.cite.publishedAt) cite.publishedAt = r.cite.publishedAt;

  return {
    id: r.id,
    name: r.name,
    industry: INDUSTRY[r.vertical],
    segment: { vertical: r.vertical, sizeBand: r.sizeBand, region: r.region },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        rubricBasis: { adoptions },
        level: band(adoptions),
        summary: r.summary,
        citations: [cite],
        vendorIds: r.vendorIds,
      },
      notDisclosed("talent_exposure"),
      notDisclosed("patent_velocity"),
      notDisclosed("product_footprint"),
      notDisclosed("automation_intensity"),
    ],
  };
});

if (errors.length) {
  console.error("VALIDATION FAILED:\n" + errors.join("\n"));
  process.exit(1);
}

// segment coverage report
const byVertical = {};
for (const c of companies) byVertical[c.segment.vertical] = (byVertical[c.segment.vertical] ?? 0) + 1;

// ── EMIT TS ─────────────────────────────────────────────────────────────────
const header = `// Peer-AI-adoption SOURCED dataset — 16-vertical expansion (compiled 2026-07-12).
// ────────────────────────────────────────────────────────────────────────────
// GENERATED by scripts/gen-sourced-peers.mjs from cited web research — do not
// hand-edit; re-run the generator to change. Same honesty contract as
// peer-adoption-data.ts (its HARD RULES + rubric apply, enforced by the same
// peer-adoption-data.test.ts over the merged PEER_COMPANIES array):
//   • platform_integration is the ONE disclosed, cited adoption per company;
//     its band is computed from rubricBasis.adoptions (never analyst-assigned).
//   • the other four signals are not_disclosed — we sourced ADOPTION evidence
//     only and under-claim rather than invent talent/patent/product/automation.
//   • every citation is a real, fetched https source; vendorIds are tracked ids.
// This closes the empty verticals (healthcare, legal, professional services,
// education, public sector, transport, real estate, aerospace) with named,
// publicly-disclosed exemplars — SMB stays represented by segment stats, not
// invented named adopters (disclosed adopters skew enterprise).
import type { PeerCompany } from "./types";

export const SOURCED_PEER_DATASET_SOURCE =
  "Analyst-curated · 16-vertical cited web research, 2026-07-12";

export const SOURCED_PEER_COMPANIES: PeerCompany[] = `;

const body = JSON.stringify(companies, null, 2)
  // tighten the not_disclosed signals onto single lines for readability
  .replace(/\{\n\s+"kind": "(talent_exposure|patent_velocity|product_footprint|automation_intensity)",\n\s+"status": "not_disclosed",\n\s+"citations": \[\]\n\s+\}/g,
           '{ "kind": "$1", "status": "not_disclosed", "citations": [] }');

const out = header + body + ";\n";
const target = process.argv[2];
writeFileSync(target, out);
console.log(`WROTE ${companies.length} sourced peer companies → ${target}`);
console.log("Coverage by vertical:");
for (const [v, n] of Object.entries(byVertical).sort((a,b)=>b[1]-a[1])) console.log(`  ${v}: ${n}`);
