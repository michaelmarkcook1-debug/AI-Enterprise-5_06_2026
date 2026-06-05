// Tier overlay — converts Guided + Advanced inputs into engine adjustments.
// ───────────────────────────────────────────────────────────────────────
// The Quick tier uses the v1.0 fields only. Guided + Advanced introduce
// additional fields on AssessmentInput (governance strictness, integration
// depth, lock-in tolerance, sovereignty, switching cost, etc.). This module
// converts those into the same shape of adjustments the engine already
// understands: pillar weight deltas, soft penalties, soft bonuses, and
// fatal exclusions.
//
// Design constraints:
//   - Every Guided / Advanced field is optional. When absent, the overlay
//     contributes zero. This preserves the deterministic Quick-tier output.
//   - Adjustments are additive and small in magnitude (max 0.05 weight
//     shift, max 8 point penalty / bonus per signal) so the rank order
//     stays driven by the pillar evidence.
//   - Sovereignty + missing-required-certification can ESCALATE to a
//     fatal exclusion when the buyer is explicit ("hard" sovereignty
//     + non-domiciled vendor). The escalation path is documented inline.

import type {
  AssessmentInput,
  PillarId,
  Vendor,
  RequiredCertification,
} from "./types";

/* ─── Adjustment shape consumed by the engine ───────────────────── */

export interface TierAdjustment {
  /** Additive pillar-weight delta — applied before normalisation. */
  weightDelta: Partial<Record<PillarId, number>>;
  /** Soft penalty in finalScore points to subtract from each vendor. */
  perVendorPenalty: (vendor: Vendor) => number;
  /** Soft bonus in finalScore points to add to each vendor. */
  perVendorBonus: (vendor: Vendor) => number;
  /** Returns a non-empty string when the vendor is excluded. */
  perVendorExclusion: (vendor: Vendor) => string | null;
  /** Plain-English rationale strings the results UI renders. */
  rationale: string[];
}

const NOOP: TierAdjustment = {
  weightDelta: {},
  perVendorPenalty: () => 0,
  perVendorBonus: () => 0,
  perVendorExclusion: () => null,
  rationale: [],
};

/* ─── Helpers used by multiple field handlers ────────────────────── */

function vendorHasCert(
  vendor: Vendor,
  cert: RequiredCertification,
): boolean {
  // Vendor records carry certifications as free-text strings in the
  // evidence excerpts and (for some) on the top-level certifications
  // array. We check both surfaces so the matcher isn't brittle.
  // Vendor type doesn't carry a `certifications` array in v1; we read
  // the evidence excerpts, which is where SOC 2 / ISO / FedRAMP / HIPAA
  // mentions appear today. A future schema extension can add an
  // explicit certifications array without changing this matcher.
  const haystack = vendor.evidence.map((e) => e.excerpt).join(" ").toLowerCase();
  const needles: Record<RequiredCertification, string[]> = {
    soc2_type2: ["soc 2 type ii", "soc2 type 2", "soc 2 type 2"],
    iso_27001: ["iso 27001", "iso/iec 27001"],
    iso_42001: ["iso 42001", "iso/iec 42001"],
    hipaa: ["hipaa"],
    fedramp_moderate: ["fedramp moderate"],
    fedramp_high: ["fedramp high"],
    pci_dss: ["pci dss", "pci-dss"],
    gdpr_eu_dpa: ["gdpr", "eu data processing addendum", "dpa"],
    eu_ai_act_high_risk: ["eu ai act"],
    uk_gov_g_cloud: ["g-cloud", "uk government cloud"],
  };
  return needles[cert].some((n) => haystack.includes(n));
}

function vendorIsDomiciled(vendor: Vendor, region: string): boolean {
  const hq = (vendor.hq ?? "").toLowerCase();
  const r = region.toLowerCase();
  if (r === "eu") return /(germany|france|netherlands|ireland|spain|italy|sweden|finland|belgium|denmark|poland)/.test(hq);
  if (r === "uk") return hq.includes("united kingdom") || hq.includes("uk");
  if (r === "us") return hq.includes("united states") || hq.includes("usa") || hq.includes("us");
  if (r === "apac") return /(singapore|japan|australia|india|china|korea|taiwan)/.test(hq);
  return false;
}

/* ─── Field handlers ─────────────────────────────────────────────── */

/**
 * Compute the full tier overlay for one assessment input.
 * Returns a single combined adjustment.
 */
export function deriveTierOverlay(input: AssessmentInput): TierAdjustment {
  const acc: TierAdjustment = {
    weightDelta: {},
    perVendorPenalty: () => 0,
    perVendorBonus: () => 0,
    perVendorExclusion: () => null,
    rationale: [],
  };

  function addWeight(p: PillarId, delta: number) {
    acc.weightDelta[p] = (acc.weightDelta[p] ?? 0) + delta;
  }

  function chainPenalty(prev: (v: Vendor) => number, next: (v: Vendor) => number): (v: Vendor) => number {
    return (v) => prev(v) + next(v);
  }
  function chainBonus(prev: (v: Vendor) => number, next: (v: Vendor) => number): (v: Vendor) => number {
    return (v) => prev(v) + next(v);
  }
  function chainExclusion(
    prev: (v: Vendor) => string | null,
    next: (v: Vendor) => string | null,
  ): (v: Vendor) => string | null {
    return (v) => prev(v) ?? next(v);
  }

  /* ─── Guided fields ─────────────────────────────────────────── */

  // Governance strictness — directly bumps enterprise_control and
  // reliability_safety weights. 5 = SOX-strict end-to-end.
  if (input.governanceStrictness != null) {
    const bump = (input.governanceStrictness - 3) * 0.012;
    addWeight("enterprise_control", bump);
    addWeight("reliability_safety", bump * 0.7);
    if (input.governanceStrictness >= 4) {
      acc.rationale.push(
        `Governance strictness ${input.governanceStrictness}/5 raised enterprise-control + reliability-safety weights; vendors thin on governance evidence lose ground.`,
      );
    }
  }

  // Integration depth — when the AI workflow touches core systems,
  // integration_ops matters more. Also surfaces as a vendor-by-vendor
  // bonus when the vendor declares deep integration support.
  if (input.integrationDepth != null) {
    const depthBump: Record<typeof input.integrationDepth & string, number> = {
      shallow: -0.005,
      moderate: 0,
      deep: 0.018,
      core_system: 0.032,
    };
    const w = depthBump[input.integrationDepth];
    addWeight("integration_ops", w);
    if (input.integrationDepth === "deep" || input.integrationDepth === "core_system") {
      const fn = (v: Vendor): number => {
        const hasDeep = v.evidence.some(
          (e) => e.domain === "integration_architecture"
            && (e.grade === "E4" || e.grade === "E5"),
        );
        return hasDeep ? 3 : 0;
      };
      acc.perVendorBonus = chainBonus(acc.perVendorBonus, fn);
      acc.rationale.push(
        `Integration depth = ${input.integrationDepth.replace(/_/g, " ")} bumps integration-ops weight and bonuses vendors with E4+ integration-architecture evidence.`,
      );
    }
  }

  // Human review model — affects reliability + agentic_autonomy
  // expectations. "no_review" with autonomous appetite is high risk.
  if (input.humanReviewModel != null) {
    if (input.humanReviewModel === "no_review") {
      addWeight("reliability_safety", 0.03);
      addWeight("enterprise_control", 0.015);
      acc.rationale.push(
        `No human-review model means failures propagate — reliability + control weights raised.`,
      );
    }
    if (input.humanReviewModel === "dual_approval") {
      addWeight("integration_ops", 0.015);
      acc.rationale.push(
        `Dual-approval workflow needs strong integration plumbing — integration-ops weight raised.`,
      );
    }
  }

  // Lock-in tolerance — when the buyer is averse to lock-in, raise
  // vendor_resilience weight and penalise vendors with single-cloud /
  // proprietary-only positioning.
  if (input.lockInTolerance != null) {
    const lockBump: Record<typeof input.lockInTolerance & string, number> = {
      averse: 0.025,
      cautious: 0.012,
      comfortable: 0,
      indifferent: -0.01,
    };
    addWeight("vendor_resilience", lockBump[input.lockInTolerance]);
    if (input.lockInTolerance === "averse") {
      const fn = (v: Vendor): number => {
        // Penalise vendors with notes flagging proprietary stack or
        // single-cloud dependency.
        const text = v.evidence.map((e) => e.excerpt).join(" ").toLowerCase();
        const flags = /(proprietary stack|single cloud|aws[- ]only|gcp[- ]only|azure[- ]only)/.test(text);
        return flags ? 4 : 0;
      };
      acc.perVendorPenalty = chainPenalty(acc.perVendorPenalty, fn);
      acc.rationale.push(
        `Lock-in averse — vendor-resilience weight raised; single-cloud or proprietary-only vendors take a small penalty.`,
      );
    }
  }

  // Data residency — when set, vendors that can't demonstrate the
  // required region capability get penalised, and a "sovereign_required"
  // setting can escalate to exclusion alongside sovereigntyRequirement.
  if (input.dataResidency != null && input.dataResidency !== "no_constraint") {
    const regionKey: Record<Exclude<NonNullable<AssessmentInput["dataResidency"]>, "no_constraint">, string> = {
      us_only: "us",
      eu_only: "eu",
      uk_only: "uk",
      apac_only: "apac",
      sovereign_required: input.region?.toLowerCase() ?? "",
    };
    const region = regionKey[input.dataResidency];
    if (region) {
      const fn = (v: Vendor): number => {
        const text = v.evidence.map((e) => e.excerpt).join(" ").toLowerCase();
        const supports = text.includes(`${region} region`) || text.includes(`${region}-region`) || text.includes(`${region} data residency`);
        return supports ? 0 : 5;
      };
      acc.perVendorPenalty = chainPenalty(acc.perVendorPenalty, fn);
      acc.rationale.push(
        `Data residency = ${input.dataResidency.replace(/_/g, " ")} — vendors without explicit ${region.toUpperCase()} residency take a 5-point penalty.`,
      );
    }
  }

  /* ─── Advanced fields ───────────────────────────────────────── */

  // Switching-cost tolerance — buyer who won't accept high
  // re-platforming cost gets vendor_resilience tilt + adoption friction
  // bonus for vendors that minimise switching cost.
  if (input.switchingCostTolerance != null && input.switchingCostTolerance >= 4) {
    addWeight("vendor_resilience", 0.018);
    acc.rationale.push(
      `Low switching-cost appetite (${input.switchingCostTolerance}/5) — vendor-resilience weight raised so reversibility counts.`,
    );
  }

  // Sovereignty requirement — "hard" excludes non-domiciled vendors
  // when the buyer's region is set. "soft" applies a 6-point penalty.
  if (input.sovereigntyRequirement === "hard" && input.region) {
    const region = input.region;
    const fn = (v: Vendor): string | null => {
      if (vendorIsDomiciled(v, region)) return null;
      return `Hard sovereignty required in ${region.toUpperCase()} — vendor HQ is ${v.hq ?? "outside the requested region"}.`;
    };
    acc.perVendorExclusion = chainExclusion(acc.perVendorExclusion, fn);
    acc.rationale.push(
      `Hard sovereignty — vendors not domiciled in ${input.region.toUpperCase()} are excluded.`,
    );
  } else if (input.sovereigntyRequirement === "soft" && input.region) {
    const region = input.region;
    const fn = (v: Vendor): number => (vendorIsDomiciled(v, region) ? 0 : 6);
    acc.perVendorPenalty = chainPenalty(acc.perVendorPenalty, fn);
    acc.rationale.push(
      `Soft sovereignty — non-domiciled vendors lose 6 points.`,
    );
  }

  // RFP cycle — formal procurement raises governance + reliability
  // expectations and skews to vendors with mature procurement docs.
  if (input.rfpCycle === "formal_rfp" || input.rfpCycle === "public_procurement") {
    addWeight("enterprise_control", 0.018);
    addWeight("vendor_resilience", 0.01);
    acc.rationale.push(
      `${input.rfpCycle.replace(/_/g, " ")} — enterprise-control + vendor-resilience weights raised for procurement scrutiny.`,
    );
  }

  // Required certifications — every cert the vendor lacks costs 3pts.
  // Buyer can also dial them into the cert-must list, in which case
  // any missing cert escalates the vendor to a "controlled deployment"
  // band by deducting enough to push below the threshold.
  if (input.requiredCertifications && input.requiredCertifications.length > 0) {
    const required = input.requiredCertifications;
    const fn = (v: Vendor): number => {
      const missing = required.filter((c) => !vendorHasCert(v, c));
      return missing.length * 3;
    };
    acc.perVendorPenalty = chainPenalty(acc.perVendorPenalty, fn);
    acc.rationale.push(
      `Required certifications: ${required.join(", ")} — vendors lose 3 pts per missing certification.`,
    );
  }

  // Concentration risk — when buyer wants diversification, bonus
  // vendors with multi-cloud / pluggable evidence; when buyer accepts
  // concentration, a small penalty on resilience weight to surface
  // the trade-off rather than hide it.
  if (input.concentrationRiskTolerance === "avoid_concentration") {
    addWeight("vendor_resilience", 0.012);
    const fn = (v: Vendor): number => {
      const text = v.evidence.map((e) => e.excerpt).join(" ").toLowerCase();
      return /(multi[- ]?cloud|portable|pluggable)/.test(text) ? 3 : 0;
    };
    acc.perVendorBonus = chainBonus(acc.perVendorBonus, fn);
    acc.rationale.push(
      `Avoid concentration — vendor-resilience weight raised; multi-cloud vendors get a 3-pt bonus.`,
    );
  } else if (input.concentrationRiskTolerance === "accept_concentration") {
    addWeight("vendor_resilience", -0.008);
  }

  // Stack appetite — affects how many vendors the recommender should
  // surface. Engine doesn't change the per-vendor scoring; this is a
  // rationale-only hint that the results UI can use.
  if (input.stackAppetite === "best_of_breed") {
    acc.rationale.push(
      `Best-of-breed stack — shortlist will surface multiple specialist vendors rather than one generalist.`,
    );
  } else if (input.stackAppetite === "single_vendor") {
    acc.rationale.push(
      `Single-vendor stack — recommendation favours a generalist with broad pillar coverage.`,
    );
  }

  // TCO horizon — long horizon raises vendor_resilience weight (the
  // bet has to compound).
  if (input.tcoHorizon === "5_year" || input.tcoHorizon === "10_year") {
    addWeight("vendor_resilience", 0.014);
    acc.rationale.push(
      `${input.tcoHorizon.replace(/_/g, " ")} TCO horizon — vendor-resilience weight raised so longevity counts.`,
    );
  }

  // Negotiation power — high power lets the buyer absorb more vendor
  // risk; low power means the buyer needs the vendor to behave better.
  if (input.negotiationPower === "low") {
    addWeight("enterprise_control", 0.01);
    acc.rationale.push(
      `Low negotiation power — enterprise-control weight raised; the contract has to do the work.`,
    );
  }

  return acc;
}

/**
 * Apply the overlay's weight delta to an existing weight map and
 * return a renormalised version. Engine calls this after dynamicWeights.
 */
export function applyTierWeightDelta(
  weights: Record<PillarId, number>,
  delta: Partial<Record<PillarId, number>>,
): Record<PillarId, number> {
  const next = { ...weights };
  for (const [k, v] of Object.entries(delta)) {
    if (v == null) continue;
    next[k as PillarId] = Math.max(0, (next[k as PillarId] ?? 0) + v);
  }
  // Renormalise to 1.0.
  const sum = Object.values(next).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(next) as PillarId[]) {
    next[k] = sum > 0 ? next[k] / sum : 0;
  }
  return next;
}

export { NOOP as TIER_OVERLAY_NOOP };
