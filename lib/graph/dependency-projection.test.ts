// Dependency-projection guard (pure). Confirms the exposure→dependency mapping
// is total, well-formed, and carries provenance through verbatim — so the graph
// can never show an edge that isn't source-backed.

import { describe, it, expect } from "vitest";
import { EXPOSURE_EDGES } from "../investing/exposure-map-data";
import {
  projectExposureToDependencyEdges,
  summariseByKind,
  type DependencyKind,
} from "./dependency-projection";

const KINDS: DependencyKind[] = ["compute", "model", "infra", "capital", "distribution", "encroachment"];

describe("projectExposureToDependencyEdges", () => {
  const edges = projectExposureToDependencyEdges();

  it("projects every curated edge (no silent drops)", () => {
    expect(edges).toHaveLength(EXPOSURE_EDGES.length);
  });

  it("produces only well-formed, in-range edges", () => {
    for (const e of edges) {
      expect(KINDS).toContain(e.kind);
      expect(e.direction).toBe("depends_on");
      expect(e.strength).toBeGreaterThanOrEqual(0);
      expect(e.strength).toBeLessThanOrEqual(100);
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(100);
      expect(["E0", "E1", "E2", "E3", "E4", "E5"]).toContain(e.evidenceGrade);
      expect(Array.isArray(e.sourceUrls)).toBe(true);
      expect(typeof e.rationale).toBe("string");
      expect(e.fromVendorId).toBeTruthy();
      expect(e.toVendorId).toBeTruthy();
    }
  });

  it("is deterministic + stably ordered", () => {
    const a = projectExposureToDependencyEdges();
    const b = projectExposureToDependencyEdges();
    expect(a.map((e) => `${e.fromVendorId}->${e.toVendorId}:${e.kind}`)).toEqual(
      b.map((e) => `${e.fromVendorId}->${e.toVendorId}:${e.kind}`),
    );
  });
});

describe("summariseByKind", () => {
  it("covers every kind present and ranks providers by dependents desc", () => {
    const summary = summariseByKind(projectExposureToDependencyEdges());
    const totalFromSummary = summary.reduce((s, k) => s + k.edgeCount, 0);
    expect(totalFromSummary).toBe(EXPOSURE_EDGES.length);
    for (const k of summary) {
      const counts = k.topProviders.map((p) => p.dependents);
      const sorted = [...counts].sort((a, b) => b - a);
      expect(counts).toEqual(sorted);
    }
  });
});
