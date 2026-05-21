// Vendor "health" composite — single source of truth.
// ──────────────────────────────────────────────────
// The dashboard's "Who's losing" filter is multi-signal: momentum,
// share drift, risk depth, evidence gap. The quadrant chart used to
// look only at raw momentum, so a vendor on the losing list could
// still land in the Leaders quadrant (e.g. high score + decent momentum
// + 3 open risks). That's a contradiction users notice.
//
// This module collapses the same signal set into ONE scalar (0-100)
// where lower = unhealthier = "losing". Both surfaces import from
// here so they cannot disagree.

import type { Vendor } from "./types";

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
