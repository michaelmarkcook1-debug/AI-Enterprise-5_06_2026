// Vendor "health" composite + Gartner-style quadrant axes.
// ────────────────────────────────────────────────────────
// This module owns the math for two related surfaces:
//
//   1. computeVendorHealth — single scalar used for the dashboard's
//      "Who's losing" badge. Same signal set + weights as the legacy
//      losingScore in repository.ts so the two never disagree.
//
//   2. computeQuadrantAxes — the (vision, execute) pair used by the
//      Magic Quadrant chart. Folds in pillar scores + breadth, so
//      vendors actually separate across all four quadrants rather
//      than clustering on a diagonal.
//
// Both functions weight risk + share drift heavily enough that any
// vendor flagged as "losing" mechanically falls out of the Leaders
// quadrant (high execute AND high vision).

import type { Vendor, VendorPillarScore } from "./types";
import type { PillarId } from "../types";

export interface VendorHealthInputs {
  vendor: Vendor;
  /** VendorMomentum.momentumScore for this vendor, or null if absent. */
  momentumScore: number | null;
  /**
   * Aggregate negative share delta across all categories this vendor
   * appears in. 0 if non-negative or unknown; otherwise a positive
   * number expressing how many points of share they've lost.
   */
  negativeShareDelta: number;
}

export interface VendorHealth {
  /** 0-100 composite. Lower = unhealthier. */
  healthScore: number;
  /** True iff this vendor would appear in the dashboard "Who's losing" list. */
  isLosing: boolean;
  /** Per-signal contribution breakdown for tooltips / debugging. */
  signals: {
    momentum: number;
    riskDrag: number;
    shareDrag: number;
    confidenceDrag: number;
  };
}

/**
 * Compute the health composite + losing-list eligibility for ONE
 * vendor. Pure function so the result is deterministic + testable.
 *
 * Definition (mirrors lib/intelligence/repository.ts losingScore):
 *   healthScore = clamp(
 *     momentumOrSeed
 *       - 8   * riskCount                          (risk drag)
 *       - 1.5 * max(0, negativeShareDelta)         (share drag)
 *       - 0.3 * max(0, 70 - confidenceScore),      (evidence-gap drag)
 *     0, 100
 *   )
 *
 * Losing filter (mirrors the same file's losingVendors filter):
 *   momentum < 60  OR  share drop ≥ 3  OR  ≥ 2 open risks
 *
 * Coupling guarantee: a vendor with `isLosing === true` always has
 * healthScore < 60. The quadrant's default healthCut sits at 60, so
 * losing vendors are mechanically excluded from the Leaders quadrant.
 */
export function computeVendorHealth({ vendor, momentumScore, negativeShareDelta }: VendorHealthInputs): VendorHealth {
  const momentum = momentumScore ?? 50;
  const riskCount = vendor.riskProfile?.length ?? 0;
  const conf = vendor.confidenceScore ?? 50;

  const riskDrag = 8 * riskCount;
  const shareDrag = 1.5 * Math.max(0, negativeShareDelta);
  const confidenceDrag = 0.3 * Math.max(0, 70 - conf);

  const raw = momentum - riskDrag - shareDrag - confidenceDrag;
  const healthScore = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));

  const isLosing = momentum < 60 || negativeShareDelta >= 3 || riskCount >= 2;

  return {
    healthScore,
    isLosing,
    signals: {
      momentum: Math.round(momentum * 10) / 10,
      riskDrag: Math.round(riskDrag * 10) / 10,
      shareDrag: Math.round(shareDrag * 10) / 10,
      confidenceDrag: Math.round(confidenceDrag * 10) / 10,
    },
  };
}

// ─── Magic Quadrant axes ──────────────────────────────────────────────

export interface QuadrantAxesInputs {
  vendor: Vendor;
  momentumScore: number | null;
  negativeShareDelta: number;
  /** This vendor's pillar scores, keyed by pillar id. */
  pillarByPillar: Map<PillarId, VendorPillarScore>;
}

export interface QuadrantAxes {
  /** Y-axis. 0-100. Reliability, evidence depth, enterprise reach. */
  execute: number;
  /** X-axis. 0-100. Forward velocity, product ambition, market spread. */
  vision: number;
  /** Per-component breakdown for tooltips. */
  components: {
    execute: { confidence: number; reliability: number; breadth: number; riskDrag: number };
    vision: { momentum: number; product: number; useCases: number; shareDrag: number };
  };
}

function pillarOr(map: Map<PillarId, VendorPillarScore>, id: PillarId, fallback: number): number {
  return map.get(id)?.capabilityScore ?? fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Compute the (vision, execute) pair for one vendor.
 *
 * Design notes:
 *   - Execute = "can this vendor reliably ship enterprise AI today".
 *     Driven by evidence depth (confidence), enterprise-control +
 *     reliability-safety + vendor-resilience pillars, industry breadth,
 *     and a risk-count penalty.
 *
 *   - Vision = "how far ahead is the bet". Driven by momentum,
 *     business-fit + market-strength pillars, use-case breadth, and a
 *     share-drift penalty.
 *
 *   - The two share NO direct input — score appears on neither axis,
 *     so vendors that score equally well still separate by *type*
 *     (incumbents → Challengers, frontier labs → Visionaries).
 *
 *   - Losing-list compatibility: a vendor with ≥2 risks loses ≥14pts
 *     of execute; a vendor with momentum<60 loses ≥4pts of vision; a
 *     vendor with share drop ≥3 loses ≥4.5pts of vision. Default cuts
 *     of 60/60 mean every losing-list vendor falls out of Leaders.
 */
export function computeQuadrantAxes({
  vendor, momentumScore, negativeShareDelta, pillarByPillar,
}: QuadrantAxesInputs): QuadrantAxes {
  const momentum = momentumScore ?? 50;
  const conf = vendor.confidenceScore ?? 50;
  const riskCount = vendor.riskProfile?.length ?? 0;
  const industries = vendor.supportedIndustries?.length ?? 0;
  const useCases = vendor.supportedUseCases?.length ?? 0;

  // Execute components -------------------------------------------------
  const reliabilityPillarAvg = (
    pillarOr(pillarByPillar, "enterprise_control", 60)
    + pillarOr(pillarByPillar, "reliability_safety", 60)
    + pillarOr(pillarByPillar, "vendor_resilience", 60)
  ) / 3;
  const industryBreadth = Math.min(100, industries * 12);

  const execComponents = {
    confidence: conf * 0.40,
    reliability: reliabilityPillarAvg * 0.30,
    breadth: industryBreadth * 0.20,
    riskDrag: -7 * riskCount,
  };
  const executeRaw =
    execComponents.confidence
    + execComponents.reliability
    + execComponents.breadth
    + execComponents.riskDrag
    + 10; // gentle floor so a brand-new vendor with no pillar coverage isn't pinned at 0

  // Vision components --------------------------------------------------
  const ambitionPillarAvg = (
    pillarOr(pillarByPillar, "business_fit", 60)
    + pillarOr(pillarByPillar, "market_strength", 60)
    + pillarOr(pillarByPillar, "integration_ops", 60)
  ) / 3;
  const useCaseBreadth = Math.min(100, useCases * 10);

  const visionComponents = {
    momentum: momentum * 0.40,
    product: ambitionPillarAvg * 0.30,
    useCases: useCaseBreadth * 0.20,
    shareDrag: -1.5 * Math.max(0, negativeShareDelta),
  };
  const visionRaw =
    visionComponents.momentum
    + visionComponents.product
    + visionComponents.useCases
    + visionComponents.shareDrag
    + 10;

  return {
    execute: Math.round(clamp(executeRaw, 0, 100) * 10) / 10,
    vision: Math.round(clamp(visionRaw, 0, 100) * 10) / 10,
    components: {
      execute: {
        confidence: Math.round(execComponents.confidence * 10) / 10,
        reliability: Math.round(execComponents.reliability * 10) / 10,
        breadth: Math.round(execComponents.breadth * 10) / 10,
        riskDrag: Math.round(execComponents.riskDrag * 10) / 10,
      },
      vision: {
        momentum: Math.round(visionComponents.momentum * 10) / 10,
        product: Math.round(visionComponents.product * 10) / 10,
        useCases: Math.round(visionComponents.useCases * 10) / 10,
        shareDrag: Math.round(visionComponents.shareDrag * 10) / 10,
      },
    },
  };
}
