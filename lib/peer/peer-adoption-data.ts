// Peer-AI-adoption STARTER dataset — banking peer set.
// ────────────────────────────────────────────────────
// CURATED ANALYST data (the lib/delivery/seed.ts class): every rated cell
// traces to the real, named, web-verified citations attached to it — compiled
// 2026-07-04 from company newsrooms, vendor case studies, reputable press and
// the Evident AI Index. Levels are an analyst-curated qualitative reading OF
// those citations (labelled as such in the UI), never a measured score.
//
// HARD RULES (enforced by peer-adoption-data.test.ts):
//   • disclosed/inferred → ≥1 real https citation; not_disclosed → none.
//   • automation_intensity is NEVER "disclosed" — it is an inference from
//     disclosed usage/efficiency stats, always est-flagged.
//   • No claim, anywhere, about private internal usage. Gaps read
//     "not disclosed" — under-claim rather than over-claim.
//   • vendorIds only name vendors tracked by the platform (cross-links).
//
// The peer set is a STARTER (banking — the most heavily disclosed industry
// for AI adoption); the user's peer scope is editable in the UI and the
// dataset grows via the same cited pipeline, never by invention.

import type { PeerCompany } from "./types";

export const PEER_DATASET_SOURCE =
  "Analyst-curated · citations verified against live web sources, 2026-07-04";

export const PEER_COMPANIES: PeerCompany[] = [
  // ── JPMorgan Chase ──────────────────────────────────────────────────────
  {
    id: "jpmorgan-chase",
    name: "JPMorgan Chase",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 4,
        summary:
          "LLM Suite — an internal portal wrapping frontier models — is disclosed as using OpenAI and Anthropic models, with ~250,000 employees (all but branch/call-centre staff) having access.",
        citations: [
          {
            title: "JPMorgan Chase is giving its employees an AI assistant powered by ChatGPT maker OpenAI",
            url: "https://www.cnbc.com/2024/08/09/jpmorgan-chase-ai-artificial-intelligence-assistant-chatgpt-openai.html",
            publisher: "CNBC",
            tier: "press",
            publishedAt: "2024-08-09",
          },
          {
            title: "Here's JPMorgan Chase's blueprint to become the world's first fully AI-powered megabank",
            url: "https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html",
            publisher: "CNBC",
            tier: "press",
            publishedAt: "2025-09-30",
          },
        ],
        vendorIds: ["openai", "anthropic"],
      },
      {
        kind: "talent_exposure",
        status: "disclosed",
        level: 3,
        summary:
          "Ranked #1 overall in the Evident AI Index for the fourth consecutive time (first in Innovation, Leadership and Transparency; second in Talent), with roughly one in forty employees working on AI per Evident's tracking.",
        citations: [
          {
            title: "JPMorganChase continues to lead the world's top banks in AI maturity",
            url: "https://www.jpmorganchase.com/about/technology/blog/jpmc-evident-25",
            publisher: "JPMorgan Chase",
            tier: "company_primary",
          },
          {
            title: "Evident AI Index (banking)",
            url: "https://evidentinsights.com/ai-index/",
            publisher: "Evident Insights",
            tier: "analyst_index",
          },
        ],
      },
      {
        kind: "patent_velocity",
        status: "disclosed",
        level: 3,
        summary:
          "One of the three banks (with Capital One and Bank of America) that together account for ~75% of all AI patents across the 50 banks Evident tracks; Evident also credits its AI research team as the sector's strongest.",
        citations: [
          {
            title: "Evident AI Patent Tracker (banking)",
            url: "https://evidentinsights.com/insights/banking-ai-patent-tracker/",
            publisher: "Evident Insights",
            tier: "analyst_index",
          },
          {
            title: "'It's a frenzy': JPMorgan Chase, Capital One dominate AI arms race",
            url: "https://www.americanbanker.com/news/its-a-frenzy-jpmorgan-chase-capital-one-dominate-ai-arms-race",
            publisher: "American Banker",
            tier: "press",
          },
        ],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 4,
        summary:
          "LLM Suite shipped firm-wide (summer 2024; zero to 200,000 onboarded users in eight months) and was named American Banker's 2025 'Innovation of the Year'.",
        citations: [
          {
            title: "LLM Suite named 2025 'Innovation of the Year' by American Banker",
            url: "https://www.jpmorganchase.com/about/technology/blog/llmsuite-ab-award",
            publisher: "JPMorgan Chase",
            tier: "company_primary",
          },
          {
            title: "Here's JPMorgan Chase's blueprint to become the world's first fully AI-powered megabank",
            url: "https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html",
            publisher: "CNBC",
            tier: "press",
            publishedAt: "2025-09-30",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 3,
        summary:
          "Deep day-to-day penetration of AI into working practice, inferred from disclosed usage: ~half of the 250,000 enabled employees use LLM Suite roughly daily, and the firm cites tasks like drafting an investment-banking deck in ~30 seconds.",
        inferenceNote:
          "Inferred from disclosed usage statistics (CNBC-reported adoption and task examples) — the bank does not publish an automation metric.",
        citations: [
          {
            title: "Here's JPMorgan Chase's blueprint to become the world's first fully AI-powered megabank",
            url: "https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html",
            publisher: "CNBC",
            tier: "press",
            publishedAt: "2025-09-30",
          },
        ],
      },
    ],
  },

  // ── Morgan Stanley ──────────────────────────────────────────────────────
  {
    id: "morgan-stanley",
    name: "Morgan Stanley",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 3,
        summary:
          "A disclosed, multi-year OpenAI partnership powers three shipped tools: AI @ Morgan Stanley Assistant (GPT-4), Debrief (Whisper + GPT-4 meeting summaries) and AskResearchGPT (institutional securities).",
        citations: [
          {
            title: "Morgan Stanley uses AI evals to shape the future of financial services",
            url: "https://openai.com/index/morgan-stanley/",
            publisher: "OpenAI",
            tier: "vendor_disclosure",
          },
          {
            title: "Morgan Stanley Research announces AskResearchGPT",
            url: "https://www.morganstanley.com/press-releases/morgan-stanley-research-announces-askresearchgpt",
            publisher: "Morgan Stanley",
            tier: "company_primary",
          },
          {
            title: "Morgan Stanley kicks off generative AI era on Wall Street with assistant for financial advisors",
            url: "https://www.cnbc.com/2023/09/18/morgan-stanley-chatgpt-financial-advisors.html",
            publisher: "CNBC",
            tier: "press",
            publishedAt: "2023-09-18",
          },
        ],
        vendorIds: ["openai"],
      },
      {
        kind: "talent_exposure",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "patent_velocity",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 3,
        summary:
          "Three OpenAI-powered tools shipped across Wealth Management and Institutional Securities: the Assistant (launched Sept 2023), Debrief (meeting notes with client consent) and AskResearchGPT (over 70,000 proprietary reports a year made queryable).",
        citations: [
          {
            title: "Launch of AI @ Morgan Stanley Debrief",
            url: "https://www.morganstanley.com/press-releases/ai-at-morgan-stanley-debrief-launch",
            publisher: "Morgan Stanley",
            tier: "company_primary",
          },
          {
            title: "Morgan Stanley Research announces AskResearchGPT",
            url: "https://www.morganstanley.com/press-releases/morgan-stanley-research-announces-askresearchgpt",
            publisher: "Morgan Stanley",
            tier: "company_primary",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 3,
        summary:
          "High advisor-workflow penetration, inferred from disclosed adoption: 98% of advisor teams use the AI @ Morgan Stanley Assistant, and OpenAI's case study reports document-retrieval effectiveness rising from ~20% to ~80%.",
        inferenceNote:
          "Inferred from adoption/effectiveness figures disclosed in OpenAI's Morgan Stanley case study — no direct automation metric is published.",
        citations: [
          {
            title: "Morgan Stanley uses AI evals to shape the future of financial services",
            url: "https://openai.com/index/morgan-stanley/",
            publisher: "OpenAI",
            tier: "vendor_disclosure",
          },
        ],
      },
    ],
  },

  // ── Goldman Sachs ───────────────────────────────────────────────────────
  {
    id: "goldman-sachs",
    name: "Goldman Sachs",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 3,
        summary:
          "The firm-wide GS AI Assistant is disclosed as multi-model: OpenAI's GPT-4o/o3-mini family, Google's Gemini 2.0 Flash and Anthropic's Claude 3.7 Sonnet, among others.",
        citations: [
          {
            title: "Goldman Sachs rolls out firmwide AI assistant to boost employee productivity",
            url: "https://www.foxbusiness.com/technology/goldman-sachs-announces-firmwide-launch-ai-assistant",
            publisher: "Fox Business",
            tier: "press",
          },
          {
            title: "Goldman Sachs gave every employee an AI assistant — here's what it does",
            url: "https://www.benzinga.com/markets/tech/25/07/46316968/goldman-sachs-gave-every-employee-an-ai-assistant-heres-what-it-does",
            publisher: "Benzinga",
            tier: "press",
          },
        ],
        vendorIds: ["openai", "google", "anthropic"],
      },
      {
        kind: "talent_exposure",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "patent_velocity",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 3,
        summary:
          "GS AI Assistant launched firm-wide across the ~46,500-person workforce (June 2025) after a 10,000-employee rollout, spanning Investment Banking and Wealth Management — document summarisation, drafting and data analysis.",
        citations: [
          {
            title: "Goldman Sachs rolls out firmwide AI assistant to boost employee productivity",
            url: "https://www.foxbusiness.com/technology/goldman-sachs-announces-firmwide-launch-ai-assistant",
            publisher: "Fox Business",
            tier: "press",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 2,
        summary:
          "Growing but earlier-stage workflow penetration, inferred from the disclosed rollout arc: ~10,000 active users at the start of 2025 scaling to firm-wide availability by mid-2025.",
        inferenceNote:
          "Inferred from the disclosed rollout scale and pace — Goldman publishes no automation metric.",
        citations: [
          {
            title: "Goldman Sachs launches AI assistant firmwide, with 10,000 employees already using it",
            url: "https://slashdot.org/story/25/06/24/006220/goldman-sachs-launches-ai-assistant-firmwide-with-10000-employees-already-using-it",
            publisher: "Slashdot (citing Reuters)",
            tier: "press",
          },
        ],
      },
    ],
  },

  // ── Citigroup ───────────────────────────────────────────────────────────
  {
    id: "citigroup",
    name: "Citigroup",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 2,
        summary:
          "A disclosed multi-year strategic agreement with Google Cloud (October 2024): workload migration plus Vertex AI to deliver generative-AI capabilities across the company — developer toolkits, document processing, and customer-servicing digitisation.",
        citations: [
          {
            title: "Citi and Google Cloud announce strategic agreement to modernize Citi's technology infrastructure and drive innovation",
            url: "https://www.citigroup.com/global/news/press-release/2024/citi-and-google-cloud-announce-strategic-agreement",
            publisher: "Citigroup",
            tier: "company_primary",
            publishedAt: "2024-10-28",
          },
          {
            title: "Citi taps Google Cloud for app migration, AI adoption",
            url: "https://www.ciodive.com/news/citi-google-cloud-partnership-app-migration-ai-modernization/731260/",
            publisher: "CIO Dive",
            tier: "press",
          },
        ],
        vendorIds: ["google"],
      },
      {
        kind: "talent_exposure",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "patent_velocity",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 3,
        summary:
          "Citi Assist (policy/procedure navigation) and Citi Stylus (multi-document create/summarise/compare) rolled out to ~140,000 employees across eight countries, with agentic capabilities added via Citi Stylus Workspaces (5,000-employee pilot first).",
        citations: [
          {
            title: "Citi unveils Citi Stylus Workspaces with agentic AI, turbocharging productivity at Citi",
            url: "https://www.citigroup.com/global/news/press-release/2025/citi-unveils-citi-stylus-workspaces-agentic-ai-turbocharging-productivity",
            publisher: "Citigroup",
            tier: "company_primary",
          },
          {
            title: "Citigroup launches AI tools for 140,000 employees across 8 countries",
            url: "https://www.cdomagazine.tech/aiml/citigroup-launches-ai-tools-for-140000-employees-across-8-countries",
            publisher: "CDO Magazine",
            tier: "press",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 2,
        summary:
          "Broad enablement with agentic execution still ramping, inferred from the disclosed rollout: 140,000 employees enabled on assistant tooling, while agentic Workspaces begins with a 5,000-employee pilot and staged expansion.",
        inferenceNote:
          "Inferred from disclosed rollout scale and pilot phasing (Citi press release, CIO Dive) — no automation metric is published.",
        citations: [
          {
            title: "Citi deploys agentic tools to in-house AI platform",
            url: "https://www.ciodive.com/news/citi-agentic-AI-tools-stylus-workspaces/760804/",
            publisher: "CIO Dive",
            tier: "press",
          },
        ],
      },
    ],
  },

  // ── Wells Fargo ─────────────────────────────────────────────────────────
  {
    id: "wells-fargo",
    name: "Wells Fargo",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 4,
        summary:
          "A disclosed strategic Google Cloud partnership: Fargo runs on Gemini (Flash 2.0), with a bank-wide agentic expansion (Agentspace, Gemini Deep Research, NotebookLM); Meta's Llama is disclosed as used for internal workloads.",
        citations: [
          {
            title: "Wells Fargo's new virtual assistant, Fargo, to be powered by Google Cloud AI",
            url: "https://newsroom.wf.com/English/news-releases/news-release-details/2022/Wells-Fargos-New-Virtual-Assistant-Fargo-to-Be-Powered-by-Google-Cloud-AI/default.aspx",
            publisher: "Wells Fargo",
            tier: "company_primary",
            publishedAt: "2022-10-24",
          },
          {
            title: "Wells Fargo's AI assistant just crossed 245 million interactions — no human handoffs, no sensitive data exposed",
            url: "https://venturebeat.com/business/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm",
            publisher: "VentureBeat",
            tier: "press",
          },
          {
            title: "Wells Fargo brings the agentic era to financial services with Google Cloud AI",
            url: "https://cloud.google.com/blog/topics/financial-services/wells-fargo-agentic-ai-agentspace-empowering-workers",
            publisher: "Google Cloud",
            tier: "vendor_disclosure",
          },
        ],
        // "OpenAI models can be tapped as needed" (VentureBeat) is a CAPABILITY
        // statement, not an adoption disclosure — deliberately NOT listed.
        vendorIds: ["google", "meta"],
      },
      {
        kind: "talent_exposure",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "patent_velocity",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 3,
        summary:
          "Fargo, the customer-facing assistant, grew from 21.3M interactions (2023) to 245M+ (2024), 336M+ cumulative, with Spanish usage a major disclosed driver; agentic tools are being extended to bankers, marketers and corporate teams.",
        citations: [
          {
            title: "Wells Fargo's AI assistant just crossed 245 million interactions — no human handoffs, no sensitive data exposed",
            url: "https://venturebeat.com/business/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm",
            publisher: "VentureBeat",
            tier: "press",
          },
          {
            title: "Wells Fargo plans to unleash Google's agentic AI bank-wide",
            url: "https://www.americanbanker.com/news/wells-fargo-plans-to-unleash-googles-agentic-ai-bank-wide",
            publisher: "American Banker",
            tier: "press",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 3,
        summary:
          "High customer-service automation, inferred from disclosed operating stats: 245M+ assistant interactions in 2024 handled with no human handoffs and a privacy pipeline that keeps PII away from the LLM.",
        inferenceNote:
          "Inferred from interaction volumes and zero-handoff figures disclosed to VentureBeat — the bank publishes no direct automation metric.",
        citations: [
          {
            title: "Wells Fargo's AI assistant just crossed 245 million interactions — no human handoffs, no sensitive data exposed",
            url: "https://venturebeat.com/business/wells-fargos-ai-assistant-just-crossed-245-million-interactions-with-zero-humans-in-the-loop-and-zero-pii-to-the-llm",
            publisher: "VentureBeat",
            tier: "press",
          },
        ],
      },
    ],
  },

  // ── Bank of America ─────────────────────────────────────────────────────
  {
    id: "bank-of-america",
    name: "Bank of America",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 1,
        summary:
          "Disclosed strategy is predominantly in-house: Erica is proprietary, and the bank discloses a ~$13B annual technology budget (over $4B to new initiatives including AI) rather than named external model-vendor adoptions.",
        citations: [
          {
            title: "BofA AI and digital innovations fuel 30 billion client interactions",
            url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/03/bofa-ai-and-digital-innovations-fuel-30-billion-client-interacti.html",
            publisher: "Bank of America",
            tier: "company_primary",
            publishedAt: "2026-03",
          },
          {
            title: "How Bank of America's Erica raised the stakes for virtual assistants",
            url: "https://www.customerexperiencedive.com/news/bank-of-america-erica-virtual-assistants/758334/",
            publisher: "CX Dive",
            tier: "press",
          },
        ],
      },
      {
        kind: "talent_exposure",
        status: "not_disclosed",
        citations: [],
      },
      {
        kind: "patent_velocity",
        status: "disclosed",
        level: 4,
        summary:
          "~1,100 AI/ML patents and applications (94% growth since 2022, over half granted) within the largest patent portfolio of any US financial-services firm; one of the three banks holding ~75% of all bank AI patents per Evident.",
        citations: [
          {
            title: "AI patents at BofA increase 94% since 2022",
            url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2024/10/ai-patents-at-bofa-increase-94--since-2022.html",
            publisher: "Bank of America",
            tier: "company_primary",
            publishedAt: "2024-10",
          },
          {
            title: "Evident AI Patent Tracker (banking)",
            url: "https://evidentinsights.com/insights/banking-ai-patent-tracker/",
            publisher: "Evident Insights",
            tier: "analyst_index",
          },
        ],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 4,
        summary:
          "Erica — launched 2018, the first widely available virtual financial assistant — has surpassed 3.2B client interactions across ~50M users, averaging 58M+ interactions a month; AI/digital engagement disclosed at 30B client interactions overall.",
        citations: [
          {
            title: "A decade of AI innovation: BofA's virtual assistant Erica surpasses 3 billion client interactions",
            url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html",
            publisher: "Bank of America",
            tier: "company_primary",
            publishedAt: "2025-08",
          },
          {
            title: "BofA AI and digital innovations fuel 30 billion client interactions",
            url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2026/03/bofa-ai-and-digital-innovations-fuel-30-billion-client-interacti.html",
            publisher: "Bank of America",
            tier: "company_primary",
            publishedAt: "2026-03",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 3,
        summary:
          "High client-service automation, inferred from disclosed effectiveness: more than 98% of Erica users find what they need in-assistant, materially deflecting call-centre volume toward specialists.",
        inferenceNote:
          "Inferred from BofA-disclosed effectiveness figures — the bank publishes no direct automation metric.",
        citations: [
          {
            title: "A decade of AI innovation: BofA's virtual assistant Erica surpasses 3 billion client interactions",
            url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html",
            publisher: "Bank of America",
            tier: "company_primary",
            publishedAt: "2025-08",
          },
        ],
      },
    ],
  },

  // ── Capital One ─────────────────────────────────────────────────────────
  {
    id: "capital-one",
    name: "Capital One",
    industry: "Banking & capital markets",
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    signals: [
      {
        kind: "platform_integration",
        status: "disclosed",
        level: 3,
        summary:
          "Disclosed as one of the only banks fully committed to public cloud (AWS), with Meta's open-source Llama disclosed as the customised base model for its Chat Concierge agentic system.",
        citations: [
          {
            title: "How Capital One drives returns on its AI investments",
            url: "https://www.cio.com/article/4019828/how-capital-one-drives-returns-on-its-ai-investments.html",
            publisher: "CIO",
            tier: "press",
          },
          {
            title: "2025 was the year of agentic AI. How did we do?",
            url: "https://fortune.com/2025/12/15/agentic-artificial-intelligence-automation-capital-one/",
            publisher: "Fortune",
            tier: "press",
            publishedAt: "2025-12-15",
          },
        ],
        vendorIds: ["aws", "meta"],
      },
      {
        kind: "talent_exposure",
        status: "disclosed",
        level: 4,
        summary:
          "Leads the Evident AI Index Talent pillar: roughly one in fifteen Capital One employees works on AI — the highest AI-talent density of the 50 banks tracked.",
        citations: [
          {
            title: "2025 Evident AI Banking Index: who's leading in AI?",
            url: "https://www.teradata.com/insights/articles/which-banks-are-leading-in-ai",
            publisher: "Teradata (citing Evident)",
            tier: "analyst_index",
          },
          {
            title: "'It's a frenzy': JPMorgan Chase, Capital One dominate AI arms race",
            url: "https://www.americanbanker.com/news/its-a-frenzy-jpmorgan-chase-capital-one-dominate-ai-arms-race",
            publisher: "American Banker",
            tier: "press",
          },
        ],
      },
      {
        kind: "patent_velocity",
        status: "disclosed",
        level: 4,
        summary:
          "More than 1,700 AI patents filed — the most of the 50 banks Evident tracks — and one of the three banks holding ~75% of all bank AI patents.",
        citations: [
          {
            title: "Evident AI Patent Tracker (banking)",
            url: "https://evidentinsights.com/insights/banking-ai-patent-tracker/",
            publisher: "Evident Insights",
            tier: "analyst_index",
          },
          {
            title: "2025 Evident AI Banking Index: who's leading in AI?",
            url: "https://www.teradata.com/insights/articles/which-banks-are-leading-in-ai",
            publisher: "Teradata (citing Evident)",
            tier: "analyst_index",
          },
        ],
      },
      {
        kind: "product_footprint",
        status: "disclosed",
        level: 3,
        summary:
          "Chat Concierge — a proprietary multi-agent conversational AI for auto dealers (built in-house on a customised Llama base) — is disclosed as 55% more successful at converting leads, alongside the established Eno assistant.",
        citations: [
          {
            title: "Capital One's 'Chat Concierge' puts agentic AI on dealer websites",
            url: "https://thefinancialbrand.com/news/banking-products/capital-ones-chat-concierge-puts-agentic-ai-on-car-dealers-websites-187128",
            publisher: "The Financial Brand",
            tier: "press",
          },
          {
            title: "2025 was the year of agentic AI. How did we do?",
            url: "https://fortune.com/2025/12/15/agentic-artificial-intelligence-automation-capital-one/",
            publisher: "Fortune",
            tier: "press",
            publishedAt: "2025-12-15",
          },
        ],
      },
      {
        kind: "automation_intensity",
        status: "inferred",
        level: 3,
        summary:
          "Substantial agentic automation in production, inferred from disclosed results: Chat Concierge's multi-agent workflow (plan → validate → execute) runs customer conversations end-to-end with a 55% lead-conversion lift and a disclosed 5× latency reduction since launch.",
        inferenceNote:
          "Inferred from performance figures Capital One disclosed to Fortune/CIO — no direct automation metric is published.",
        citations: [
          {
            title: "2025 was the year of agentic AI. How did we do?",
            url: "https://fortune.com/2025/12/15/agentic-artificial-intelligence-automation-capital-one/",
            publisher: "Fortune",
            tier: "press",
            publishedAt: "2025-12-15",
          },
        ],
      },
    ],
  },
];
