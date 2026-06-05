// IPO readiness + window estimator.
// ─────────────────────────────────
// Estimates an IPO date band, pricing range, and rumour quality for each
// IPO-watch vendor by combining:
//   1. Classified news signals already in IntelligenceNewsItem
//      (filled by the competitive-intel monitor's web search).
//   2. Latest seed IPOProfile baseline (readinessScore, pricingRisk).
//   3. LLM market-commentary synthesis via Claude with web_search.
//
// Two execution paths:
//   - LLM path:   Uses Claude to pull the most recent banker / S-1 /
//                 secondary-market signals and emit a structured forecast.
//   - Deterministic fallback: Pure news-signal scoring. Triggered when
//                 hasLLM() returns false or the LLM call errors.
//
// Output shape mirrors the existing seed IPOForecast so consumer pages
// can swap seed → live without changing render code.

import Anthropic from "@anthropic-ai/sdk";
import { hasLLM } from "../agents/llm-client";
import { listNewsItems } from "../intelligence/repository";
import { IPO_PROFILES } from "./seed";
import type {
  IPOBehaviourForecast,
  IPOForecast,
  IPOForecastConfidence,
  IPOForecastStatus,
  IPOProfile,
  RumourQuality,
} from "./types";

/**
 * The shipped IPOForecast type carries some seed-only fields the
 * estimator can't (and shouldn't) populate from public data — they're
 * left as defaults below. Mapping is one-way: estimator → IPOForecast.
 */
import type { NewsItem } from "../intelligence/types";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/* ─── News-signal scoring (used by both paths) ──────────────────── */

interface IpoSignalScore {
  /** 0..100 readiness lift from positive S-1 / banker / lock-up signals. */
  readinessLift: number;
  /** Plain-English rationale strings. */
  rationale: string[];
  /** IDs of news items that contributed. */
  sourceIds: string[];
}

const IPO_KEYWORDS = [
  { match: /(filed|files) (an? )?s[- ]?1\b/i,                 weight: 22, label: "S-1 filing reported" },
  { match: /\bf[- ]?1\b/i,                                    weight: 18, label: "F-1 filing reported" },
  { match: /\bipo (window|window opens|expected|targeting)/i, weight: 14, label: "IPO window guidance" },
  { match: /\b(price range|set a price)\b/i,                  weight: 14, label: "Price range disclosed" },
  { match: /\b(lead underwriter|book-running|underwriters)/i, weight: 10, label: "Underwriter mandate" },
  { match: /\bsecondary (sale|tender|offering)\b/i,           weight: 8,  label: "Secondary sale" },
  { match: /\bvaluation .* \$([\d\.]+)\s?(b|bn|billion|m|mn|million)\b/i, weight: 10, label: "Valuation mark" },
  { match: /\bdelay(ed)? (the )?ipo/i,                        weight: -18, label: "IPO delay mentioned" },
  { match: /\bipo (cancell?ed|pulled|postponed)/i,            weight: -28, label: "IPO cancellation" },
  { match: /\b(roadshow|investor presentation)\b/i,           weight: 12, label: "Roadshow signal" },
];

function scoreNewsForVendor(
  vendorId: string,
  news: NewsItem[],
): IpoSignalScore {
  const matchedItems = news.filter((n) =>
    n.vendors.includes(vendorId)
    || n.vendors.includes(`vendor_${vendorId}`),
  );
  const rationale: string[] = [];
  const sourceIds: string[] = [];
  let readinessLift = 0;
  for (const item of matchedItems) {
    const haystack = `${item.title} ${item.summary} ${item.whyItMatters}`;
    for (const rule of IPO_KEYWORDS) {
      if (rule.match.test(haystack)) {
        readinessLift += rule.weight;
        rationale.push(`${rule.label}: "${item.title}"`);
        sourceIds.push(item.id);
        break; // Don't double-count one news item against multiple rules.
      }
    }
  }
  return {
    readinessLift: Math.max(-40, Math.min(40, readinessLift)),
    rationale,
    sourceIds,
  };
}

/* ─── Confidence + status helpers ───────────────────────────────── */

function classifyConfidence(score: number): IPOForecastConfidence {
  if (score >= 85) return "high";
  if (score >= 70) return "medium_high";
  if (score >= 55) return "medium";
  if (score >= 45) return "medium_low";
  if (score >= 30) return "low";
  return "very_low";
}

function classifyStatus(score: number): { status: IPOForecastStatus; label: string } {
  if (score >= 80) return { status: "active_process", label: "Active IPO process" };
  if (score >= 65) return { status: "likely_near_term", label: "Likely near-term IPO" };
  if (score >= 45) return { status: "plausible_watch", label: "Plausible IPO watch" };
  if (score >= 25) return { status: "broad_window_only", label: "Broad-window estimate only" };
  return { status: "no_reliable_month_estimate", label: "No reliable month estimate" };
}

/**
 * Maps the readiness score to one of the R0..R5 rumour-quality grades.
 * R5 = formally documented (S-1 / pricing range), R0 = no public signal.
 */
function classifyRumourQuality(score: number): RumourQuality {
  if (score >= 85) return "R5";
  if (score >= 70) return "R4";
  if (score >= 55) return "R3";
  if (score >= 40) return "R2";
  if (score >= 25) return "R1";
  return "R0";
}

/* ─── Deterministic fallback ────────────────────────────────────── */

function deterministicEstimate(
  profile: IPOProfile,
  news: NewsItem[],
): IPOForecast {
  const signal = scoreNewsForVendor(profile.providerId, news);
  const baseReadiness = profile.readinessScore;
  const adjustedReadiness = Math.max(0, Math.min(100, baseReadiness + signal.readinessLift));

  // Map readiness → IPO month band. Higher = sooner.
  const now = new Date();
  const monthsOut = adjustedReadiness >= 70
    ? 4 + Math.round((90 - adjustedReadiness) / 4)  // 4–9 months out
    : adjustedReadiness >= 50
    ? 9 + Math.round((70 - adjustedReadiness) / 3)  // 9–16 months
    : adjustedReadiness >= 30
    ? 16 + Math.round((50 - adjustedReadiness) / 2) // 16–24 months
    : 24 + Math.round((30 - adjustedReadiness));    // 24+ months
  const center = new Date(now);
  center.setMonth(center.getMonth() + monthsOut);
  const start = new Date(center);
  start.setMonth(start.getMonth() - 2);
  const end = new Date(center);
  end.setMonth(end.getMonth() + 2);

  const conf = classifyConfidence(adjustedReadiness);
  const stat = classifyStatus(adjustedReadiness);
  return {
    providerId: profile.providerId,
    estimatedIpoMonth: center.toISOString().slice(0, 7),
    credibleWindowStart: start.toISOString().slice(0, 7),
    credibleWindowEnd: end.toISOString().slice(0, 7),
    confidence: conf,
    confidenceScore: adjustedReadiness,
    rumourQuality: classifyRumourQuality(adjustedReadiness),
    forecastStatus: stat.status,
    forecastStatusLabel: stat.label,
    behaviourForecast: pickBehaviour(profile),
    dataStatus: signal.sourceIds.length > 0 ? "estimated" : "seed",
    sourceRequired: false,
    sourceIds: signal.sourceIds,
    evidenceGrade: signal.sourceIds.length > 0 ? "E2" : "E1",
    sourceNames: signal.sourceIds.length > 0 ? ["AI Enterprise classified-news monitor"] : [],
    sourceUrls: [],
    sourceDates: [],
    relativeTo: "ipo_offer_price",
    hasVerifiedOfferPrice: false,
    warning: "Modelled forecast, not a factual listing date. Updated daily from public commentary.",
    notes: `Deterministic estimate based on seed readiness (${baseReadiness}) plus news-signal lift (${signal.readinessLift > 0 ? "+" : ""}${signal.readinessLift}). ${signal.rationale.length === 0 ? "No IPO-specific news signals matched." : `Detected signals: ${signal.rationale.slice(0, 3).join("; ")}.`}`,
    uncertaintyNotes: signal.sourceIds.length === 0
      ? ["No classified news matched IPO-relevant keywords — band is baseline only."]
      : [],
  };
}

/** Map a seed profile to one of the existing IPOBehaviourForecast labels. */
function pickBehaviour(profile: IPOProfile): IPOBehaviourForecast {
  // IPOProfile does not carry a behaviourForecast field — infer from
  // the seed's pricingRisk / lockupRisk.
  if (profile.pricingRisk === "high") return "mega_hype_valuation_sensitive";
  if (profile.pricingRisk === "medium_high") return "enterprise_ai_valuation_dependent";
  return "enterprise_agentic_watch";
}

/* ─── LLM-driven path ───────────────────────────────────────────── */

interface LlmForecastShape {
  estimatedIpoMonth: string | null;
  credibleWindowStart: string | null;
  credibleWindowEnd: string | null;
  confidenceScore: number;
  rumourQuality: RumourQuality;
  forecastStatus: IPOForecastStatus;
  forecastStatusLabel: string;
  expectedPriceVolatilityBand: "narrow" | "moderate" | "wide";
  expectedLockupRiskBand: "low" | "medium" | "high";
  narrative: string;
  rationale: string[];
}

async function llmEstimate(
  profile: IPOProfile,
  news: NewsItem[],
): Promise<IPOForecast | null> {
  if (!hasLLM()) return null;
  const signal = scoreNewsForVendor(profile.providerId, news);
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const recentHeadlines = news
      .filter((n) => n.vendors.includes(profile.providerId) || n.vendors.includes(`vendor_${profile.providerId}`))
      .slice(0, 8)
      .map((n) => `- "${n.title}" — ${n.summary}`)
      .join("\n");
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 } as never],
      messages: [{
        role: "user",
        content: `Estimate the IPO readiness, date band, and rumour quality for ${profile.providerId.toUpperCase()} (a private AI vendor) using:
  1. The classified news headlines below (already in our system).
  2. Public market commentary you can find via web search — banker rumours, S-1 filings, secondary-sale valuations, lock-up disclosures, and credible reporting from Bloomberg, Reuters, The Information, WSJ.

CLASSIFIED NEWS (last 60d, from our monitor):
${recentHeadlines || "(none in our store)"}

Seed baseline: readinessScore=${profile.readinessScore}/100, pricingRisk=${profile.pricingRisk}, lockupRisk=${profile.lockupRisk}.
Detected internal signals: ${signal.rationale.length > 0 ? signal.rationale.join("; ") : "none"}.

Return ONLY a JSON object, no markdown, no prose:
{
  "estimatedIpoMonth": "YYYY-MM" or null,
  "credibleWindowStart": "YYYY-MM" or null,
  "credibleWindowEnd": "YYYY-MM" or null,
  "confidenceScore": <0..100 integer>,
  "rumourQuality": "R0" | "R1" | "R2" | "R3" | "R4" | "R5",
  "forecastStatus": "active_process" | "likely_near_term" | "plausible_watch" | "broad_window_only" | "no_reliable_month_estimate",
  "forecastStatusLabel": "<short label>",
  "expectedPriceVolatilityBand": "narrow" | "moderate" | "wide",
  "expectedLockupRiskBand": "low" | "medium" | "high",
  "narrative": "<2-3 sentence summary of what your web search found>",
  "rationale": ["bullet 1", "bullet 2", "bullet 3"]
}

Be conservative. If you cannot find recent credible commentary, set confidenceScore lower and rumourQuality to "speculative" or "low_quality".`,
      }],
    });
    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as LlmForecastShape;
    return {
      providerId: profile.providerId,
      estimatedIpoMonth: parsed.estimatedIpoMonth,
      credibleWindowStart: parsed.credibleWindowStart,
      credibleWindowEnd: parsed.credibleWindowEnd,
      confidence: classifyConfidence(parsed.confidenceScore),
      confidenceScore: parsed.confidenceScore,
      rumourQuality: parsed.rumourQuality,
      forecastStatus: parsed.forecastStatus,
      forecastStatusLabel: parsed.forecastStatusLabel,
      behaviourForecast: pickBehaviour(profile),
      dataStatus: "estimated",
      sourceRequired: false,
      sourceIds: signal.sourceIds,
      evidenceGrade: "E3",
      sourceNames: ["Claude web-search synthesis", "AI Enterprise classified-news monitor"],
      sourceUrls: [],
      sourceDates: [new Date().toISOString().slice(0, 10)],
      relativeTo: "ipo_offer_price",
      hasVerifiedOfferPrice: false,
      warning: "LLM-synthesised forecast from public commentary. Verify against S-1 / pricing range before use.",
      notes: `${parsed.narrative} ${parsed.rationale.slice(0, 3).join("; ")}`,
      uncertaintyNotes: parsed.confidenceScore < 50
        ? ["LLM low-confidence signal — treat as rumour until S-1 confirms."]
        : [],
    };
  } catch {
    return null;
  }
}

/* ─── Public API ────────────────────────────────────────────────── */

export interface IpoEstimateReport {
  providerId: string;
  source: "llm" | "deterministic";
  signalCount: number;
}

export async function estimateAllIpoForecasts(): Promise<{ forecasts: IPOForecast[]; reports: IpoEstimateReport[] }> {
  const news = await listNewsItems().catch(() => [] as NewsItem[]);
  const forecasts: IPOForecast[] = [];
  const reports: IpoEstimateReport[] = [];
  for (const profile of IPO_PROFILES) {
    const llm = await llmEstimate(profile, news);
    if (llm) {
      forecasts.push(llm);
      reports.push({ providerId: profile.providerId, source: "llm", signalCount: llm.sourceIds.length });
    } else {
      const det = deterministicEstimate(profile, news);
      forecasts.push(det);
      reports.push({ providerId: profile.providerId, source: "deterministic", signalCount: det.sourceIds.length });
    }
  }
  return { forecasts, reports };
}
