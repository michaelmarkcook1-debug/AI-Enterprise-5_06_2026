import { describe, it, expect } from "vitest";
import { buildDeliveryGraph } from "./delivery-projection";

describe("delivery-partnership graph projection", () => {
  const g = buildDeliveryGraph();

  it("builds a two-layer graph (delivery_partner + ai_vendor) with no orphan edges", () => {
    const partnerNodes = g.nodes.filter((n) => n.layer === "delivery_partner");
    const vendorNodes = g.nodes.filter((n) => n.layer === "ai_vendor");
    expect(partnerNodes.length).toBeGreaterThan(0);
    expect(vendorNodes.length).toBeGreaterThan(0);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.partnerId)).toBe(true);
      expect(ids.has(e.vendorId)).toBe(true);
    }
  });

  it("preserves the three partnership tiers distinctly (never merged)", () => {
    const tiers = new Set(g.edges.map((e) => e.partnershipTier));
    expect(tiers.has("direct_named")).toBe(true);
    expect(tiers.has("cloud_certified")).toBe(true);
    expect(tiers.has("observed_implementer")).toBe(true);
    // strength is bounded and monotone with tier×evidence (direct+strong = 100 max).
    for (const e of g.edges) {
      expect(e.strength).toBeGreaterThan(0);
      expect(e.strength).toBeLessThanOrEqual(100);
    }
  });

  it("flags a platform-integrator hybrid delivering a RIVAL model as encroachment", () => {
    // IBM Consulting (platform hybrid, owns watsonx=ibm) delivers openai + meta (rivals).
    const ibmEdges = g.edges.filter((e) => e.partnerId === "ibm-consulting");
    const toOpenai = ibmEdges.find((e) => e.vendorId === "openai");
    const toMeta = ibmEdges.find((e) => e.vendorId === "meta");
    const toOwn = ibmEdges.find((e) => e.vendorId === "ibm");
    expect(toOpenai?.encroachment).toBe(true);
    expect(toMeta?.encroachment).toBe(true);
    // Delivering its OWN model is NOT encroachment.
    expect(toOwn?.encroachment).toBe(false);
  });

  it("does NOT flag non-hybrid SIs as encroachers", () => {
    const accenture = g.edges.filter((e) => e.partnerId === "accenture");
    expect(accenture.length).toBeGreaterThan(0);
    expect(accenture.every((e) => e.encroachment === false)).toBe(true);
  });

  it("summarises encroachers (hybrid → rival vendors delivered)", () => {
    const ibm = g.encroachers.find((x) => x.partnerId === "ibm-consulting");
    expect(ibm).toBeDefined();
    expect(ibm!.vendorIds).toEqual(expect.arrayContaining(["openai", "meta"]));
    expect(ibm!.vendorIds).not.toContain("ibm"); // own model excluded
  });
});
