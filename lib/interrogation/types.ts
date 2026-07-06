// AIE-05 — Interrogation engine shared types.
// ─────────────────────────────────────────────────────────────────────────────
// The vocabulary shared across the questioner (mid-tier adaptive Q&A), the
// deterministic retrieval step, and the reasoning-tier synthesizer. Kept
// dependency-light (only the peer taxonomy) so every core module can import it
// without pulling in the DB or the LLM client.

import type { IndustryTag } from "../use-cases";
import type { SizeBandId, RegionId, Segment } from "../peer/segments";

// ── Intent profile ───────────────────────────────────────────────────────────
// What the questioner distils the conversation down to before synthesis. The
// three categorical dimensions are the REAL peer-taxonomy ids (chips are sourced
// from lib/peer/segments.ts), so { vertical, sizeBand, region } joins to the
// cited benchmark data with zero translation loss. goal + constraints are the
// open, free-text dimensions where the nuance lives.
export interface IntentProfile {
  vertical: IndustryTag;
  sizeBand: SizeBandId;
  region: RegionId;
  /** The user's stated objective, in their own words (free text). */
  goal: string;
  /** Bounded conditions the user named (budget, compliance, timeline, …). */
  constraints: string[];
}

/** The intent profile's categorical part, as a peer Segment (the join key). */
export function intentSegment(p: IntentProfile): Segment {
  return { vertical: p.vertical, sizeBand: p.sizeBand, region: p.region };
}

// ── Questioner turn protocol ─────────────────────────────────────────────────
export type QuestionerAction =
  | { action: "ask"; question: string; options?: string[] }
  | { action: "ready"; intentProfile: IntentProfile };

export interface TranscriptTurn {
  role: "question" | "answer";
  content: string;
}

// ── Evidence bundle (retrieval output → synthesizer input) ───────────────────
/** One cited fact handed to the synthesizer. sourceUrl is the allowlist key:
 *  the synthesizer may only cite URLs present on the bundle's items. */
export interface EvidenceItem {
  layer: "model" | "peer_public" | "peer_pool";
  scopeLabel: string; // e.g. "Your exact segment", "LMArena", "Your vertical"
  headline: string; // the fact, stated exactly as the source supports it
  detail?: string;
  /** Honest note on how the source population differs from the user's segment. */
  fitNote?: string;
  sourceUrl: string; // real https URL — the citation + allowlist key
  sourcePublisher?: string;
  sourceDate?: string;
}

/** Honest coverage flags — drive the finding's confidence line. Never hidden. */
export interface CoverageFlags {
  /** True only when an exact vertical×size×region benchmark exists. */
  exactSegmentMatch: boolean;
  /** Label of the most specific peer layer that DID match (or null). */
  nearestPeerScope: string | null;
  /** Named companies in the segment with a disclosed (public) adoption. */
  disclosedAdopters: number;
  /** Contributors behind the PRIVATE pool layer. 0 until AIE-06/07 ship. */
  poolContributors: number;
  /** True when the model-layer (LMArena) comparison was available. */
  hasModelData: boolean;
}

export interface EvidenceBundle {
  intent: IntentProfile;
  items: EvidenceItem[];
  coverage: CoverageFlags;
}

/** The set of citable URLs — the anti-fabrication allowlist for synthesis. */
export function bundleAllowlist(bundle: EvidenceBundle): Set<string> {
  return new Set(bundle.items.map((i) => i.sourceUrl));
}

// ── Finding (synthesizer output) ─────────────────────────────────────────────
export interface Finding {
  /** The ~180-word written finding, markdown. */
  markdown: string;
  /** sourceUrls the synthesizer cited — every one guaranteed in the allowlist. */
  citedSourceUrls: string[];
}
