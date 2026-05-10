import { describe, expect, it } from "vitest";
import {
  canRenderAsVerified,
  isHighConfidence,
  requiresValidation,
  truthBadgeProps,
  truthDisplayStatus,
  type TruthRecord,
} from "./truth-engine";

const NOW = "2026-05-10T00:00:00.000Z";

function record(overrides: Partial<TruthRecord> = {}): TruthRecord {
  return {
    id: "tr_test",
    entityType: "vendor",
    entityId: "vendor_msft",
    claimType: "capability",
    claimText: "Microsoft 365 Copilot supports tool use",
    sourceIds: ["src_msft_copilot_docs"],
    evidenceGrade: "E4",
    confidenceScore: 88,
    dataStatus: "documented",
    freshnessStatus: "fresh",
    createdAt: NOW,
    ...overrides,
  };
}

// ─────────── canRenderAsVerified — strict gate ───────────

describe("truth-engine: canRenderAsVerified", () => {
  it("verified path: E3+ + sources + verified-status + fresh + ≥60 confidence", () => {
    expect(canRenderAsVerified(record({ evidenceGrade: "E3", dataStatus: "documented" }))).toBe(true);
    expect(canRenderAsVerified(record({ evidenceGrade: "E5", dataStatus: "verified" }))).toBe(true);
  });
  it("E0 cannot render as verified — ever", () => {
    expect(canRenderAsVerified(record({ evidenceGrade: "E0" }))).toBe(false);
  });
  it("E1/E2 vendor-claim or doc-only cannot render as verified", () => {
    expect(canRenderAsVerified(record({ evidenceGrade: "E1" }))).toBe(false);
    expect(canRenderAsVerified(record({ evidenceGrade: "E2" }))).toBe(false);
  });
  it("seed/stale/disputed/unsupported/unknown cannot render as verified", () => {
    for (const dataStatus of ["seed", "stale", "disputed", "unsupported", "unknown"] as const) {
      expect(canRenderAsVerified(record({ dataStatus }))).toBe(false);
    }
  });
  it("missing sources cannot render as verified", () => {
    expect(canRenderAsVerified(record({ sourceIds: [] }))).toBe(false);
  });
  it("low confidence (<60) cannot render as verified", () => {
    expect(canRenderAsVerified(record({ confidenceScore: 59 }))).toBe(false);
  });
  it("stale freshness cannot render as verified", () => {
    expect(canRenderAsVerified(record({ freshnessStatus: "stale" }))).toBe(false);
  });
});

// ─────────── truthDisplayStatus ───────────

describe("truth-engine: truthDisplayStatus", () => {
  it("renders Verified when gate passes", () => {
    expect(truthDisplayStatus(record({ evidenceGrade: "E5", dataStatus: "verified" }))).toBe("Verified");
  });
  it("unsupported renders as Unknown — never as fact", () => {
    expect(truthDisplayStatus(record({ dataStatus: "unsupported" }))).toBe("Unknown");
  });
  it("missing source on a non-unknown/seed record → Source validation required", () => {
    expect(truthDisplayStatus(record({ sourceIds: [], dataStatus: "documented" }))).toBe("Source validation required");
  });
  it("documented with sources but low evidence/confidence renders Documented (not Verified)", () => {
    expect(truthDisplayStatus(record({ evidenceGrade: "E2" }))).toBe("Documented");
  });
  it("seed renders Seed", () => {
    expect(truthDisplayStatus(record({ dataStatus: "seed" }))).toBe("Seed");
  });
  it("stale dataStatus renders Stale", () => {
    expect(truthDisplayStatus(record({ dataStatus: "stale" }))).toBe("Stale");
  });
  it("freshnessStatus stale on a non-stale record still labels Stale", () => {
    expect(truthDisplayStatus(record({ freshnessStatus: "stale" }))).toBe("Stale");
  });
  it("disputed renders Disputed", () => {
    expect(truthDisplayStatus(record({ dataStatus: "disputed" }))).toBe("Disputed");
  });
});

// ─────────── truthBadgeProps ───────────

describe("truth-engine: truthBadgeProps", () => {
  it("verified records get tone 'ok'", () => {
    const props = truthBadgeProps(record({ evidenceGrade: "E5", dataStatus: "verified" }));
    expect(props.label).toBe("Verified");
    expect(props.tone).toBe("ok");
  });
  it("disputed → tone 'bad' with the uncertainty note in title", () => {
    const props = truthBadgeProps(record({ dataStatus: "disputed", uncertaintyNote: "Two filings contradict" }));
    expect(props.tone).toBe("bad");
    expect(props.title).toContain("Two filings contradict");
  });
  it("unsupported → label 'Unknown', tone 'bad'", () => {
    const props = truthBadgeProps(record({ dataStatus: "unsupported" }));
    expect(props.label).toBe("Unknown");
    expect(props.tone).toBe("bad");
  });
  it("seed → tone 'warn'", () => {
    expect(truthBadgeProps(record({ dataStatus: "seed" })).tone).toBe("warn");
  });
  it("low-confidence documented gets the qualifier", () => {
    const props = truthBadgeProps(record({ confidenceScore: 55 }));
    expect(props.label).toBe("Documented (low confidence)");
    expect(props.tone).toBe("warn");
  });
  it("missing sources flagged as 'Source validation required' tone bad", () => {
    const props = truthBadgeProps(record({ sourceIds: [], dataStatus: "documented" }));
    expect(props.label).toBe("Source validation required");
    expect(props.tone).toBe("bad");
  });
});

// ─────────── requiresValidation ───────────

describe("truth-engine: requiresValidation", () => {
  it("disputed always requires validation", () => {
    expect(requiresValidation(record({ dataStatus: "disputed" }))).toBe(true);
  });
  it("unsupported always requires validation", () => {
    expect(requiresValidation(record({ dataStatus: "unsupported" }))).toBe(true);
  });
  it("missing sources on a non-unknown/seed record requires validation", () => {
    expect(requiresValidation(record({ sourceIds: [], dataStatus: "documented" }))).toBe(true);
  });
  it("a documented-status record that fails the verified gate (e.g. low confidence) requires validation", () => {
    expect(requiresValidation(record({ confidenceScore: 50 }))).toBe(true);
  });
  it("a clean verified record does not require validation", () => {
    expect(requiresValidation(record({ evidenceGrade: "E5", dataStatus: "verified" }))).toBe(false);
  });
  it("seed records do not require validation (they're just labelled seed)", () => {
    expect(requiresValidation(record({ dataStatus: "seed", sourceIds: [] }))).toBe(false);
  });
});

// ─────────── isHighConfidence ───────────

describe("truth-engine: isHighConfidence", () => {
  it("requires verified + fresh + confidence ≥ 75", () => {
    expect(isHighConfidence(record({ evidenceGrade: "E5", dataStatus: "verified", confidenceScore: 90 }))).toBe(true);
    expect(isHighConfidence(record({ evidenceGrade: "E5", dataStatus: "verified", confidenceScore: 70 }))).toBe(false);
    expect(isHighConfidence(record({ evidenceGrade: "E5", dataStatus: "verified", freshnessStatus: "aging" }))).toBe(false);
  });
  it("seed/disputed/unsupported never high confidence", () => {
    for (const dataStatus of ["seed", "disputed", "unsupported"] as const) {
      expect(isHighConfidence(record({ dataStatus }))).toBe(false);
    }
  });
});
