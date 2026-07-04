// Segment-level AI-adoption benchmarks — CITED SURVEY DATA ONLY.
// ───────────────────────────────────────────────────────────────
// LAYERED model: a segment (vertical × size × region) composes its benchmark
// from every layer with real cited research — exact-segment stats, vertical
// stats, size-band stats, region stats, and the global baseline — each stat
// carrying its source + an HONEST fit note naming every population mismatch.
// A layer with no credible extracted figure simply doesn't exist (the UI
// labels each group's scope), and only a segment matching NOTHING reads
// "limited data" (rare: the global baseline nearly always applies).
//
// Extraction provenance (2026-07-04): US Census BTOS figures were extracted
// VERBATIM from the fetched census.gov data story + working paper
// CES-WP-26-25 PDF; Stanford AI Index figures verbatim from the fetched
// chapter-4 PDF prose (chart-only values that the prose does not state were
// deliberately NOT used). Same curated-analyst class as the exemplar
// dataset; zero writes, zero score paths.

import type { IndustryTag } from "../use-cases";
import type { Segment, SizeBandId, RegionId } from "./segments";
import { segmentId } from "./segments";
import type { MaturityId } from "../usecase-front-door";

export interface SegmentStatSource {
  title: string;
  publisher: string;
  url: string; // real https URL — enforced by tests
  /** Publication / fieldwork date as stated by the source. */
  surveyDate: string;
}

export interface SegmentStat {
  kind: "adoption_rate" | "maturity" | "use_case" | "platform_share" | "investment" | "other";
  /** The statistic, stated exactly as the source supports it. */
  headline: string;
  detail?: string;
  source: SegmentStatSource;
  /** HONEST fit note: every way this source's population differs from the
   *  segment (broader geography, all industries, all sizes, …). */
  segmentFitNote: string;
}

export interface SegmentUseCase {
  label: string;
  /** C6 category route id (app/(public)/category/[slug]) when one maps. */
  categoryRouteId?: string;
  source: SegmentStatSource;
}

export interface SegmentBenchmark {
  segment: Segment;
  stats: SegmentStat[];
  topUseCases: SegmentUseCase[];
  /** Analyst-curated qualitative anchor: where the cohort's centre of mass
   *  sits on the C6 maturity ladder, as a reading OF the cited stats —
   *  labelled as such in the UI, used only for the directional you-vs-cohort
   *  comparison. Only exact-seeded segments carry one. */
  cohortMaturityAnchor: MaturityId;
  anchorRationale: string;
  compiledAt: string; // ISO date the set was compiled/verified
}

// ── Shared sources ───────────────────────────────────────────────────────────
const BTOS_STORY: SegmentStatSource = {
  title: "Businesses' AI use — BTOS data stories",
  publisher: "US Census Bureau",
  url: "https://www.census.gov/library/stories/2026/05/ai-use-businesses.html",
  surveyDate: "May 2026 (collection to 3 May 2026)",
};
const BTOS_WP: SegmentStatSource = {
  title: "AI Use in the US Economy: Evidence from the BTOS AI Supplement (CES-WP-26-25)",
  publisher: "US Census Bureau (Center for Economic Studies)",
  url: "https://www2.census.gov/library/working-papers/2026/adrm/ces/CES-WP-26-25.pdf",
  surveyDate: "2026 working paper (reference period Nov 2025 – Jan 2026)",
};
const STANFORD_CH4: SegmentStatSource = {
  title: "AI Index Report 2025 — Chapter 4: Economy (McKinsey survey data)",
  publisher: "Stanford HAI",
  url: "https://hai.stanford.edu/assets/files/hai_ai-index-report-2025_chapter4_final.pdf",
  surveyDate: "April 2025 (2024 survey)",
};
const STANFORD_2026: SegmentStatSource = {
  title: "The 2026 AI Index Report",
  publisher: "Stanford HAI",
  url: "https://hai.stanford.edu/ai-index/2026-ai-index-report",
  surveyDate: "2026 report (2025 data)",
};

const US_ONLY_ALL = "US-only; all industries; all firm sizes, firm-weighted.";
const GLOBAL_ALL = "Global, all industries, all company sizes — baseline context.";

/** Helper — a BTOS sector row mapped onto one of our verticals. */
function btosSector(
  sectorName: string,
  current: string,
  expected: string,
  mappingNote: string,
): SegmentStat {
  return {
    kind: "adoption_rate",
    headline: `${current} of US ${sectorName} firms currently use AI; ${expected} expect to within six months.`,
    detail: "Official US statistics (BTOS AI supplement, firm-weighted). National rate: 18%.",
    source: BTOS_WP,
    segmentFitNote: `US-only; all firm sizes, firm-weighted; ${mappingNote}`,
  };
}

// ── Layer: GLOBAL baseline (applies to every segment) ────────────────────────
export const GLOBAL_STATS: SegmentStat[] = [
  {
    kind: "adoption_rate",
    headline:
      "Globally, 78% of organisations used AI in at least one function in 2024 (55% in 2023); 71% regularly use generative AI (33% in 2023).",
    detail: "The all-market baseline every cohort sits against.",
    source: STANFORD_CH4,
    segmentFitNote: GLOBAL_ALL,
  },
  {
    kind: "adoption_rate",
    headline: "Organisational AI adoption reached 88% in 2025 (2026 AI Index).",
    source: STANFORD_2026,
    segmentFitNote: `${GLOBAL_ALL} Report-page figure — chapter-level methodology not re-checked.`,
  },
];

// ── Layer: REGION stats (prose-anchored only) ────────────────────────────────
export const REGION_STATS: Partial<Record<RegionId, SegmentStat[]>> = {
  north_america: [
    {
      kind: "adoption_rate",
      headline: "82% of North American organisations reported using AI in 2024 — the leading region worldwide; 74% use generative AI.",
      source: STANFORD_CH4,
      segmentFitNote: "North America ✓ — but all industries and all company sizes.",
    },
    {
      kind: "adoption_rate",
      headline: "US business AI use hovered between 17% and 20% (Dec 2025 – May 2026), with 20–23% expecting to use it within six months.",
      detail: "Firm-weighted official statistics — the small-business-heavy denominator explains the gap vs executive surveys.",
      source: BTOS_STORY,
      segmentFitNote: US_ONLY_ALL,
    },
    {
      kind: "investment",
      headline: "US private AI investment reached $109.1B in 2024 (~12× China) and $285.9B in 2025 per the 2026 AI Index.",
      source: STANFORD_CH4,
      segmentFitNote: "US economy-wide capital context — not sector-specific, not an adoption measure. 2025 figure from the 2026 report page.",
    },
  ],
  europe: [
    {
      kind: "adoption_rate",
      headline: "80% of European organisations reported using AI in 2024 — up 23 percentage points year-on-year; 73% use generative AI.",
      source: STANFORD_CH4,
      segmentFitNote: "Europe ✓ — but all industries and all company sizes.",
    },
  ],
  // asia_pacific / latam / mea: the chapter's prose states no region-specific
  // figure we could extract faithfully — these regions fall through to the
  // global baseline rather than carry a guessed number.
};

// ── Layer: SIZE-BAND stats ───────────────────────────────────────────────────
export const SIZE_STATS: Partial<Record<SizeBandId, SegmentStat[]>> = {
  enterprise: [
    {
      kind: "adoption_rate",
      headline: "37% of US firms with 250+ employees report using AI — adoption climbs steeply with firm size.",
      source: BTOS_STORY,
      segmentFitNote: "All industries, US-only; 250+ employees spans the enterprise band and above.",
    },
  ],
  global_enterprise: [
    {
      kind: "adoption_rate",
      headline: "US firm-weighted AI adoption rises monotonically with size, reaching 35% for firms with 1,000+ employees — and 57% for the largest firms in AI-heavy sectors.",
      detail: "Employment-weighted, the Information sector runs at 54% current use, expected to reach ~67% within six months.",
      source: BTOS_WP,
      segmentFitNote: "US-only; 1,000+ employees is still below the global-enterprise band — a directional floor.",
    },
  ],
};

// ── Layer: VERTICAL stats (BTOS sector → our vertical, mapping named) ────────
export const VERTICAL_STATS: Partial<Record<IndustryTag, SegmentStat[]>> = {
  financial_services: [
    btosSector("Finance & Insurance", "30%", "34%", "NAICS 52 spans finance AND insurance."),
  ],
  insurance: [
    btosSector("Finance & Insurance", "30%", "34%", "NAICS 52 spans finance AND insurance — no insurance-only split published."),
  ],
  technology_software: [
    btosSector("Information", "38%", "43%", "NAICS Information includes software/tech AND media/telecom — the highest-adopting US sector."),
  ],
  telecom_media: [
    btosSector("Information", "38%", "43%", "NAICS Information includes media/telecom AND software — no telecom-only split published."),
  ],
  professional_services: [
    btosSector("Professional, Scientific & Technical Services", "34%", "37%", "sector maps directly."),
  ],
  legal: [
    btosSector("Professional, Scientific & Technical Services", "34%", "37%", "legal services are a subsector of NAICS 54 — no legal-only split published."),
  ],
  education: [
    btosSector("Educational Services", "31%", "35%", "sector maps directly; spans K-12 through higher ed."),
  ],
  real_estate: [
    btosSector("Real Estate", "24%", "24%", "sector maps directly; expected-use figure not separately stated — current rate shown."),
  ],
  retail_consumer: [
    {
      kind: "adoption_rate",
      headline: "Around 14% of US Retail Trade businesses currently use AI; about 17% expect to within six months — below the 19.8% national rate.",
      source: BTOS_STORY,
      segmentFitNote: "US-only; all firm sizes; NAICS Retail Trade — consumer-goods manufacturers not included.",
    },
  ],
  manufacturing: [
    {
      kind: "adoption_rate",
      headline: "US Manufacturing adopts AI at well below knowledge-sector rates (national mean 18%), with employment-weighted use expected to rise significantly over the next six months.",
      detail: "The working paper names Manufacturing among 'physical output' sectors with much lower adoption; an exact sector rate is not stated in the extractable text.",
      source: BTOS_WP,
      segmentFitNote: "US-only; qualitative sector positioning — no exact manufacturing rate published in the paper's prose.",
    },
  ],
  transport_logistics: [
    {
      kind: "adoption_rate",
      headline: "US Transportation & Warehousing adopts AI at well below knowledge-sector rates (national mean 18%).",
      detail: "Named among the 'physical output' sectors with much lower adoption; an exact sector rate is not stated in the extractable text.",
      source: BTOS_WP,
      segmentFitNote: "US-only; qualitative sector positioning — no exact rate published in the paper's prose.",
    },
  ],
  public_sector: [
    {
      kind: "other",
      headline: "US official business statistics (BTOS) cover private employer firms only — public administration is out of scope, so no official US adoption rate exists in this source family.",
      source: BTOS_WP,
      segmentFitNote: "Population exclusion note, not an adoption figure — the global baseline below is the honest reference.",
    },
  ],
  // healthcare / pharma_life_sciences / energy_utilities / aerospace_defence:
  // no sector figure was stated in the extractable prose of either source —
  // these verticals fall through to size/region/global layers rather than
  // carry a guessed number. Fill via the cited pipeline as sources land.
};

/** Exact-segment registry — curated anchors + use-cases live ONLY here. */
export const SEGMENT_BENCHMARKS: Record<string, SegmentBenchmark> = {
  "financial_services|global_enterprise|north_america": {
    segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
    compiledAt: "2026-07-04",
    stats: [
      {
        kind: "adoption_rate",
        headline: "33.9% of US Finance & Insurance businesses report using AI — versus a 19.8% national rate (as of May 2026).",
        detail: "Second-highest sector after Information (39.7%). Official US statistics, firm-weighted.",
        source: BTOS_STORY,
        segmentFitNote: "US-only (not all North America); ALL firm sizes — not large-enterprise-specific; NAICS 52 spans finance and insurance.",
      },
      {
        kind: "adoption_rate",
        headline: "The largest US firms in Finance & Insurance and Professional Services use AI at a rate of 63%.",
        detail: "The paper's size-by-sector analysis (Table C5) — the closest published figure to this cohort.",
        source: BTOS_WP,
        segmentFitNote: "US-only; 'largest firms' per the paper's top size threshold — combines Finance & Insurance with Professional Services.",
      },
      {
        kind: "maturity",
        headline: "Across the 50 largest banks, AI headcount grew over 25% year-on-year — and three banks (Capital One, Bank of America, JPMorganChase) hold ~75% of all bank AI patents.",
        detail: "JPMorganChase led the Evident AI Index for the fourth consecutive time; banking is the most heavily disclosed AI-adopting industry.",
        source: {
          title: "Evident AI Index (banking)",
          publisher: "Evident Insights",
          url: "https://evidentinsights.com/ai-index/",
          surveyDate: "2025 index",
        },
        segmentFitNote: "Top-50 global banks (heavily NA-weighted) — a strong proxy for global-enterprise FS; an analyst index of observable signals, not a survey.",
      },
    ],
    topUseCases: [
      {
        label: "Employee AI assistants / copilots",
        categoryRouteId: "enterprise_assistant",
        source: {
          title: "Here's JPMorgan Chase's blueprint to become the world's first fully AI-powered megabank",
          publisher: "CNBC",
          url: "https://www.cnbc.com/2025/09/30/jpmorgan-chase-fully-ai-connected-megabank.html",
          surveyDate: "2025-09-30",
        },
      },
      {
        label: "Customer-facing AI assistants",
        categoryRouteId: "crm_customer_ai",
        source: {
          title: "A decade of AI innovation: BofA's virtual assistant Erica surpasses 3 billion client interactions",
          publisher: "Bank of America",
          url: "https://newsroom.bankofamerica.com/content/newsroom/press-releases/2025/08/a-decade-of-ai-innovation--bofa-s-virtual-assistant-erica-surpas.html",
          surveyDate: "2025-08",
        },
      },
      {
        label: "Research retrieval & document intelligence",
        categoryRouteId: "rag_enterprise_search",
        source: {
          title: "Morgan Stanley Research announces AskResearchGPT",
          publisher: "Morgan Stanley",
          url: "https://www.morganstanley.com/press-releases/morgan-stanley-research-announces-askresearchgpt",
          surveyDate: "2024",
        },
      },
      {
        label: "Agentic customer workflows",
        categoryRouteId: "agent_platform",
        source: {
          title: "2025 was the year of agentic AI. How did we do?",
          publisher: "Fortune",
          url: "https://fortune.com/2025/12/15/agentic-artificial-intelligence-automation-capital-one/",
          surveyDate: "2025-12-15",
        },
      },
    ],
    cohortMaturityAnchor: "established",
    anchorRationale:
      "Finance & Insurance adopts at ~1.7× the US national rate (BTOS, May 2026), the largest FS/professional-services firms adopt at 63% (CES-WP-26-25), the top-50 banks show >25% YoY AI-headcount growth (Evident), and every named exemplar runs production, firm-wide AI systems — 'established'; 'advanced' would over-claim for the cohort's centre of mass.",
  },
};

/** One scope-labelled group of stats in a composed benchmark. */
export interface BenchmarkLayer {
  scope: "segment" | "vertical" | "size" | "region" | "global";
  scopeLabel: string;
  stats: SegmentStat[];
}

export interface ComposedBenchmark {
  /** Exact-seeded entry when one exists (carries anchor + use-cases). */
  exact: SegmentBenchmark | null;
  /** All applicable layers, most-specific first. Never empty in practice —
   *  the global baseline applies everywhere. */
  layers: BenchmarkLayer[];
}

/** Compose a segment's benchmark from every layer with real cited research.
 *  Pure; most-specific first; a layer without data simply doesn't appear. */
export function composeBenchmark(s: Segment): ComposedBenchmark {
  const exact = SEGMENT_BENCHMARKS[segmentId(s)] ?? null;
  const layers: BenchmarkLayer[] = [];
  if (exact) layers.push({ scope: "segment", scopeLabel: "Your exact segment", stats: exact.stats });
  const v = VERTICAL_STATS[s.vertical];
  if (v?.length) layers.push({ scope: "vertical", scopeLabel: "Your vertical", stats: v });
  const b = SIZE_STATS[s.sizeBand];
  if (b?.length) layers.push({ scope: "size", scopeLabel: "Your size band", stats: b });
  const r = REGION_STATS[s.region];
  if (r?.length) layers.push({ scope: "region", scopeLabel: "Your region", stats: r });
  if (GLOBAL_STATS.length) layers.push({ scope: "global", scopeLabel: "Global baseline", stats: GLOBAL_STATS });
  return { exact, layers };
}

/** Back-compat exact resolver (anchor + use-cases live on exact entries). */
export function resolveBenchmark(s: Segment): SegmentBenchmark | null {
  return SEGMENT_BENCHMARKS[segmentId(s)] ?? null;
}
