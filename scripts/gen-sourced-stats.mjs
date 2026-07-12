// Generator: cited, ANONYMISED (size + industry) segment adoption stats — the
// demand-side "multiple examples per category" layer (owner-approved 2026-07-12:
// anonymised size+industry sources are welcome; every one still traces to a real
// cited survey — no invented rows). Emits SOURCED_VERTICAL_STATS which is merged
// into VERTICAL_STATS so composeBenchmark stacks these under "Your vertical" and
// segments.test.ts guards them (https url, fit note, headline length).
import { writeFileSync } from "node:fs";

const VERTS = new Set(["financial_services","insurance","healthcare","pharma_life_sciences","legal","professional_services","technology_software","manufacturing","retail_consumer","telecom_media","public_sector","education","energy_utilities","transport_logistics","real_estate","aerospace_defence"]);
const KINDS = new Set(["adoption_rate","maturity","use_case","platform_share","investment","other"]);

// { v: vertical, k: kind, h: headline, src: [title, publisher, url, surveyDate], fit: segmentFitNote }
const RAW = [
  // ── financial_services ──
  { v:"financial_services", k:"adoption_rate", h:"The 50 largest banks tracked by the Evident AI Index now employ more than 90,000 people on AI, up from 70,000 a year earlier — AI headcount growth of over 25%.", src:["Here's the 2025 Evident AI Index","Evident Insights","https://evidentinsights.com/bankingbrief/heres-the-2025-evident-ai-index/","2025-10-08"], fit:"50 largest global banks only; excludes SMB/mid-market financial firms, insurers and most fintech." },
  { v:"financial_services", k:"use_case", h:"Across the 50 largest financial firms, more than half now leverage generative AI, but only 15 of 97 deployed gen-AI use cases are client-facing without a human intermediary — the large majority remain internal.", src:["Banks accelerate AI deployments as agentic tools gain traction","CIO Dive (reporting Evident Insights)","https://www.ciodive.com/news/banks-accelerate-ai-adoption-agentic-automation-evident-insights/757463/","2025-08-12"], fit:"50 largest global banks only; disclosed-use-case counts, not an industry-wide adoption rate." },

  // ── insurance ──
  { v:"insurance", k:"adoption_rate", h:"76% of insurers say they have already implemented generative AI in one or more business functions.", src:["Scaling gen AI in insurance","Deloitte Insights","https://www.deloitte.com/us/en/insights/industry/financial-services/scaling-gen-ai-insurance.html","2024-06"], fit:"200 US insurance executives (100 Life & Annuity, 100 P&C); US-only; 'implemented in ≥1 function' is a low bar." },
  { v:"insurance", k:"adoption_rate", h:"82% of Life & Annuity insurers report implementing generative AI in one or more functions, versus 70% of Property & Casualty insurers.", src:["Scaling gen AI in insurance","Deloitte Insights","https://www.deloitte.com/us/en/insights/industry/financial-services/scaling-gen-ai-insurance.html","2024-06"], fit:"Same 200-exec US survey; split by insurance line, not company size." },

  // ── healthcare ──
  { v:"healthcare", k:"adoption_rate", h:"In a survey of 2,174 US nonfederal hospitals, 31.5% reported using generative AI integrated with their EHR in 2024, and 24.7% planned to within a year.", src:["Uptake of Generative AI Integrated With Electronic Health Records in US Hospitals","JAMA Network / ASTP-ONC (via NCBI PMC)","https://pmc.ncbi.nlm.nih.gov/articles/PMC12701511/","2024"], fit:"US nonfederal acute-care hospitals (providers only, EHR-integrated gen AI); excludes payers and non-EHR use." },
  { v:"healthcare", k:"adoption_rate", h:"71% of US nonfederal acute-care hospitals reported using predictive AI integrated with their EHR in 2024, up from 66% in 2023.", src:["Hospital Trends in the Use, Evaluation, and Governance of Predictive AI, 2023-2024","ASTP/ONC (HealthIT.gov)","https://healthit.gov/data/data-briefs/hospital-trends-use-evaluation-and-governance-predictive-ai-2023-2024/","2024"], fit:"Predictive (not generative) AI; EHR-integrated use at US acute-care hospitals only." },
  { v:"healthcare", k:"adoption_rate", h:"Predictive-AI adoption is highly uneven by scale: 86% of hospitals in multi-hospital systems used it in 2024 versus 37% of independent hospitals (urban 81% vs rural 56%).", src:["Hospital Trends in the Use, Evaluation, and Governance of Predictive AI, 2023-2024","ASTP/ONC (HealthIT.gov)","https://healthit.gov/wp-content/uploads/2025/09/Data-Brief-80-Hospital-Trends-in-the-Use-Evaluation-and-Governance-of-Predictive-AI-2023-2024_508.pdf","2024"], fit:"System-affiliation and urban/rural are a proxy for size/resources, not exact revenue bands; predictive AI, providers only." },
  { v:"healthcare", k:"adoption_rate", h:"66% of US physicians reported using AI in their practice in 2024, up from 38% in 2023.", src:["2 in 3 physicians are using health AI — up 78% from 2023","American Medical Association","https://www.ama-assn.org/practice-management/digital-health/2-3-physicians-are-using-health-ai-78-2023","2024"], fit:"Physician-level self-report across all settings; individual use of any AI, broader than enterprise deployment." },

  // ── pharma_life_sciences ──
  { v:"pharma_life_sciences", k:"maturity", h:"In a 2024 survey of 100+ pharma and medtech leaders, all had experimented with generative AI and 32% had taken steps to scale it, but only 5% said they had realised it as a competitive differentiator generating consistent value.", src:["Scaling gen AI in the life sciences industry","McKinsey & Company","https://www.mckinsey.com/industries/life-sciences/our-insights/scaling-gen-ai-in-the-life-sciences-industry","2024"], fit:"Pharma + medtech senior executives; skews to larger organisations; medtech included alongside pharma." },
  { v:"pharma_life_sciences", k:"adoption_rate", h:"More than 90% of biopharma and medtech respondents expected generative AI to impact their organisation within a year, and roughly two-thirds were already experimenting with it.", src:["Generative AI to Reshape the Future of Life Sciences","Deloitte","https://www.deloitte.com/us/en/insights/industry/health-care/life-sciences-and-health-care-industry-outlooks/2025-life-sciences-executive-outlook.html","2024"], fit:"Biopharma + medtech executives; forward-looking expectation is a sentiment measure, not confirmed deployment." },
  { v:"pharma_life_sciences", k:"investment", h:"93% of large life-sciences companies anticipated increasing data, digital and AI investment for 2025, with on average roughly a third of employees per department holding company-approved gen-AI access.", src:["2025 AI trends: Life sciences leaders on data, digital and AI","ZS Associates","https://www.zs.com/insights/2025-survey-data-digital-ai","2025"], fit:"127 technology executives at large multinational life-sciences firms; 'approved access' measures availability, not active use; excludes SMB." },

  // ── legal ──
  { v:"legal", k:"adoption_rate", h:"26% of legal organisations are now actively using generative AI, up from 14% in 2024; 78% of law-firm respondents expect it to become central to their workflow within five years.", src:["2025 Generative AI in Professional Services Report","Thomson Reuters Institute","https://www.thomsonreuters.com/en/reports/2025-generative-ai-in-professional-services-report","2025-04"], fit:"1,702 professionals across legal/tax/accounting/risk; legal ~41% of respondents; not firm-size-specific." },
  { v:"legal", k:"adoption_rate", h:"30% of law firms reported using AI-based tools, but adoption is 46% at firms of 100+ attorneys versus 30% at 10–49-lawyer firms and 18% among solo practitioners.", src:["2024 Artificial Intelligence TechReport (ABA Legal Technology Survey)","American Bar Association","https://www.americanbar.org/groups/law_practice/resources/tech-report/2024/2024-artificial-intelligence-techreport/","2024"], fit:"US law firms only, self-selected ABA respondents; measures AI-based tools broadly, not solely gen AI — the best available firm-size split." },
  { v:"legal", k:"adoption_rate", h:"68% of legal professionals in law firms and 76% in corporate legal departments use generative AI at least once a week.", src:["2024 Future Ready Lawyer Survey Report","Wolters Kluwer","https://www.wolterskluwer.com/en/news/future-ready-lawyer-2024-report","2024"], fit:"712 lawyers across the US and nine European countries; clean firm vs corporate-legal split but no firm-size breakdown." },

  // ── professional_services ──
  { v:"professional_services", k:"maturity", h:"77% of professionals believe AI will have a high or transformational impact on their work over the next five years, and predict it will free up about 12 hours per week within five years.", src:["Future of Professionals Report 2024","Thomson Reuters Institute","https://www.thomsonreuters.com/content/dam/ewp-m/documents/thomsonreuters/en/pdf/reports/future-of-professionals-report-2024.pdf","2024"], fit:"2,200+ legal/tax/risk/compliance professionals; a proxy for advisory PS, not the full consulting/staffing/marketing spread." },
  { v:"professional_services", k:"adoption_rate", h:"Just 14% of tax-firm professionals said their firm has a defined AI strategy in place, and only 13% use any form of AI to answer client questions.", src:["Future of Professionals Report 2024","Thomson Reuters Institute","https://www.thomsonreuters.com/content/dam/ewp-m/documents/thomsonreuters/en/pdf/reports/future-of-professionals-report-2024.pdf","2024"], fit:"Tax & accounting firms (a subset of professional services); does not cover consulting, advisory or staffing." },

  // ── technology_software ──
  { v:"technology_software", k:"adoption_rate", h:"84% of developers are using or planning to use AI tools in their development process, up from 76% in 2024.", src:["2025 Stack Overflow Developer Survey — AI","Stack Overflow","https://survey.stackoverflow.co/2025/ai/","2025"], fit:"~49,000 self-selected developers worldwide; respondent-level, not firm-level, and skews to Stack Overflow users." },
  { v:"technology_software", k:"platform_share", h:"Anthropic earns an estimated 40% of enterprise LLM spend (up from 24%), overtaking OpenAI at 27%, with Google at 21%; total enterprise generative-AI spend reached $37B in 2025.", src:["2025: The State of Generative AI in the Enterprise","Menlo Ventures","https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/","2025"], fit:"Survey of 495 US enterprise AI decision-makers; cross-industry, not tech-sector-isolated." },
  { v:"technology_software", k:"adoption_rate", h:"73% of open-source developer respondents said they use AI tools like GitHub Copilot for coding or documentation.", src:["Octoverse 2024","GitHub","https://github.blog/news-insights/octoverse/octoverse-2024/","2024"], fit:"Open-source contributors surveyed by GitHub — a subset of developers; respondent-level, not enterprise adoption." },

  // ── manufacturing ──
  { v:"manufacturing", k:"adoption_rate", h:"95% of manufacturers have invested in, or plan to invest in, AI/ML over the next five years, and 50% plan to apply AI/ML to product quality in 2025.", src:["10th annual State of Smart Manufacturing Report","Rockwell Automation (with Sapio Research)","https://www.rockwellautomation.com/en-us/company/news/press-releases/Ninety-Five-Percent-of-Manufacturers-Are-Investing-in-AI-to-Navigate-Uncertainty-and-Accelerate-Smart-Manufacturing.html","2025-03"], fit:"1,560 manufacturers across 17 countries, $100M–$30B+ revenue; skews mid-to-large industrials, under-represents true SMB." },
  { v:"manufacturing", k:"adoption_rate", h:"24% of manufacturers have deployed generative AI at the facility or network level and 38% are piloting it.", src:["2025 Smart Manufacturing and Operations Survey","Deloitte","https://www.deloitte.com/us/en/about/press-room/deloitte-2025-smart-manufacturing-survey.html","2024-08"], fit:"600 US manufacturing executives at $500M+/1,000+ employee firms; large-enterprise, US-centric; facility-level is a strict bar." },

  // ── retail_consumer ──
  { v:"retail_consumer", k:"adoption_rate", h:"38% of retail and consumer-products organisations are piloting agentic AI solutions, but only 11% have AI agents in production.", src:["Get to green light with GenAI: Retail and consumer brands","Deloitte Digital","https://www.deloittedigital.com/us/en/insights/perspective/genai-greenlight-retail-consumer-products.html","2025"], fit:"Vendor-neutral supply-side view of retail/CP organisations; 'agentic' is a subset of gen-AI, so understates overall use." },
  { v:"retail_consumer", k:"use_case", h:"33% of surveyed US consumers plan to use generative AI in their 2025 holiday shopping journey — more than double the 2024 figure (Gen Z 43%).", src:["2025 Deloitte Holiday Retail Survey","Deloitte Insights","https://www.deloitte.com/us/en/insights/industry/retail-distribution/holiday-retail-sales-consumer-survey.html","2025"], fit:"US consumer (demand-side) survey of ~4,000 shoppers; measures shopper intent, not retailer adoption of a vendor." },

  // ── telecom_media ──
  { v:"telecom_media", k:"adoption_rate", h:"Media & telecommunications is among the industries most likely (alongside technology) to report AI use, with AI agents most applied in service operations (~16%).", src:["The State of AI in 2025","McKinsey & Company (QuantumBlack)","https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai","2025"], fit:"Global cross-industry survey; 'media & telecommunications' is a combined sector, so not pure-play telecom." },

  // ── public_sector ──
  { v:"public_sector", k:"adoption_rate", h:"Among UK public-service professionals, 45% were aware of colleagues using generative AI and 22% use it themselves, with trust in gen AI high (61%).", src:["Generative AI is already widespread in the public sector","The Alan Turing Institute","https://www.turing.ac.uk/news/publications/generative-ai-already-widespread-public-sector","2024"], fit:"UK public servants in education/health/social work/emergency services; not vendor-specific, skewed to frontline roles." },
  { v:"public_sector", k:"adoption_rate", h:"In a UK cross-department trial, Microsoft 365 Copilot saved 20,000+ civil servants an average of 26 minutes per working day (nearly two weeks per person per year).", src:["Landmark government trial shows AI could save civil servants nearly 2 weeks a year","UK Dept for Science, Innovation and Technology (GOV.UK)","https://www.gov.uk/government/news/landmark-government-trial-shows-ai-could-save-civil-servants-nearly-2-weeks-a-year","2025-06"], fit:"Self-reported time-savings from a single-vendor trial in UK central government; a productivity measure, not an adoption rate." },

  // ── education ──
  { v:"education", k:"adoption_rate", h:"92% of UK undergraduates now report using an AI tool (up from 66% a year earlier), and 88% have used gen-AI tools like ChatGPT for assessments (up from 53%).", src:["Student Generative AI Survey 2025","Higher Education Policy Institute (HEPI) / Kortext","https://www.hepi.ac.uk/reports/student-generative-ai-survey-2025/","2025"], fit:"UK undergraduate students only (n=1,041); measures student usage, not institutional deployment of a vendor." },
  { v:"education", k:"adoption_rate", h:"57% of higher-education institutions now consider AI a strategic priority (up from 49% a year earlier); 54% use AI for curriculum design and 52% to automate administrative workflows.", src:["2025 EDUCAUSE AI Landscape Study","EDUCAUSE","https://www.educause.edu/research/2025/2025-educause-ai-landscape-study","2024-11"], fit:"Mostly US higher-ed institutional respondents; self-reported strategic posture and use-cases, not vendor-specific counts." },

  // ── energy_utilities (directional — labelled) ──
  { v:"energy_utilities", k:"use_case", h:"A Total Economic Impact study found genAI increased contact-centre agent productivity 14%, with projected content-generation time savings of 30–60% and call-deflection improvements of 20–50% for energy & utilities using Azure OpenAI Service.", src:["Using Microsoft Azure OpenAI Service To Transform Customer Engagement For Energy And Utilities Companies (Total Economic Impact)","Forrester Research (commissioned by Microsoft)","https://tei.forrester.com/go/microsoft/AzureOpenAIEnergy/?lang=en-us","2024-07"], fit:"Vendor-commissioned (Microsoft-funded) TEI — directional and favourably biased; specific to contact-centre use cases, not whole-sector adoption." },

  // ── transport_logistics (directional — labelled) ──
  { v:"transport_logistics", k:"adoption_rate", h:"78% of large logistics organisations have at least one generative-AI deployment in production across operations.", src:["Logistics management is leveling up with generative AI","Supply Chain Dive","https://www.supplychaindive.com/news/logistics-genai-natural-language-tms/757957/","2025"], fit:"Trade-press figure without a fully-published underlying methodology — directional; large logistics organisations only, not SMB." },

  // ── real_estate ──
  { v:"real_estate", k:"adoption_rate", h:"About 90% of companies expect to carry out corporate real-estate activities with AI supporting human experts within five years, and over 60% have already started piloting AI in their real-estate functions.", src:["Artificial intelligence and its implications for real estate (Future of Work survey)","JLL Research","https://www.jll.com/en-sea/insights/artificial-intelligence-and-its-implications-for-real-estate","2024"], fit:"Corporate real-estate occupiers/decision-makers; measures intent/piloting, and JLL is an interested party (sells CRE AI tools)." },

  // ── aerospace_defence (blended metric — labelled) ──
  { v:"aerospace_defence", k:"adoption_rate", h:"81% of aerospace & defence respondents said they are already using or plan to use AI/ML, and US A&D spending on AI and generative AI is forecast to reach $5.8B by 2029.", src:["2026 Aerospace and Defense Industry Outlook","Deloitte Insights (spend forecast attributed to IDC)","https://www.deloitte.com/us/en/insights/industry/aerospace-defense/aerospace-and-defense-industry-outlook.html","2025"], fit:"81% blends 'already using' with 'plan to use', so it overstates current deployment; the $5.8B/2029 figure is an IDC forecast, modelled." },
];

// validate + group by vertical
const errors = [];
const byV = {};
for (const r of RAW) {
  if (!VERTS.has(r.v)) errors.push(`bad vertical ${r.v}`);
  if (!KINDS.has(r.k)) errors.push(`${r.v}: bad kind ${r.k}`);
  if ((r.h ?? "").length <= 20) errors.push(`${r.v}: headline too short: ${r.h}`);
  if (!/^https:\/\/.+/.test(r.src[2])) errors.push(`${r.v}: bad url ${r.src[2]}`);
  if ((r.src[1] ?? "").length === 0) errors.push(`${r.v}: empty publisher`);
  if ((r.src[3] ?? "").length === 0) errors.push(`${r.v}: empty surveyDate`);
  if ((r.fit ?? "").length <= 5) errors.push(`${r.v}: fit note too short`);
  (byV[r.v] ??= []).push({
    kind: r.k, headline: r.h,
    source: { title: r.src[0], publisher: r.src[1], url: r.src[2], surveyDate: r.src[3] },
    segmentFitNote: r.fit,
  });
}
if (errors.length) { console.error("VALIDATION FAILED:\n"+errors.join("\n")); process.exit(1); }

const header = `// Segment-level SOURCED stats — anonymised (size + industry) cohort adoption
// evidence, compiled 2026-07-12 (owner-approved: anonymised size+industry
// sources welcome; every one still traces to a real cited survey — no invented
// rows). GENERATED by scripts/gen-sourced-stats.mjs. Merged into VERTICAL_STATS
// so composeBenchmark stacks these under "Your vertical" and segments.test.ts
// guards each (https source url, fit note, headline length). Directional or
// vendor-commissioned figures are kept but LABELLED in the fit note.
import type { IndustryTag } from "../use-cases";
import type { SegmentStat } from "./segment-benchmarks";

export const SOURCED_VERTICAL_STATS: Partial<Record<IndustryTag, SegmentStat[]>> = `;

const out = header + JSON.stringify(byV, null, 2) + ";\n";
writeFileSync(process.argv[2], out);
console.log(`WROTE ${RAW.length} sourced stats across ${Object.keys(byV).length} verticals → ${process.argv[2]}`);
for (const [v, s] of Object.entries(byV).sort((a,b)=>b[1].length-a[1].length)) console.log(`  ${String(s.length)}  ${v}`);
