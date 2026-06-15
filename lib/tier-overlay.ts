// Tier overlay — converts Guided + Advanced inputs into engine adjustments.
// ───────────────────────────────────────────────────────────────────────
// The Quick tier uses the v1.0 fields only. Guided + Advanced introduce
// additional fields on AssessmentInput (governance strictness, integration
// depth, lock-in tolerance, sovereignty, build-vs-buy, model-quality bar,
// cost model, EU AI Act risk class, fact-derived leverage, etc.). This module
// converts those into the shape of adjustments the engine already understands:
// pillar weight deltas, soft penalties, soft bonuses, and fatal exclusions.
//
// v1.3 changes:
//   - The per-vendor matchers that previously scanned synthetic free-text
//     evidence excerpts (certifications, residency, lock-in, multi-cloud) now
//     read STRUCTURED vendor fields (certifications[], regions[],
//     deploymentModels[], ecosystemNative[]). When a vendor predates the
//     structured fields we fall back to the legacy excerpt scan so nothing
//     regresses.
//   - New handlers wire the v1.3 inputs: build-vs-buy, data-readiness,
//     change-sponsorship, EU AI Act use-case risk class, model-quality /
//     hallucination bar, eval-evidence requirements, acceptable pricing
//     models, exit requirements, fact-derived negotiation leverage, value at
//     stake, and industry systems-of-record.
//
// Design constraints (unchanged): every field is optional → absent = zero
// contribution; adjustments are additive and small so rank order stays driven
// by the pillar evidence; sovereignty + missing required certifications can
// escalate to a fatal exclusion when the buyer is explicit.

import type {
  AssessmentInput,
  PillarId,
  Vendor,
  RequiredCertification,
} from "./types";
import { concentrationOf, infraItemParent } from "./infrastructure";

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

/* ─── Structured-signal helpers (replace free-text excerpt scanning) ─ */

/** Cert aliases so buyer cert ids resolve against vendor cert tokens. */
const CERT_ALIASES: Record<RequiredCertification, string[]> = {
  soc2_type2: ["soc2_type2", "soc 2 type ii", "soc2 type 2"],
  iso_27001: ["iso_27001", "iso 27001", "iso/iec 27001"],
  iso_42001: ["iso_42001", "iso 42001", "iso/iec 42001"],
  hipaa: ["hipaa"],
  fedramp_moderate: ["fedramp_moderate", "fedramp moderate"],
  fedramp_high: ["fedramp_high", "fedramp high"],
  pci_dss: ["pci_dss", "pci dss", "pci-dss"],
  gdpr_eu_dpa: ["gdpr_eu_dpa", "gdpr", "eu dpa", "dpa"],
  eu_ai_act_high_risk: ["eu_ai_act_high_risk", "eu ai act"],
  uk_gov_g_cloud: ["uk_gov_g_cloud", "g-cloud", "uk government cloud"],
  cmmc_l2: ["cmmc_l2", "cmmc level 2", "cmmc"],
  nist_800_171: ["nist_800_171", "nist 800-171", "800-171"],
  nerc_cip: ["nerc_cip", "nerc cip"],
  iec_62443: ["iec_62443", "iec 62443"],
  fedramp_high_il5: ["fedramp_high_il5", "il5", "fedramp high il5"],
};

/**
 * Does the vendor hold a certification? Structured-first: if the vendor has a
 * `certifications[]` array we treat it as authoritative. Otherwise we fall
 * back to the legacy free-text excerpt scan so un-migrated vendors don't all
 * fail uniformly.
 */
function vendorHasCert(vendor: Vendor, cert: RequiredCertification): boolean {
  const aliases = CERT_ALIASES[cert];
  if (vendor.certifications && vendor.certifications.length > 0) {
    const held = new Set(vendor.certifications.map((c) => c.toLowerCase()));
    return aliases.some((a) => held.has(a.toLowerCase()));
  }
  const haystack = vendor.evidence.map((e) => e.excerpt).join(" ").toLowerCase();
  return aliases.some((a) => haystack.includes(a));
}

/** Regions the vendor can demonstrably serve (structured, with hq fallback). */
function vendorServesRegion(vendor: Vendor, region: string): boolean {
  const r = region.toLowerCase();
  if (vendor.regions && vendor.regions.length > 0) {
    return vendor.regions.map((x) => x.toLowerCase()).includes(r);
  }
  // Legacy fallback: parse hq.
  const hq = (vendor.hq ?? "").toLowerCase();
  if (r === "eu") return /(germany|france|netherlands|ireland|spain|italy|sweden|finland|belgium|denmark|poland|eu)/.test(hq);
  if (r === "uk") return hq.includes("united kingdom") || /\buk\b/.test(hq);
  if (r === "us") return hq.includes("united states") || hq.includes("usa") || /\bus\b/.test(hq);
  if (r === "apac") return /(singapore|japan|australia|india|china|korea|taiwan|apac)/.test(hq);
  return false;
}

function vendorIsDomiciled(vendor: Vendor, region: string): boolean {
  // Domicile = serves the region (structured regions) OR hq is in-region.
  return vendorServesRegion(vendor, region);
}

/** True when the vendor offers a portable / reversible deployment model. */
function vendorIsPortable(vendor: Vendor): boolean {
  const models = vendor.deploymentModels ?? vendor.supportedDeployments ?? [];
  return models.some((m) => m === "self_host" || m === "on_prem" || m === "vpc" || m === "byoc");
}

/** Distinct vendor-family parents the vendor's native stack spans. */
function vendorParentSpread(vendor: Vendor): number {
  const parents = new Set<string>();
  for (const id of vendor.ecosystemNative ?? []) {
    const p = infraItemParent(id);
    if (p) parents.add(p);
  }
  return parents.size;
}

/* ─── Public builder ─────────────────────────────────────────────── */

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
  function chainPenalty(next: (v: Vendor) => number) {
    const prev = acc.perVendorPenalty;
    acc.perVendorPenalty = (v) => prev(v) + next(v);
  }
  function chainBonus(next: (v: Vendor) => number) {
    const prev = acc.perVendorBonus;
    acc.perVendorBonus = (v) => prev(v) + next(v);
  }
  function chainExclusion(next: (v: Vendor) => string | null) {
    const prev = acc.perVendorExclusion;
    acc.perVendorExclusion = (v) => prev(v) ?? next(v);
  }

  /* ═══ Guided fields ═══════════════════════════════════════════ */

  // Governance strictness — bumps enterprise_control + reliability_safety.
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

  // Integration depth — deeper integration loads integration_ops + bonuses
  // vendors with strong integration-architecture evidence.
  if (input.integrationDepth != null) {
    const depthBump: Record<NonNullable<AssessmentInput["integrationDepth"]>, number> = {
      shallow: -0.005, moderate: 0, deep: 0.018, core_system: 0.032,
    };
    addWeight("integration_ops", depthBump[input.integrationDepth]);
    if (input.integrationDepth === "deep" || input.integrationDepth === "core_system") {
      chainBonus((v) =>
        v.evidence.some((e) => e.domain === "integration_architecture" && (e.grade === "E4" || e.grade === "E5")) ? 3 : 0,
      );
      acc.rationale.push(
        `Integration depth = ${input.integrationDepth.replace(/_/g, " ")} bumps integration-ops weight and bonuses vendors with E4+ integration-architecture evidence.`,
      );
    }
  }

  // Human review model.
  if (input.humanReviewModel === "no_review") {
    addWeight("reliability_safety", 0.03);
    addWeight("enterprise_control", 0.015);
    acc.rationale.push("No human-review model means failures propagate — reliability + control weights raised.");
  } else if (input.humanReviewModel === "dual_approval") {
    addWeight("integration_ops", 0.015);
    acc.rationale.push("Dual-approval workflow needs strong integration plumbing — integration-ops weight raised.");
  }

  // Lock-in tolerance — averse buyers raise vendor_resilience and penalise
  // vendors that aren't portable (structured deploymentModels).
  if (input.lockInTolerance != null) {
    const lockBump: Record<NonNullable<AssessmentInput["lockInTolerance"]>, number> = {
      averse: 0.025, cautious: 0.012, comfortable: 0, indifferent: -0.01,
    };
    addWeight("vendor_resilience", lockBump[input.lockInTolerance]);
    if (input.lockInTolerance === "averse") {
      chainPenalty((v) => (vendorIsPortable(v) ? 0 : 4));
      acc.rationale.push(
        "Lock-in averse — vendor-resilience weight raised; vendors without a portable deployment model (self-host / VPC / on-prem) take a small penalty.",
      );
    }
  }

  // Data residency — vendors that can't serve the required region are penalised.
  if (input.dataResidency != null && input.dataResidency !== "no_constraint") {
    const regionKey: Record<Exclude<NonNullable<AssessmentInput["dataResidency"]>, "no_constraint">, string> = {
      us_only: "us", eu_only: "eu", uk_only: "uk", apac_only: "apac",
      sovereign_required: input.region?.toLowerCase() ?? "",
    };
    const region = regionKey[input.dataResidency];
    if (region) {
      chainPenalty((v) => (vendorServesRegion(v, region) ? 0 : 5));
      acc.rationale.push(
        `Data residency = ${input.dataResidency.replace(/_/g, " ")} — vendors that cannot serve ${region.toUpperCase()} take a 5-point penalty.`,
      );
    }
  }

  // v1.3 — Build vs buy. Buy tilts to market_strength + business_fit; build
  // tilts to integration_ops + vendor_resilience (you own the foundation).
  if (input.buildVsBuy != null && input.buildVsBuy !== "undecided") {
    if (input.buildVsBuy === "buy_saas" || input.buildVsBuy === "buy_configure") {
      addWeight("market_strength", 0.012);
      addWeight("business_fit", 0.012);
      acc.rationale.push(`Buy posture (${input.buildVsBuy.replace(/_/g, " ")}) — market strength + business fit weighted higher.`);
    } else {
      addWeight("integration_ops", 0.02);
      addWeight("vendor_resilience", 0.012);
      acc.rationale.push(
        `Build posture (${input.buildVsBuy.replace(/_/g, " ")}) — integration-ops + vendor-resilience weighted higher; budget for the hidden 'build tax' of rebuilding foundations.`,
      );
    }
  }

  // v1.3 — Data readiness. Weak data foundations raise reliability + integration
  // weight (the #1 cited cause of pilot failure). Adoption-friction handled in
  // the engine via input.dataReadiness.
  if (input.dataReadiness != null && input.dataReadiness <= 2) {
    addWeight("reliability_safety", 0.018);
    addWeight("integration_ops", 0.012);
    acc.rationale.push(
      `Data readiness ${input.dataReadiness}/5 — weak data foundations raise reliability + integration weight and add adoption friction; autonomous use cases are riskier here.`,
    );
  }

  // v1.3 — Change sponsorship (rationale; adoption friction handled in engine).
  if (input.changeSponsorship === "none" || input.changeSponsorship === "mid_level") {
    acc.rationale.push(
      `Change sponsorship = ${input.changeSponsorship.replace(/_/g, " ")} — without a named senior owner, expect adoption friction; this is the dominant cause of stalled pilots.`,
    );
  }

  /* ═══ Advanced fields ═════════════════════════════════════════ */

  // Switching-cost tolerance.
  if (input.switchingCostTolerance != null && input.switchingCostTolerance >= 4) {
    addWeight("vendor_resilience", 0.018);
    acc.rationale.push(`Low switching-cost appetite (${input.switchingCostTolerance}/5) — vendor-resilience weight raised so reversibility counts.`);
  }

  // Sovereignty requirement — hard excludes non-domiciled vendors; soft penalises.
  if (input.sovereigntyRequirement === "hard" && input.region) {
    const region = input.region;
    chainExclusion((v) =>
      vendorIsDomiciled(v, region) ? null : `Hard sovereignty required in ${region.toUpperCase()} — vendor cannot demonstrably serve the region (regions: ${(v.regions ?? []).join(", ") || "unspecified"}).`,
    );
    acc.rationale.push(`Hard sovereignty — vendors that cannot serve ${input.region.toUpperCase()} are excluded.`);
  } else if (input.sovereigntyRequirement === "soft" && input.region) {
    const region = input.region;
    chainPenalty((v) => (vendorIsDomiciled(v, region) ? 0 : 6));
    acc.rationale.push("Soft sovereignty — vendors that cannot serve the region lose 6 points.");
  }

  // RFP cycle.
  if (input.rfpCycle === "formal_rfp" || input.rfpCycle === "public_procurement") {
    addWeight("enterprise_control", 0.018);
    addWeight("vendor_resilience", 0.01);
    acc.rationale.push(`${input.rfpCycle.replace(/_/g, " ")} — enterprise-control + vendor-resilience weights raised for procurement scrutiny.`);
  }

  // Required certifications — structured match; each missing cert costs 3 pts.
  if (input.requiredCertifications && input.requiredCertifications.length > 0) {
    const required = input.requiredCertifications;
    chainPenalty((v) => required.filter((c) => !vendorHasCert(v, c)).length * 3);
    acc.rationale.push(
      `Required certifications: ${required.join(", ")} — vendors lose 3 pts per missing certification (matched against structured vendor certification data).`,
    );
  }

  // Concentration risk — diversifiers get a bonus for spanning multiple vendor
  // families; concentration-accepters trade a small resilience weight.
  if (input.concentrationRiskTolerance === "avoid_concentration") {
    addWeight("vendor_resilience", 0.012);
    chainBonus((v) => (vendorParentSpread(v) >= 2 || vendorIsPortable(v) ? 3 : 0));
    acc.rationale.push("Avoid concentration — vendor-resilience weight raised; multi-family / portable vendors get a 3-pt bonus.");
  } else if (input.concentrationRiskTolerance === "accept_concentration") {
    addWeight("vendor_resilience", -0.008);
  }

  // Stack appetite — rationale-only hint for the results UI.
  if (input.stackAppetite === "best_of_breed") {
    acc.rationale.push("Best-of-breed stack — shortlist will surface multiple specialist vendors rather than one generalist.");
  } else if (input.stackAppetite === "single_vendor") {
    acc.rationale.push("Single-vendor stack — recommendation favours a generalist with broad pillar coverage.");
  }

  // TCO horizon.
  if (input.tcoHorizon === "5_year" || input.tcoHorizon === "10_year") {
    addWeight("vendor_resilience", 0.014);
    acc.rationale.push(`${input.tcoHorizon.replace(/_/g, " ")} TCO horizon — vendor-resilience weight raised so longevity counts.`);
  }

  // v1.3 — EU AI Act use-case risk class. High-risk cascades to control +
  // reliability weight and flags FRIA / human-oversight obligations.
  if (input.useCaseRiskClass === "high_risk" || input.useCaseRiskClass === "prohibited_adjacent") {
    addWeight("enterprise_control", 0.02);
    addWeight("reliability_safety", 0.018);
    acc.rationale.push(
      `Use case classified ${input.useCaseRiskClass.replace(/_/g, " ")} under the EU AI Act — deployer obligations apply (Fundamental Rights Impact Assessment, named human oversight, ≥6-month logging). Control + reliability weighted higher; confirm the vendor supports these obligations.`,
    );
  }

  // v1.3 — Model-quality / hallucination bar. Parameterises Reliability &
  // Safety into a near-gate: zero/low tolerance penalises vendors lacking
  // strong model-reliability evidence (the engine can also cap the band).
  if (input.maxHallucinationTolerance === "zero" || input.maxHallucinationTolerance === "low") {
    addWeight("reliability_safety", 0.02);
    const need: "E4" | "E3" = input.maxHallucinationTolerance === "zero" ? "E4" : "E3";
    const pen = input.maxHallucinationTolerance === "zero" ? 6 : 3;
    chainPenalty((v) => {
      const strong = v.evidence.some(
        (e) => e.domain === "model_reliability"
          && (need === "E4" ? (e.grade === "E4" || e.grade === "E5") : (e.grade === "E3" || e.grade === "E4" || e.grade === "E5")),
      );
      return strong ? 0 : pen;
    });
    acc.rationale.push(
      `Max hallucination tolerance = ${input.maxHallucinationTolerance} — vendors without ${need}+ model-reliability evidence are penalised; Reliability & Safety weighted higher.`,
    );
  }

  // v1.3 — Independent evaluation evidence requirements.
  if (input.evalEvidenceRequired && input.evalEvidenceRequired.length > 0) {
    const required = input.evalEvidenceRequired;
    chainPenalty((v) => {
      const has = new Set(v.evalEvidence ?? []);
      return required.filter((r) => !has.has(r)).length * 3;
    });
    acc.rationale.push(
      `Required evaluation evidence: ${required.join(", ")} — vendors lose 3 pts per missing item (independent eval / red-team / model card / safety eval).`,
    );
  }

  // v1.3 — Acceptable pricing models. Vendors whose pricing model the buyer
  // rejects are penalised (only when the vendor declares its pricing models).
  if (input.acceptablePricingModels && input.acceptablePricingModels.length > 0) {
    const accepted = new Set(input.acceptablePricingModels);
    chainPenalty((v) => {
      if (!v.pricingModels || v.pricingModels.length === 0) return 0;
      return v.pricingModels.some((m) => accepted.has(m as never)) ? 0 : 5;
    });
    acc.rationale.push(
      `Acceptable pricing models: ${input.acceptablePricingModels.join(", ")} — vendors offering only excluded pricing models lose 5 points.`,
    );
  }

  // v1.3 — Consumption + cost ceiling (rationale; vendor pricing magnitudes are
  // not yet in the data model so we surface the inputs rather than fake a TCO).
  if (input.expectedConsumption != null || input.costCeiling != null) {
    const parts: string[] = [];
    if (input.expectedConsumption) parts.push(`scale = ${input.expectedConsumption.replace(/_/g, " ")}`);
    if (input.costCeiling) parts.push(`annual ceiling = ${input.costCeiling.replace(/_/g, " ").replace(/lt /, "<").replace(/gt /, ">")}`);
    acc.rationale.push(
      `Cost model captured (${parts.join(", ")}). TCO over the ${input.tcoHorizon?.replace(/_/g, " ") ?? "selected"} horizon should be validated against each shortlisted vendor's consumption pricing.`,
    );
  }

  // v1.3 — IP / data rights (rationale + validation; no structured vendor IP
  // data yet, so these become explicit contract asks).
  if (input.ipAndDataRights && input.ipAndDataRights.length > 0) {
    acc.rationale.push(
      `Required IP / data rights: ${input.ipAndDataRights.map((r) => r.replace(/_/g, " ")).join(", ")} — confirm each in the contract; "no training on our data" should be matched to the vendor's training-data policy evidence.`,
    );
  }

  // v1.3 — Exit / reversibility requirements. Portable vendors get a small
  // bonus; vendors with no portable path take a small penalty.
  if (input.exitRequirements && input.exitRequirements.length > 0) {
    const wantsPortability = input.exitRequirements.some(
      (r) => r === "model_config_portability" || r === "open_format_export" || r === "parallel_run",
    );
    if (wantsPortability) {
      chainBonus((v) => (vendorIsPortable(v) ? 2 : 0));
      chainPenalty((v) => (vendorIsPortable(v) ? 0 : 3));
      acc.rationale.push("Exit requirements include portability — portable (self-host / VPC / on-prem) vendors get a 2-pt bonus; non-portable vendors lose 3.");
    }
  }

  // v1.3 — Fact-derived negotiation leverage (replaces the self-rated slider).
  // Low leverage → enterprise_control up (the contract has to do the work).
  const leverage = deriveLeverage(input);
  if (leverage != null) {
    if (leverage < 0.4) {
      addWeight("enterprise_control", 0.012);
      acc.rationale.push(
        `Low negotiation leverage (derived from incumbent spend, renewal timing and # of alternatives) — enterprise-control weight raised; the contract has to do the work.`,
      );
    } else if (leverage >= 0.7) {
      acc.rationale.push(
        `Strong negotiation leverage (derived from facts) — you can push harder on price, exit and IP terms in the shortlist.`,
      );
    }
  } else if (input.negotiationPower === "low") {
    // Legacy fallback if the fact inputs weren't supplied.
    addWeight("enterprise_control", 0.01);
    acc.rationale.push("Low negotiation power — enterprise-control weight raised; the contract has to do the work.");
  }

  // v1.3 — Industry systems-of-record selected → integration is the dominant
  // delivery risk, so bump integration_ops (capped). The per-vendor SoR-fit
  // bonus lives in engine.ts strategicFitBonus to keep a single fit code path.
  if (input.selectedSystemsOfRecord && input.selectedSystemsOfRecord.length > 0) {
    const bump = Math.min(0.06, input.selectedSystemsOfRecord.length * 0.02);
    addWeight("integration_ops", bump);
    acc.rationale.push(
      `${input.selectedSystemsOfRecord.length} industry system(s) of record selected — integration-ops weighted higher; vendors with native connectors to those systems are rewarded.`,
    );
  }

  // v1.3 — Value at stake lightly tilts business_fit (strategic value matters
  // more when the prize is bigger). Surfaced for opportunity ranking in engine.
  if (input.valueAtStake === "5m_25m" || input.valueAtStake === "gt_25m") {
    addWeight("business_fit", 0.01);
  }

  return acc;
}

/**
 * Derive negotiation leverage in [0,1] from the fact inputs. Returns null when
 * no fact inputs are present (so the legacy negotiationPower path can apply).
 */
function deriveLeverage(input: AssessmentInput): number | null {
  const signals: number[] = [];
  const spendMap: Record<NonNullable<AssessmentInput["incumbentAnnualSpend"]>, number> = {
    none: 0.3, lt_250k: 0.3, "250k_1m": 0.5, "1m_5m": 0.75, gt_5m: 1,
  };
  const renewMap: Record<NonNullable<AssessmentInput["renewalWindow"]>, number> = {
    lt_3mo: 1, "3_6mo": 0.8, "6_12mo": 0.5, gt_12mo: 0.2, no_incumbent: 0.5,
  };
  if (input.incumbentAnnualSpend != null) signals.push(spendMap[input.incumbentAnnualSpend]);
  if (input.renewalWindow != null) signals.push(renewMap[input.renewalWindow]);
  if (input.qualifiedAlternatives != null) signals.push(Math.min(1, input.qualifiedAlternatives / 4));
  if (signals.length === 0) return null;
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}

/* ─── Engine integration helpers ─────────────────────────────────── */

/**
 * Apply the overlay's weight delta to an existing weight map and return a
 * renormalised version. Engine calls this after dynamicWeights.
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
  const sum = Object.values(next).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(next) as PillarId[]) {
    next[k] = sum > 0 ? next[k] / sum : 0;
  }
  return next;
}

/**
 * v1.3 — buyer ecosystem concentration helper, re-exported for the results UI
 * and engine so the "you're 80% Microsoft" caution can be surfaced.
 */
export function buyerConcentration(input: AssessmentInput): { topParent: string | null; share: number } {
  return concentrationOf([...(input.ecosystem ?? []), ...(input.selectedSystemsOfRecord ?? [])]);
}

export { NOOP as TIER_OVERLAY_NOOP };
