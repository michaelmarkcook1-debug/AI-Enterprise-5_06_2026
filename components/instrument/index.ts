// The Evidence-Instrument component kit — Phase 1, Item 1 of the redesign plan.
// ──────────────────────────────────────────────────────────────────────────
// One import for the shared decision-surface primitives, so the "truth-state
// always visible" language is enforced from one place and reused by the
// scorecard, the model face-off, and the peer benchmark. `EvidenceGrade` is the
// existing shared GradeChip (assessment/GradeChip) re-exported under the kit's
// name — no duplicate grade renderer.

export { default as BulletGraph } from "./BulletGraph";
export type { BulletGraphProps } from "./BulletGraph";

export { default as DivergingBar } from "./DivergingBar";
export type { DivergingBarProps } from "./DivergingBar";

export { default as ConfidenceVeil, confidenceLevel } from "./ConfidenceVeil";
export type { ConfidenceVeilProps } from "./ConfidenceVeil";

export { default as ClickToSource } from "./ClickToSource";
export type { ClickToSourceProps, SourceRef } from "./ClickToSource";

// Re-export the existing shared grade chip under the kit's name — reuse, not rebuild.
export { default as EvidenceGrade } from "../assessment/GradeChip";
