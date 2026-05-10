import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  normaliseExcerpt,
  excerptHash,
  jaccardSimilarity,
  captureWeekStart,
  clusterExact,
  clusterNear,
  pickRepresentative,
  buildDedupReport,
  type DedupInput,
} from "./dedup";

const NOW = new Date("2026-05-10T00:00:00Z");

function row(over: Partial<DedupInput> = {}): DedupInput {
  return {
    id: "p_default",
    vendorId: "msft",
    domain: "model_reliability",
    subfactor: "documented_evals",
    excerpt: "Microsoft 365 Copilot supports tenant-isolated processing per the security review.",
    sourceUrl: "https://learn.microsoft.com/en-us/copilot/security",
    capturedAt: NOW,
    classifierConfidence: 0.9,
    classifierRationale: "Re-graded by classifier; documentation cap at E2.",
    classificationFailed: false,
    confidenceIsFallback: false,
    proposedGrade: "E3",
    ...over,
  };
}

describe("canonicalUrl", () => {
  it("strips www, hash, and tracking params", () => {
    expect(
      canonicalUrl("https://www.example.com/docs?utm_source=google&id=42#section"),
    ).toBe("https://example.com/docs?id=42");
  });
  it("lowercases host but keeps path case", () => {
    expect(canonicalUrl("HTTPS://Example.COM/Docs/Page")).toBe("https://example.com/Docs/Page");
  });
  it("strips trailing slash on non-root", () => {
    expect(canonicalUrl("https://example.com/path/")).toBe("https://example.com/path");
    expect(canonicalUrl("https://example.com/")).toBe("https://example.com");
  });
  it("returns empty string on null/undefined/empty", () => {
    expect(canonicalUrl(null)).toBe("");
    expect(canonicalUrl(undefined)).toBe("");
    expect(canonicalUrl("")).toBe("");
  });
});

describe("normaliseExcerpt + excerptHash", () => {
  it("collapses whitespace, lower-cases, strips punctuation", () => {
    expect(normaliseExcerpt("  Hello,  WORLD!  ")).toBe("hello world");
  });
  it("hash is stable across cosmetic differences", () => {
    expect(excerptHash("Hello, world!")).toBe(excerptHash("hello   world"));
  });
  it("hash differs when content differs", () => {
    expect(excerptHash("alpha")).not.toBe(excerptHash("beta"));
  });
});

describe("jaccardSimilarity", () => {
  it("identical strings → 1", () => {
    expect(jaccardSimilarity("Microsoft Copilot supports tenants", "Microsoft Copilot supports tenants")).toBe(1);
  });
  it("totally different strings → 0", () => {
    expect(jaccardSimilarity("alpha bravo charlie delta echo", "foxtrot golf hotel india juliet")).toBeLessThan(0.1);
  });
  it("near-duplicate strings → high (≥ 0.85)", () => {
    const a = "Microsoft 365 Copilot supports tenant isolated data processing per the security review";
    const b = "Microsoft 365 Copilot supports tenant-isolated data processing, per the security review.";
    expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(0.85);
  });
});

describe("captureWeekStart", () => {
  it("returns the Monday of the week (UTC)", () => {
    expect(captureWeekStart(new Date("2026-05-10T00:00:00Z"))).toBe("2026-05-04"); // Sun → Mon prior
    expect(captureWeekStart(new Date("2026-05-04T00:00:00Z"))).toBe("2026-05-04"); // Mon
    expect(captureWeekStart(new Date("2026-05-09T23:59:00Z"))).toBe("2026-05-04"); // Sat
  });
});

describe("clusterExact", () => {
  it("groups identical rows by composite key", () => {
    const a = row({ id: "a" });
    const b = row({ id: "b" }); // same content as a
    const c = row({ id: "c", excerpt: "totally different content here" });
    const clusters = clusterExact([a, b, c]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
    expect(new Set(clusters[0].members.map((m) => m.id))).toEqual(new Set(["a", "b"]));
  });

  it("does NOT cluster across different vendors", () => {
    expect(clusterExact([row({ id: "a" }), row({ id: "b", vendorId: "googl" })])).toHaveLength(0);
  });

  it("does NOT cluster across different subfactors", () => {
    expect(clusterExact([row({ id: "a" }), row({ id: "b", subfactor: "uptime" })])).toHaveLength(0);
  });

  it("treats trailing-slash and tracking-param URLs as the same canonical URL", () => {
    const a = row({ id: "a", sourceUrl: "https://learn.microsoft.com/en-us/copilot/security" });
    const b = row({
      id: "b",
      sourceUrl: "https://learn.microsoft.com/en-us/copilot/security/?utm_source=newsletter",
    });
    expect(clusterExact([a, b])).toHaveLength(1);
  });

  it("ignores singletons", () => {
    expect(clusterExact([row({ id: "lonely" })])).toHaveLength(0);
  });
});

describe("clusterNear", () => {
  it("groups near-duplicates within the same week + URL", () => {
    // Strings differ enough to NOT collapse to identical normalised text
    // but still share enough bigrams to clear the 0.85 threshold.
    const a = row({
      id: "a",
      excerpt:
        "Microsoft 365 Copilot supports tenant isolated data processing per the security review document published in 2026",
    });
    const b = row({
      id: "b",
      excerpt:
        "Microsoft 365 Copilot supports tenant isolated data processing per the security review document published earlier in 2026",
    });
    const clusters = clusterNear([a, b], { nearSimilarityThreshold: 0.7 });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
    expect(clusters[0].maxSimilarity).toBeGreaterThanOrEqual(0.7);
  });

  it("does NOT include rows already in an exact cluster", () => {
    const a = row({ id: "a" });
    const b = row({ id: "b" }); // exact dup of a
    expect(clusterNear([a, b])).toHaveLength(0);
  });

  it("does NOT cluster across different capture weeks", () => {
    const a = row({ id: "a", capturedAt: new Date("2026-05-04T00:00:00Z") });
    const b = row({
      id: "b",
      capturedAt: new Date("2026-05-20T00:00:00Z"),
      excerpt: a.excerpt + " ", // would be a near-dup if same week
    });
    expect(clusterNear([a, b])).toHaveLength(0);
  });

  it("threshold is configurable", () => {
    const a = row({ id: "a", excerpt: "alpha bravo charlie delta echo foxtrot" });
    const b = row({ id: "b", excerpt: "alpha bravo charlie delta echo gamma" });
    expect(clusterNear([a, b], { nearSimilarityThreshold: 0.99 })).toHaveLength(0);
    expect(clusterNear([a, b], { nearSimilarityThreshold: 0.5 })).toHaveLength(1);
  });
});

describe("pickRepresentative", () => {
  it("prefers rows with real classifier output over fallbacks", () => {
    const cluster = clusterExact([
      row({ id: "fallback", classificationFailed: true, confidenceIsFallback: true, classifierConfidence: 0 }),
      row({ id: "real", classifierConfidence: 0.9 }),
    ])[0];
    expect(pickRepresentative(cluster)?.id).toBe("real");
  });

  it("picks highest classifier confidence among real rows", () => {
    const cluster = clusterExact([
      row({ id: "low", classifierConfidence: 0.6 }),
      row({ id: "high", classifierConfidence: 0.95 }),
      row({ id: "mid", classifierConfidence: 0.8 }),
    ])[0];
    expect(pickRepresentative(cluster)?.id).toBe("high");
  });

  it("breaks ties by earliest capturedAt", () => {
    const cluster = clusterExact([
      row({ id: "later", capturedAt: new Date("2026-05-09T00:00:00Z") }),
      row({ id: "earlier", capturedAt: new Date("2026-05-01T00:00:00Z") }),
    ])[0];
    expect(pickRepresentative(cluster)?.id).toBe("earlier");
  });

  it("returns null when EVERY member is a classifier fallback", () => {
    const cluster = clusterExact([
      row({ id: "a", classificationFailed: true, confidenceIsFallback: true, classifierConfidence: 0 }),
      row({ id: "b", classificationFailed: true, confidenceIsFallback: true, classifierConfidence: 0 }),
    ])[0];
    expect(pickRepresentative(cluster)).toBeNull();
  });
});

describe("buildDedupReport", () => {
  it("counts safe-auto-merge only when ALL members have real classifier output", () => {
    // 1 exact cluster of 3 — all real. 2 dup rows safe to merge.
    const cluster1 = [
      row({ id: "a1" }),
      row({ id: "a2" }),
      row({ id: "a3" }),
    ];
    // 1 exact cluster of 2 — one is fallback. 1 dup row must go to human review.
    const cluster2 = [
      row({ id: "b1", vendorId: "googl" }),
      row({ id: "b2", vendorId: "googl", confidenceIsFallback: true, classificationFailed: true }),
    ];
    const report = buildDedupReport([...cluster1, ...cluster2]);
    expect(report.exactClusterCount).toBe(2);
    expect(report.exactDuplicateRows).toBe(3);     // 2 from cluster1 + 1 from cluster2
    expect(report.safeAutoMergeRows).toBe(2);      // only cluster1's 2 dups
    expect(report.humanReviewRows).toBeGreaterThanOrEqual(1); // cluster2's 1 dup
  });

  it("near-duplicates ALWAYS land in human review, never auto-merge", () => {
    const a = row({
      id: "a",
      excerpt:
        "Microsoft 365 Copilot supports tenant isolated data processing per the security review document published in 2026",
    });
    const b = row({
      id: "b",
      excerpt:
        "Microsoft 365 Copilot supports tenant isolated data processing per the security review document published earlier in 2026",
    });
    const report = buildDedupReport([a, b], { nearSimilarityThreshold: 0.7 });
    expect(report.nearClusterCount).toBe(1);
    expect(report.safeAutoMergeRows).toBe(0);
    expect(report.humanReviewRows).toBeGreaterThanOrEqual(1);
  });

  it("classifier fallback values are NEVER used to decide cluster membership", () => {
    // Two rows with identical raw content — one with high confidence, one
    // a classifier fallback. They MUST cluster together (identity is by
    // raw evidence, not classifier output).
    const a = row({ id: "a", classifierConfidence: 0.95 });
    const b = row({
      id: "b",
      classifierConfidence: 0,
      classificationFailed: true,
      confidenceIsFallback: true,
      classifierRationale: null,
    });
    const clusters = clusterExact([a, b]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toHaveLength(2);
  });
});

describe("INVARIANT — fallback rows never auto-merge", () => {
  // No matter the configuration, an exact cluster containing any
  // classifier-fallback row must NEVER contribute to safeAutoMergeRows.
  const cases: { name: string; over: Partial<DedupInput> }[] = [
    { name: "classificationFailed=true", over: { classificationFailed: true, classifierConfidence: 0 } },
    { name: "confidenceIsFallback=true", over: { confidenceIsFallback: true, classifierConfidence: 0 } },
    { name: "rationale=null + conf=0", over: { classifierRationale: null, classifierConfidence: 0, classificationFailed: true } },
  ];
  for (const c of cases) {
    it(`fallback path: ${c.name}`, () => {
      const a = row({ id: "a" });
      const b = row({ id: "b", ...c.over });
      const report = buildDedupReport([a, b]);
      expect(report.safeAutoMergeRows).toBe(0);
    });
  }
});
