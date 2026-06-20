// Vendor-score recompute.
// ──────────────────────
// Re-derives the headline ranking metrics on IntelligenceVendor and
// VendorMomentum from the read tables the projector has already
// updated, so the dashboard / ranking / winning-losing lists track
// fresh evidence rather than the original seed values.
//
//   IntelligenceVendor.overallScore     ← weighted pillar average
//   IntelligenceVendor.confidenceScore  ← evidence-depth (verified-row count)
//   VendorMomentum.newsVelocity         ← count of recent news items
//   VendorMomentum.productVelocity      ← count of recent capability updates
//   VendorMomentum.momentumScore        ← re-derived from velocity inputs
//
// We do NOT touch pillar scores here — those are projector territory.
// What we close is the loop between projector outputs and the
// scalars the UI actually reads.

import { getPrisma, hasDatabase } from "../prisma";
import { PILLARS } from "../types";

// Dashboard base weights are derived from the SAME canonical PILLARS source the
// assessment engine starts from (lib/types.ts), so the two scoring pathways no
// longer drift apart on a duplicated constant. The dashboard score is the
// context-free baseline (these base weights); the per-buyer assessment engine
// then layers industry + tier deltas on top — that's the legitimate difference.
// Model quality (Arena ELO, written as a `model_quality` pillar row by
// seedEloPillarScores) is folded into the dashboard ranking at a fixed weight,
// with the canonical six scaled down to leave room for it, so a model
// provider's overallScore reflects raw model capability — not just enterprise/
// market pillars. Only model providers carry a model_quality row; derive-scores
// normalizes by the weights of the pillars each vendor actually has, so a vendor
// WITHOUT model_quality is simply scored over the six rebalanced base weights
// (relative ranking unchanged). This is a dashboard-scoring concern only — the
// canonical PILLARS set (and the per-buyer assessment engine) stays at six.
const MODEL_QUALITY_WEIGHT = 0.2;
const BASE_PILLAR_SCALE = 1 - MODEL_QUALITY_WEIGHT; // 0.80
const PILLAR_WEIGHTS: Record<string, number> = {
  ...Object.fromEntries(PILLARS.map((p) => [p.id, p.defaultWeight * BASE_PILLAR_SCALE])),
  model_quality: MODEL_QUALITY_WEIGHT,
};

// Minimum distinct pillar rows before pillar average overrides overallScore.
// Prevents a single sourcing run from crashing an ELO-anchored score.
const MIN_PILLAR_COUNT = 3;

/** Cut-off windows used by the velocity inputs. */
const NEWS_WINDOW_DAYS = 30;
const CAPABILITY_WINDOW_DAYS = 30;
const EVIDENCE_WINDOW_DAYS = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface DeriveResult {
  skipped: boolean;
  reason?: string;
  vendorsUpdated: number;
  momentumRowsUpdated: number;
  scoreShifts: { vendorId: string; from: number; to: number }[];
}

/**
 * Recompute IntelligenceVendor.overallScore + confidenceScore and
 * VendorMomentum velocity-driven fields for every vendor.
 *
 * Idempotent + safe to run repeatedly. No-op when there's no database.
 */
export async function deriveVendorScores(now: Date = new Date()): Promise<DeriveResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", vendorsUpdated: 0, momentumRowsUpdated: 0, scoreShifts: [] };
  }
  const prisma = getPrisma();
  const newsCutoff = new Date(now.getTime() - NEWS_WINDOW_DAYS * 86400 * 1000);
  const capCutoff = new Date(now.getTime() - CAPABILITY_WINDOW_DAYS * 86400 * 1000);
  const evCutoff = new Date(now.getTime() - EVIDENCE_WINDOW_DAYS * 86400 * 1000);

  // 1. Snapshot the current scalar state we're about to recompute.
  const vendors = await prisma.intelligenceVendor.findMany({
    select: { id: true, overallScore: true, confidenceScore: true },
  });

  // 2. Pull the inputs in three bulk queries — much cheaper than
  //    per-vendor reads when the universe is small (<100 vendors).
  const [pillarRows, newsRows, capRows, evRows] = await Promise.all([
    prisma.intelligencePillarScore.findMany({
      select: { vendorId: true, pillar: true, capabilityScore: true, confidence: true },
    }),
    prisma.intelligenceNewsItem.findMany({
      where: { publishedAt: { gte: newsCutoff } },
      select: { vendors: true, publishedAt: true, impactScore: true },
    }),
    prisma.vendorCapability.findMany({
      where: { lastVerified: { gte: capCutoff } },
      select: { vendorId: true },
    }),
    prisma.evidenceRecord.findMany({
      where: {
        capturedAt: { gte: evCutoff },
        // Only verified evidence feeds confidence — curated seed +
        // agent-extracted proposals are intentionally excluded.
        reviewStatus: "analyst_verified",
      },
      select: { vendorId: true, evidenceGrade: true },
    }).catch(() => []),
  ]);

  // 3. Per-vendor aggregation.
  type Agg = {
    pillarWeightedSum: number;
    pillarWeightSum: number;
    pillarConfidenceSum: number;
    pillarCount: number;
    newsVelocity: number;
    productVelocity: number;
    verifiedEvidence: number;
  };
  const empty = (): Agg => ({
    pillarWeightedSum: 0, pillarWeightSum: 0,
    pillarConfidenceSum: 0, pillarCount: 0,
    newsVelocity: 0, productVelocity: 0, verifiedEvidence: 0,
  });
  const agg = new Map<string, Agg>();
  for (const v of vendors) agg.set(v.id, empty());

  for (const p of pillarRows) {
    const a = agg.get(p.vendorId);
    if (!a) continue;
    const w = PILLAR_WEIGHTS[p.pillar] ?? 0;
    if (w === 0) continue;
    a.pillarWeightedSum += p.capabilityScore * w;
    a.pillarWeightSum += w;
    a.pillarConfidenceSum += p.confidence;
    a.pillarCount += 1;
  }

  for (const n of newsRows) {
    // Impact-weight the velocity so a major launch (impact 80) counts more
    // than routine coverage (impact 40), rather than a flat +1 per row.
    // 50-impact ≈ 1.0, 80 ≈ 1.6, capped [0.4, 2.0]; null impact → 1.0.
    const weight = clamp((n.impactScore ?? 50) / 50, 0.4, 2.0);
    for (const vendorId of n.vendors) {
      const a = agg.get(vendorId);
      if (a) a.newsVelocity += weight;
    }
  }

  for (const c of capRows) {
    const a = agg.get(c.vendorId);
    if (a) a.productVelocity += 1;
  }

  // Evidence-grade weights for the confidence input. E5 (independent audit /
  // certified benchmark) is the STRONGEST and E1 (vendor marketing claim) the
  // weakest — matching the engine's E5-is-best convention. (The previous scale
  // here was inverted: E1=1.5 / E5 absent, so marketing claims boosted
  // confidence more than audited evidence. Audit fix.)
  const GRADE_WEIGHT: Record<string, number> = {
    E5: 1.5, E4: 1.2, E3: 0.9, E2: 0.6, E1: 0.3, E0: 0.1,
  };
  for (const ev of evRows as Array<{ vendorId: string; evidenceGrade: string }>) {
    const a = agg.get(ev.vendorId);
    if (!a) continue;
    a.verifiedEvidence += GRADE_WEIGHT[ev.evidenceGrade] ?? 0.5;
  }

  // 4. Derive scalars + write back. Per-row updates keep this safe
  //    even when the vendor universe grows; total writes ≤ 2 ×
  //    vendorCount which is tiny.
  const scoreShifts: { vendorId: string; from: number; to: number }[] = [];
  let vendorsUpdated = 0;
  let momentumRowsUpdated = 0;

  for (const v of vendors) {
    const a = agg.get(v.id)!;

    // Overall score: weighted pillar average (0-100). Requires MIN_PILLAR_COUNT
    // distinct pillar rows before overriding — a single write from one sourcing
    // run cannot crash an ELO-anchored or analyst-seeded score.
    const newOverall = a.pillarCount >= MIN_PILLAR_COUNT && a.pillarWeightSum > 0
      ? clamp(a.pillarWeightedSum / a.pillarWeightSum, 0, 100)
      : v.overallScore;

    // Confidence: floor at 30 (we always know SOMETHING) + a
    // log-shape boost from verified-evidence depth so the curve
    // doesn't blow past 95 on a vendor with 100 rows.
    const evidenceBoost = a.verifiedEvidence > 0
      ? 35 * (1 - Math.exp(-a.verifiedEvidence / 6))
      : 0;
    const pillarConfFloor = a.pillarCount > 0
      ? a.pillarConfidenceSum / a.pillarCount * 0.4
      : 0;
    const newConfidence = clamp(30 + evidenceBoost + pillarConfFloor, 0, 99);

    const roundedOverall = Math.round(newOverall * 10) / 10;
    const roundedConfidence = Math.round(newConfidence * 10) / 10;

    if (Math.abs(roundedOverall - v.overallScore) > 0.05 || Math.abs(roundedConfidence - v.confidenceScore) > 0.05) {
      await prisma.intelligenceVendor.update({
        where: { id: v.id },
        data: { overallScore: roundedOverall, confidenceScore: roundedConfidence },
      });
      scoreShifts.push({ vendorId: v.id, from: v.overallScore, to: roundedOverall });
      vendorsUpdated += 1;
    }

    // Momentum: re-derive momentumScore from velocity inputs. We
    // upsert so vendors without an existing row still get one.
    const newsComponent = clamp(45 + Math.min(45, a.newsVelocity * 6), 0, 100);
    const productComponent = clamp(40 + Math.min(50, a.productVelocity * 5), 0, 100);
    const newMomentum = clamp(0.55 * newsComponent + 0.45 * productComponent, 0, 100);
    const roundedMomentum = Math.round(newMomentum);

    try {
      await prisma.vendorMomentum.upsert({
        where: { vendorId_period: { vendorId: v.id, period: "rolling_30d" } },
        create: {
          vendorId: v.id,
          period: "rolling_30d",
          momentumScore: roundedMomentum,
          newsVelocity: Math.round(newsComponent),
          productVelocity: Math.round(productComponent),
          adoptionSignal: 50, hiringSignal: 50, customerSignal: 50,
          partnerSignal: 50, marketShareMovement: 0, riskSignal: 50,
          confidence: roundedConfidence,
        },
        update: {
          momentumScore: roundedMomentum,
          newsVelocity: Math.round(newsComponent),
          productVelocity: Math.round(productComponent),
          confidence: roundedConfidence,
        },
      });
      momentumRowsUpdated += 1;
    } catch {
      // Skip a single vendor's momentum failure rather than aborting
      // the whole pass.
    }
  }

  return {
    skipped: false,
    vendorsUpdated,
    momentumRowsUpdated,
    scoreShifts: scoreShifts.slice(0, 20), // cap return-payload size
  };
}
