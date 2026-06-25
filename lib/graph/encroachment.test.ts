import { describe, it, expect } from "vitest";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "./encroachment";
import type { DependencyEdge } from "./dependency-projection";

function dep(from: string, to: string, extra: Partial<DependencyEdge> = {}): DependencyEdge {
  return {
    fromVendorId: from,
    toVendorId: to,
    kind: "model",
    direction: "depends_on",
    strength: 80,
    rationale: "x",
    sourceUrls: ["https://example.com"],
    confidence: 85,
    evidenceGrade: "E4",
    relationshipType: "model_hosting",
    ...extra,
  };
}

describe("deriveEncroachmentEdges", () => {
  const roles = new Map<string, string[]>([
    ["MSFT", ["platform", "model"]],
    ["openai", ["model"]],
    ["NVDA", ["hardware"]],
  ]);

  it("emits a threatens edge when supplier shares the dependent's layer", () => {
    // MSFT depends on openai (model_hosting) AND both are in 'model' → MSFT threatens openai.
    const out = deriveEncroachmentEdges([dep("MSFT", "openai")], roles);
    expect(out).toHaveLength(1);
    expect(out[0].fromVendorId).toBe("MSFT");
    expect(out[0].toVendorId).toBe("openai");
    expect(out[0].direction).toBe("threatens");
    expect(out[0].kind).toBe("encroachment");
  });

  it("does NOT emit when roles do not overlap", () => {
    // NVDA (hardware) supplies openai (model) — no shared layer → no encroachment.
    expect(deriveEncroachmentEdges([dep("openai", "NVDA")], roles)).toHaveLength(0);
  });

  it("caps confidence + strength (it's a derived inference, not a stated fact)", () => {
    const out = deriveEncroachmentEdges([dep("MSFT", "openai", { strength: 100 })], roles);
    expect(out[0].confidence).toBeLessThanOrEqual(40);
    expect(out[0].strength).toBeLessThanOrEqual(70);
  });

  it("skips self-edges and unresolved nodes", () => {
    expect(deriveEncroachmentEdges([dep("MSFT", "MSFT")], roles)).toHaveLength(0);
    expect(deriveEncroachmentEdges([dep("MSFT", "unknown_node")], roles)).toHaveLength(0);
  });

  it("buildRolesByNodeId resolves real exposure nodes to roles", () => {
    const m = buildRolesByNodeId();
    // At least the well-known mapped nodes should resolve.
    expect((m.get("openai") ?? []).length).toBeGreaterThan(0);
  });
});
