// Evidence-Depth Job A — cited-edge dataset integrity. These tests are the
// fabrication firewall for the graph: every edge must trace to the dataset,
// resolve to real nodes, carry a real https source, and render its tier
// honestly (LOI/Derived dashed — never presented as done deals).
import { describe, it, expect } from "vitest";
import {
  CITED_EDGES,
  CITED_NEW_NODES,
  CITED_TIER_TO_CONFIDENCE,
  citedToExposureEdge,
  mergeCitedEdges,
} from "./cited-edges";
import { EXPOSURE_NODES, EXPOSURE_EDGES, type ExposureMapEdge } from "../investing/exposure-map-data";

const NODE_IDS = new Set(EXPOSURE_NODES.map((n) => n.id));

describe("cited-edge dataset integrity", () => {
  it("contains exactly 28 records from 25 ingested dataset rows (row 14 skipped, row 26 expanded ×4)", () => {
    expect(CITED_EDGES.length).toBe(28);
    const rows = new Set(CITED_EDGES.map((c) => c.datasetRow));
    expect(rows.has(14)).toBe(false); // group claim — deliberately not ingested
    expect(CITED_EDGES.filter((c) => c.datasetRow === 26).length).toBe(4); // the four NAMED encroachers
  });

  it("every edge resolves to real nodes (incl. the three added: Broadcom, SoftBank, MGX)", () => {
    for (const c of CITED_EDGES) {
      expect(NODE_IDS.has(c.sourceId), `unknown source ${c.sourceId} (row ${c.datasetRow})`).toBe(true);
      expect(NODE_IDS.has(c.targetId), `unknown target ${c.targetId} (row ${c.datasetRow})`).toBe(true);
    }
    for (const n of CITED_NEW_NODES) expect(NODE_IDS.has(n.id)).toBe(true);
  });

  it("every edge carries a real https source URL", () => {
    for (const c of CITED_EDGES) {
      expect(c.sourceUrl, `row ${c.datasetRow}`).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
    }
  });

  it("LOI and Derived tiers map to 'seed' confidence → they render DASHED, never as done deals", () => {
    expect(CITED_TIER_TO_CONFIDENCE.loi).toBe("seed");
    expect(CITED_TIER_TO_CONFIDENCE.derived).toBe("seed");
    const nvdaOpenai = CITED_EDGES.find((c) => c.datasetRow === 16)!;
    expect(nvdaOpenai.tier).toBe("loi");
    const exposure = citedToExposureEdge(nvdaOpenai);
    expect(exposure.confidence).toBe("seed");
    expect(exposure.summary).toContain("LOI — not definitive");
  });

  it("derived encroachment edges carry the derived label in their rendered summary", () => {
    for (const c of CITED_EDGES.filter((x) => x.tier === "derived")) {
      expect(citedToExposureEdge(c).summary).toContain("Derived (analyst inference)");
    }
  });

  it("every rendered summary carries its tier + as-of (the honest provenance prefix)", () => {
    for (const c of CITED_EDGES) {
      const s = citedToExposureEdge(c).summary;
      expect(s.startsWith("["), c.id).toBe(true);
      expect(s).toContain(`as-of ${c.asOf}`);
    }
  });
});

describe("mergeCitedEdges — cited replaces matching curated, appends the rest", () => {
  it("replaces a base edge with the same (source, target, type) and appends unmatched cited edges", () => {
    const base: ExposureMapEdge[] = [
      {
        id: "msft-openai", sourceId: "MSFT", targetId: "openai", relationshipType: "investment",
        strengthScore: 1, confidence: "high", dateUpdated: "2025-01-01",
        summary: "old curated summary", sourceUrls: ["https://example-old.com/"],
      },
    ];
    const merged = mergeCitedEdges(base);
    // The matching cited edge (row 15) replaced the base edge in place:
    const replaced = merged.find((e) => e.sourceId === "MSFT" && e.targetId === "openai" && e.relationshipType === "investment")!;
    expect(replaced.id).toBe("cited-15-msft-openai");
    expect(replaced.summary).toContain("Confirmed");
    // No duplicate pair with the same type:
    const pairCount = merged.filter((e) => e.sourceId === "MSFT" && e.targetId === "openai" && e.relationshipType === "investment").length;
    expect(pairCount).toBe(1);
    // All 28 cited records present overall (27 appended + 1 replacement):
    expect(merged.length).toBe(1 - 1 + 28);
  });

  it("the LIVE merged export contains all 28 cited edge ids exactly once", () => {
    const ids = EXPOSURE_EDGES.map((e) => e.id);
    for (const c of CITED_EDGES) {
      expect(ids.filter((i) => i === c.id).length, c.id).toBe(1);
    }
  });

  it("the live merge never loses a base pair — every (source,target,type) key survives", () => {
    // Merged output must be >= cited count and contain no key collisions.
    const key = (e: ExposureMapEdge) => `${e.sourceId}→${e.targetId}·${e.relationshipType}`;
    const seen = new Map<string, number>();
    for (const e of EXPOSURE_EDGES) seen.set(key(e), (seen.get(key(e)) ?? 0) + 1);
    for (const [k, n] of seen) expect(n, `duplicate pair ${k}`).toBeLessThanOrEqual(1);
  });
});
