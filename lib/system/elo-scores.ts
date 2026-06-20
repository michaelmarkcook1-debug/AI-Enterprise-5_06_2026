// Arena ELO benchmark — Model Provider overall scoring.
//
// Source: https://openlm.ai/chatbot-arena/
// Method: top-2 Arena ELO average per vendor, normalized to 0-100.
// Normalization: linear anchor ELO 1050→30 (weak/limited) to ELO 1510→95 (current SOTA),
//   clamped [30, 97]. Fixed anchors (not min-max) so the scale is stable as
//   new vendors are added or removed from the tracked set.
//
// This module is the ONLY place overallScore is set for Model Provider vendors.
// derive-scores.ts will NOT override it unless a vendor has ≥3 pillar rows
// (see MIN_PILLAR_COUNT guard there).

import { getPrisma, hasDatabase } from "../prisma";

export const ARENA_ELO_SOURCE_URL = "https://openlm.ai/chatbot-arena/";

const ANCHOR_MIN_ELO = 1050;
const ANCHOR_MAX_ELO = 1510;
const SCORE_FLOOR = 30;
const SCORE_CEILING = 97;

/** Normalize an Arena ELO (top-2 average) to a 0–100 overallScore. */
export function normalizeElo(eloAvg: number): number {
  const span = ANCHOR_MAX_ELO - ANCHOR_MIN_ELO;       // 460
  const scoreSpan = SCORE_CEILING - SCORE_FLOOR;       // 67
  const raw = ((eloAvg - ANCHOR_MIN_ELO) / span) * scoreSpan + SCORE_FLOOR;
  return Math.round(Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, raw)));
}

// Top-2 Arena ELO average per vendor.
// Key = IntelligenceVendor.id — verified 2026-06-20 against the live DB, which
// uses BARE ids (e.g. "anthropic", "alibaba", "zai"), NOT a "vendor_" prefix.
// Note id≠slug for three: Alibaba/Qwen→"alibaba", Moonshot/Kimi→"moonshot",
// Zhipu/GLM (now Z.ai)→"zai".
// Fetched: 2026-06-20 from https://openlm.ai/chatbot-arena/
// Update this map each time the leaderboard is refreshed; bump fetchedAt.
export const VENDOR_ELO_MAP: Record<string, {
  topTwoAvg: number;
  top1: string;
  top2: string;
  fetchedAt: string;
}> = {
  "anthropic": { topTwoAvg: 1508.0, top1: "Claude Fable 5 (1510)",    top2: "Claude Opus 4.8 Thinking (1506)", fetchedAt: "2026-06-20" },
  "openai":    { topTwoAvg: 1500.5, top1: "GPT-5.5-high (1506)",       top2: "GPT-5.4-high (1495)",             fetchedAt: "2026-06-20" },
  "xai":       { topTwoAvg: 1489.0, top1: "Grok-4.20 (1496)",          top2: "Grok-4.1-Thinking (1482)",        fetchedAt: "2026-06-20" },
  "alibaba":   { topTwoAvg: 1476.0, top1: "Qwen3.7-Max (1486)",        top2: "Qwen3.5-Max (1466)",              fetchedAt: "2026-06-20" },
  "zai":       { topTwoAvg: 1477.5, top1: "GLM-5.2 (1488)",            top2: "GLM-5.1 (1467)",                  fetchedAt: "2026-06-20" },
  "moonshot":  { topTwoAvg: 1458.5, top1: "Kimi-K2.6-Thinking (1466)", top2: "Kimi-K2.5-Thinking (1451)",       fetchedAt: "2026-06-20" },
  "deepseek":  { topTwoAvg: 1456.0, top1: "DeepSeek-V4-Pro (1467)",    top2: "DeepSeek-V4-Flash (1445)",        fetchedAt: "2026-06-20" },
  "mistral":   { topTwoAvg: 1414.5, top1: "Mistral Large 3 (1428)",    top2: "Mistral Medium 3.1 (1401)",       fetchedAt: "2026-06-20" },
  "meta":      { topTwoAvg: 1388.5, top1: "Muse Spark (1485)",         top2: "Llama-4-Maverick (1292)",         fetchedAt: "2026-06-20" },
  "cohere":    { topTwoAvg: 1280.0, top1: "Command A 03-2025 (1327)",  top2: "Command R+ 08-2024 (1233)",       fetchedAt: "2026-06-20" },
};

export interface EloSeedResult {
  updated: number;
  skipped: number;
  notFound: string[];
  results: Array<{ vendorId: string; eloAvg: number; normalizedScore: number; top1: string; top2: string }>;
}

/**
 * Upsert overallScore for all vendors in VENDOR_ELO_MAP from the Arena ELO data.
 * Safe to run repeatedly — idempotent. Skips vendors not found in the DB.
 */
export async function seedEloScores(): Promise<EloSeedResult> {
  if (!hasDatabase()) {
    return { updated: 0, skipped: 0, notFound: [], results: [] };
  }
  const prisma = getPrisma();

  const result: EloSeedResult = { updated: 0, skipped: 0, notFound: [], results: [] };

  for (const [vendorId, data] of Object.entries(VENDOR_ELO_MAP)) {
    const score = normalizeElo(data.topTwoAvg);
    try {
      const existing = await prisma.intelligenceVendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!existing) {
        result.notFound.push(vendorId);
        result.skipped++;
        continue;
      }
      await prisma.intelligenceVendor.update({
        where: { id: vendorId },
        data: { overallScore: score },
      });
      result.results.push({ vendorId, eloAvg: data.topTwoAvg, normalizedScore: score, top1: data.top1, top2: data.top2 });
      result.updated++;
    } catch (err) {
      console.error(`[elo-scores] failed to update ${vendorId}:`, err);
      result.skipped++;
    }
  }

  return result;
}

export interface EloPillarSeedResult {
  updated: number;
  skipped: number;
  notFound: string[];
}

/**
 * Upsert the `model_quality` pillar row for every vendor in VENDOR_ELO_MAP from
 * Arena ELO. This is the DURABLE path that makes ELO part of the model ranking:
 * derive-scores folds the `model_quality` pillar into overallScore on every run
 * (see MODEL_QUALITY_WEIGHT in derive-scores.ts), so ELO survives the daily
 * recompute instead of being overwritten by it. Idempotent; BARE ids; skips
 * vendors absent from the DB. The evidence projector never writes model_quality
 * (no DomainId maps to it), so this row is never clobbered by sourcing.
 */
export async function seedEloPillarScores(): Promise<EloPillarSeedResult> {
  if (!hasDatabase()) return { updated: 0, skipped: 0, notFound: [] };
  const prisma = getPrisma();
  const result: EloPillarSeedResult = { updated: 0, skipped: 0, notFound: [] };

  for (const [vendorId, data] of Object.entries(VENDOR_ELO_MAP)) {
    const score = normalizeElo(data.topTwoAvg);
    const provenance = `Arena ELO top-2 avg ${data.topTwoAvg} (${data.top1}, ${data.top2})`;
    try {
      const existing = await prisma.intelligenceVendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!existing) {
        result.notFound.push(vendorId);
        result.skipped++;
        continue;
      }
      await prisma.intelligencePillarScore.upsert({
        where: { vendorId_pillar: { vendorId, pillar: "model_quality" } },
        create: {
          vendorId,
          pillar: "model_quality",
          capabilityScore: score,
          evidenceGrade: "E4",
          confidence: 90,
          strengths: [provenance],
          risks: [],
          missingEvidence: [],
        },
        update: {
          capabilityScore: score,
          evidenceGrade: "E4",
          confidence: 90,
          strengths: [provenance],
        },
      });
      result.updated++;
    } catch (err) {
      console.error(`[elo-scores] model_quality pillar upsert failed for ${vendorId}:`, err);
      result.skipped++;
    }
  }

  return result;
}
