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

// ─── 2026-07 audit regressions — run over the REAL projected graph ───────────
// Every case below was a CONFIRMED defect live on the homepage "Encroachment
// watch": self-encroachment via subsidiary aliasing, inverted capital
// rationales, bidirectional duplicate arrows, Infrastructure-Player-only
// false positives.
import { NODE_TO_SLUG } from "./encroachment";
import { projectExposureToDependencyEdges } from "./dependency-projection";

const realDeps = projectExposureToDependencyEdges();
const realRoles = buildRolesByNodeId();
const realEdges = deriveEncroachmentEdges(realDeps, realRoles);
const ekey = (e: { fromVendorId: string; toVendorId: string }) => `${e.fromVendorId}->${e.toVendorId}`;
const ekeys = new Set(realEdges.map(ekey));

describe("audit: self-encroachment — a firm cannot encroach on itself", () => {
  it("no edge between node ids resolving to the same entity (deepmind/nemotron aliases)", () => {
    for (const e of realEdges) {
      const a = NODE_TO_SLUG[e.fromVendorId];
      const b = NODE_TO_SLUG[e.toVendorId];
      expect(a && b && a === b, `${ekey(e)} resolves to one entity (${a})`).toBeFalsy();
    }
    for (const bad of ["GOOGL->deepmind", "deepmind->GOOGL", "NVDA->nemotron", "nemotron->NVDA"]) {
      expect(ekeys.has(bad), bad).toBe(false);
    }
  });

  it("never derives encroachment from a subsidiary edge (ownership ≠ competition)", () => {
    for (const e of realEdges) expect(e.relationshipType, ekey(e)).not.toBe("subsidiary");
  });
});

describe("audit: capital direction — investor never 'relies on' its investee", () => {
  it("the live backwards rationales are gone", () => {
    for (const e of realEdges) {
      expect(e.rationale).not.toMatch(/NVIDIA relies on xAI for capital/);
      expect(e.rationale).not.toMatch(/Alphabet relies on Google DeepMind/);
    }
  });

  it("projection: investment edges have the RECIPIENT as the dependent", () => {
    expect(
      realDeps.some((d) => d.relationshipType === "investment" && d.fromVendorId === "anthropic" && d.toVendorId === "GOOGL"),
    ).toBe(true);
    expect(
      realDeps.some((d) => d.relationshipType === "investment" && d.fromVendorId === "GOOGL" && d.toVendorId === "anthropic"),
    ).toBe(false);
  });
});

describe("audit: reciprocal collapse — one arrow per rivalry", () => {
  it("no pair appears in both directions", () => {
    for (const e of realEdges) {
      expect(ekeys.has(`${e.toVendorId}->${e.fromVendorId}`), `both directions of ${ekey(e)}`).toBe(false);
    }
  });
});

describe("audit: coarse-role tightening — Infra-Player/Investor overlap alone never fires", () => {
  it("the live false positives are gone (xAI/Oracle are not silicon rivals)", () => {
    for (const bad of ["xai->NVDA", "ORCL->xai", "xai->ORCL"]) {
      expect(ekeys.has(bad), bad).toBe(false);
    }
  });

  it("no emitted rationale cites Infrastructure Player or Investor as the shared layer", () => {
    for (const e of realEdges) {
      expect(e.rationale).not.toMatch(/operates in the [^—]*Infrastructure Player/);
      expect(e.rationale).not.toMatch(/operates in the [^—]*\bInvestor\b/);
    }
  });
});

describe("audit: the defensible core survives, honestly labeled", () => {
  it("keeps the canonical signals, one direction each", () => {
    expect(ekeys.has("MSFT->openai") || ekeys.has("openai->MSFT")).toBe(true);
    const gPair = (ekeys.has("anthropic->GOOGL") ? 1 : 0) + (ekeys.has("GOOGL->anthropic") ? 1 : 0);
    expect(gPair).toBe(1);
  });

  it("every edge stays a capped, labeled, derived inference", () => {
    expect(realEdges.length).toBeGreaterThan(0);
    for (const e of realEdges) {
      expect(e.kind).toBe("encroachment");
      expect(e.direction).toBe("threatens");
      expect(e.rationale.startsWith("Derived signal:")).toBe(true);
      expect(e.confidence).toBeLessThanOrEqual(40);
      expect(e.evidenceGrade).toBe("E2");
      expect(e.strength).toBeLessThanOrEqual(70);
    }
  });
});
