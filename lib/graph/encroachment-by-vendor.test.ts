import { describe, it, expect } from "vitest";
import { splitEncroachmentByVendor, encroachmentForVendors } from "./encroachment-by-vendor";
import type { DependencyEdge } from "./dependency-projection";

// Synthetic DERIVED (`threatens`) edges — the output shape of
// deriveEncroachmentEdges — using real node ids from NODE_TO_SLUG so the slug
// resolution is exercised for real. from = threatener, to = threatened.
const edge = (from: string, to: string, strength = 50): DependencyEdge => ({
  fromVendorId: from,
  toVendorId: to,
  kind: "encroachment",
  direction: "threatens",
  strength,
  rationale: `${from} is positioned to encroach on ${to}`,
  sourceUrls: [`https://example.com/${from}-${to}`],
  confidence: 40,
  evidenceGrade: "E2",
  relationshipType: "commercial",
});

describe("splitEncroachmentByVendor — directional per-vendor split", () => {
  it("puts an edge on encroachesOn for the threatener and encroachedBy for the threatened", () => {
    const derived = [edge("MSFT", "openai")]; // microsoft → openai
    const map = splitEncroachmentByVendor(derived, ["microsoft", "openai"]);

    const ms = map.get("microsoft")!;
    expect(ms.mapped).toBe(true);
    expect(ms.encroachesOn.map((r) => r.vendorSlug)).toEqual(["openai"]);
    expect(ms.encroachedBy).toEqual([]);

    const oa = map.get("openai")!;
    expect(oa.encroachedBy.map((r) => r.vendorSlug)).toEqual(["microsoft"]);
    expect(oa.encroachesOn).toEqual([]);
  });

  it("carries the rationale, sources, strength and confidence through unchanged", () => {
    const derived = [edge("MSFT", "openai", 63)];
    const rel = splitEncroachmentByVendor(derived, ["openai"]).get("openai")!.encroachedBy[0];
    expect(rel.strength).toBe(63);
    expect(rel.confidence).toBe(40);
    expect(rel.sourceUrls).toEqual(["https://example.com/MSFT-openai"]);
    expect(rel.rationale).toContain("encroach");
  });

  it("marks a vendor with no graph node as mapped:false with empty relations (honest absence)", () => {
    const map = splitEncroachmentByVendor([edge("MSFT", "openai")], ["accenture"]);
    expect(map.get("accenture")).toEqual({ encroachesOn: [], encroachedBy: [], mapped: false });
  });

  it("dedupes to the strongest relation per counterparty slug", () => {
    // google is reachable via both GOOGL and deepmind nodes; two edges to openai
    // must collapse to one relation, keeping the stronger.
    const derived = [edge("GOOGL", "openai", 40), edge("deepmind", "openai", 66)];
    const g = splitEncroachmentByVendor(derived, ["google"]).get("google")!;
    expect(g.encroachesOn).toHaveLength(1);
    expect(g.encroachesOn[0]).toMatchObject({ vendorSlug: "openai", strength: 66 });
  });

  it("never lists a vendor as encroaching on itself", () => {
    // deepmind and GOOGL both resolve to google; an edge between them must not
    // surface google→google.
    const derived = [edge("deepmind", "GOOGL", 55)];
    const g = splitEncroachmentByVendor(derived, ["google"]).get("google")!;
    expect(g.encroachesOn).toEqual([]);
    expect(g.encroachedBy).toEqual([]);
  });

  it("orders relations strongest-first, deterministically", () => {
    const derived = [edge("MSFT", "anthropic", 30), edge("MSFT", "openai", 70), edge("MSFT", "cohere", 50)];
    const ms = splitEncroachmentByVendor(derived, ["microsoft"]).get("microsoft")!;
    expect(ms.encroachesOn.map((r) => r.vendorSlug)).toEqual(["openai", "cohere", "anthropic"]);
  });
});

describe("encroachmentForVendors — live wiring", () => {
  it("returns an entry for every requested slug and never throws on the real map", () => {
    const map = encroachmentForVendors(["anthropic", "openai", "accenture"]);
    expect([...map.keys()].sort()).toEqual(["accenture", "anthropic", "openai"]);
    // A vendor off the graph (GSI) is honestly unmapped, not fabricated.
    expect(map.get("accenture")!.mapped).toBe(false);
  });
});
