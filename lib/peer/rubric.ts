// Peer-AI band rubric (Adoption-Signal pipeline, Step 0 — the red line).
// ─────────────────────────────────────────────────────────────────────────────
// Every band (Extensive / Substantial / Developing / Early / Not disclosed) is
// COMPUTED from countable cited evidence via THIS documented rubric — NEVER
// assigned by an analyst/LLM "on vibes". Each rated cell carries a `rubricBasis`
// (the countable evidence: # disclosed adoptions, # shipped products, a patent
// tier, a benchmark rank, or an est. inference) and the band is a pure function
// of it. A test pins `signal.level === computePeerBand(...)` so a band can never
// drift from its evidence. Disclosure-only; "not disclosed" where no basis.
//
// The counts come from REAL cited items (each an https source on the signal).
// The thresholds below are the published methodology — fixed, never tuned to
// move a specific company.

import type { PeerSignalKind, PeerSignalLevel, PeerSignalStatus } from "./types";

/** Patent/research-velocity tiers (from a cited tracker: Evident, USPTO, etc.). */
export type PatentTier = "leader" | "significant" | "present";
/** Talent tiers (benchmark-derived, e.g. an AI-index Talent-pillar position). */
export type TalentTier = "rank1" | "top5" | "tracked";

/** The countable cited evidence behind a band — the rubric's ONLY input. */
export interface RubricBasis {
  /** platform_integration: # distinct disclosed AI-vendor/platform adoptions
   *  AND major named case studies (each cited). */
  adoptions?: number;
  /** product_footprint: # shipped / publicly-announced AI products (each cited). */
  products?: number;
  /** product_footprint: true when ≥1 product is a disclosed ENTERPRISE-SCALE
   *  flagship (firm-wide rollout / millions of interactions) — so a single
   *  dominant platform isn't under-banded as "Developing" on raw count. */
  flagshipScale?: boolean;
  /** patent_velocity: tier from a cited patent/research tracker. */
  patentTier?: PatentTier;
  /** talent_exposure: tier from a cited benchmark (AI-index Talent pillar). */
  talentTier?: TalentTier;
  /** automation_intensity: ALWAYS inferred — an est. intensity 1–4 read off
   *  disclosed efficiency/usage stats (flagged est., never asserted). */
  inferredIntensity?: PeerSignalLevel;
}

/** Documented, per-signal band rule. Pure. Returns the level, or undefined when
 *  the basis doesn't support a band (→ caller treats as not_disclosed). */
export function computePeerBand(
  kind: PeerSignalKind,
  basis: RubricBasis,
  status: PeerSignalStatus,
): PeerSignalLevel | undefined {
  if (status === "not_disclosed") return undefined;

  switch (kind) {
    case "platform_integration": {
      const n = basis.adoptions ?? 0;
      if (n >= 4) return 4; // Extensive — 4+ distinct disclosed vendor platforms
      if (n >= 2) return 3; // Substantial — 2–3
      if (n >= 1) return 2; // Developing — 1
      // Disclosed strategy but no named EXTERNAL vendor adoption (e.g. in-house
      // only) → Early. status is "disclosed" here (not_disclosed returned above).
      return 1;
    }
    case "product_footprint": {
      const n = basis.products ?? 0;
      if (n >= 3 || basis.flagshipScale) return 4; // ≥3 products OR an enterprise-scale flagship
      if (n === 2) return 3;
      if (n === 1) return 2;
      return undefined;
    }
    case "patent_velocity": {
      if (basis.patentTier === "leader") return 4;
      if (basis.patentTier === "significant") return 3;
      if (basis.patentTier === "present") return 2;
      return undefined;
    }
    case "talent_exposure": {
      if (basis.talentTier === "rank1") return 4;
      if (basis.talentTier === "top5") return 3;
      if (basis.talentTier === "tracked") return 2;
      return undefined;
    }
    case "automation_intensity": {
      // Always inferred (est.). The est. intensity IS the band — but it is an
      // inference from disclosed metrics, carried with the est. flag by the
      // caller; the rubric just passes the documented 1–4 read through.
      return basis.inferredIntensity;
    }
  }
}

/** Human-readable rule text per signal — shown in the /peers methodology so the
 *  band derivation is public, not a black box. */
export const RUBRIC_TEXT: Record<PeerSignalKind, string> = {
  platform_integration:
    "Band = # of distinct disclosed AI-vendor/platform adoptions + major named case studies (each cited): 4 (Extensive) ≥4 · 3 (Substantial) 2–3 · 2 (Developing) 1.",
  product_footprint:
    "Band = # of shipped, publicly-announced AI products (each cited): 4 ≥3 · 3 = 2 · 2 = 1.",
  patent_velocity:
    "Band from a cited patent/research tracker: 4 = sector leader · 3 = significant filer · 2 = present.",
  talent_exposure:
    "Band from a cited AI-talent benchmark (e.g. an index Talent-pillar position): 4 = #1 · 3 = top-5 · 2 = tracked. Not disclosed where no public figure.",
  automation_intensity:
    "ALWAYS inferred (est.) from disclosed efficiency/usage metrics — never asserted. The 1–4 read carries the est. flag.",
};
