// Peer-AI-usage benchmark — type spine.
// ─────────────────────────────────────
// The demand-side twin of the vendor assessment: how COMPANIES adopt AI,
// from OBSERVABLE, CITED signals only. Same honesty contract as the rest of
// the platform (see lib/delivery/seed.ts for the precedent):
//   • a signal is either DISCLOSED (cited), INFERRED (cited + est-flagged),
//     or NOT DISCLOSED (no level, no citations, no claim);
//   • we never assert how a company uses AI internally when that is private;
//   • levels are an analyst-curated qualitative reading OF the citations,
//     never a measured score, and carry that label in the UI;
//   • nothing here writes or influences canonical vendor scores (firewall).

/** The five observable signal families (spec: 1_Peer-AI-Usage-Feature.md). */
export type PeerSignalKind =
  | "platform_integration" // disclosed adoption of external AI vendors/platforms
  | "talent_exposure" // AI/ML hiring + workforce signals
  | "patent_velocity" // AI patents + research output
  | "product_footprint" // shipped AI products/features
  | "automation_intensity"; // delivery/automation intensity — ALWAYS inferred (est.)

/** Where a citation comes from — coarse, honest source tiers. */
export type PeerSourceTier =
  | "company_primary" // the peer's own press release / filing / newsroom
  | "vendor_disclosure" // the AI vendor's own case study about the peer
  | "press" // reputable business/tech press
  | "analyst_index"; // third-party analyst benchmark (e.g. Evident AI Index)

export interface PeerCitation {
  title: string;
  url: string; // must be a real https URL — enforced by tests
  publisher: string;
  tier: PeerSourceTier;
  /** ISO date, only when stated by the source — never guessed. */
  publishedAt?: string;
}

/** 1 (early) → 4 (extensive). There is deliberately NO level 0: absence of
 *  evidence is represented by status "not_disclosed" with no level at all,
 *  so a gap can never be confused with a low rating. */
export type PeerSignalLevel = 1 | 2 | 3 | 4;

export type PeerSignalStatus = "disclosed" | "inferred" | "not_disclosed";

export interface PeerSignal {
  kind: PeerSignalKind;
  status: PeerSignalStatus;
  /** Present ONLY when status !== "not_disclosed". COMPUTED from `rubricBasis`
   *  via lib/peer/rubric.ts (Step 0 red line) — pinned by a test so it can never
   *  drift from its cited evidence. Not an analyst-assigned number. */
  level?: PeerSignalLevel;
  /** The countable cited evidence the band is computed from (# adoptions, #
   *  products, patent/talent tier, or an est. inferred intensity). Required for
   *  rated signals; absent for not_disclosed. See RubricBasis. */
  rubricBasis?: import("./rubric").RubricBasis;
  /** What the citations actually say, plainly. Absent for not_disclosed. */
  summary?: string;
  /** For inferred signals: what the inference is drawn FROM (disclosed usage
   *  stats etc.). Rendered next to the est. flag. */
  inferenceNote?: string;
  /** ≥1 required for disclosed/inferred; MUST be empty for not_disclosed. */
  citations: PeerCitation[];
  /** platform_integration only: tracked vendor ids (bare, e.g. "openai") the
   *  peer has disclosed adopting — cross-linked to /vendors/{id}. Validated
   *  against TRACKED_VENDOR_NAMES by tests. */
  vendorIds?: string[];
}

export interface PeerCompany {
  id: string; // kebab-case slug
  name: string;
  industry: string;
  /** CORRECTED peer model (2 Jul 2026): exemplars are matched to the user by
   *  segment — vertical (C6 IndustryTag) × size band × region — so a company
   *  only ever appears as a named, publicly-disclosed exemplar within its own
   *  cohort. Ids reference lib/peer/segments.ts vocab (typed there; kept as
   *  strings here to avoid a cycle — validated by tests). */
  segment: { vertical: string; sizeBand: string; region: string };
  /** Exactly one signal per PeerSignalKind — enforced by tests. */
  signals: PeerSignal[];
}
