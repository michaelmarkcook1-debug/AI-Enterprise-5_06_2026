import { describe, it, expect } from "vitest";
import { newsBridge, buildVendorIndex, PENDING_LABEL, type BridgeVendor } from "./bridge";
import { validateCorrection, CORRECTION_KINDS } from "./corrections";

const VENDORS = [
  { id: "anthropic", slug: "anthropic", name: "Anthropic" },
  { id: "openai", slug: "openai", name: "OpenAI" },
  { id: "moonshot", slug: "kimi", name: "Moonshot AI" }, // id ≠ slug
];
const index = buildVendorIndex(VENDORS);

describe("newsBridge — the honest State-B JOIN (the most public surface)", () => {
  it("resolves vendor tokens to routable vendors, always State B (never a score)", () => {
    const b = newsBridge("n1", ["anthropic", "openai"], index);
    expect(b.vendors.map((v) => v.slug)).toEqual(["anthropic", "openai"]);
    expect(b.state).toBe("pending_reassessment");
    // THE invariant: there is no numeric/delta field on the bridge at all.
    expect(Object.keys(b).sort()).toEqual(["newsItemId", "state", "vendors"]);
    expect(JSON.stringify(b)).not.toMatch(/\bdelta\b|[+-]?\d+\.\d+|score/i);
  });

  it("strips the vendor_ prefix and resolves by id OR slug (id≠slug case)", () => {
    expect(newsBridge("n", ["vendor_anthropic"], index).vendors[0]?.slug).toBe("anthropic");
    expect(newsBridge("n", ["moonshot"], index).vendors[0]?.slug).toBe("kimi"); // resolved by id → slug
    expect(newsBridge("n", ["kimi"], index).vendors[0]?.name).toBe("Moonshot AI"); // resolved by slug
  });

  it("de-duplicates and preserves order; skips unknown tokens (invents nothing)", () => {
    const b = newsBridge("n", ["openai", "vendor_openai", "not-a-vendor", "anthropic"], index);
    expect(b.vendors.map((v) => v.id)).toEqual(["openai", "anthropic"]);
  });

  it("empty / all-unknown tokens → empty vendors (the panel then renders nothing)", () => {
    expect(newsBridge("n", [], index).vendors).toEqual([]);
    expect(newsBridge("n", ["ghost", "phantom"], index).vendors).toEqual([]);
  });

  it("PENDING_LABEL never implies a number or direction", () => {
    expect(PENDING_LABEL).toMatch(/pending re-assessment/i);
    expect(PENDING_LABEL).toMatch(/no score change is claimed/i);
    expect(PENDING_LABEL).not.toMatch(/[+-]?\d/);
  });

  it("buildVendorIndex keys by id AND slug", () => {
    const idx = buildVendorIndex(VENDORS);
    expect(idx.get("moonshot")).toBeTruthy(); // id
    expect(idx.get("kimi")).toBeTruthy(); // slug
    expect((idx.get("kimi") as BridgeVendor).id).toBe("moonshot");
  });
});

describe("validateCorrection — bounds the public write path, moderated only", () => {
  it("accepts a wrong_vendor correction with a vendor slug", () => {
    const r = validateCorrection({ newsItemId: "n1", kind: "wrong_vendor", vendorSlug: "openai" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vendorSlug).toBe("openai");
  });

  it("accepts an 'other' correction with a note", () => {
    const r = validateCorrection({ newsItemId: "n1", kind: "other", note: "this is stale" });
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(validateCorrection({ newsItemId: "n", kind: "delete_everything" }).ok).toBe(false);
  });

  it("rejects a vendor-correction with no vendor, and 'other' with no note", () => {
    expect(validateCorrection({ newsItemId: "n", kind: "wrong_vendor" }).ok).toBe(false);
    expect(validateCorrection({ newsItemId: "n", kind: "missing_vendor" }).ok).toBe(false);
    expect(validateCorrection({ newsItemId: "n", kind: "other" }).ok).toBe(false);
  });

  it("rejects a malformed slug and an over-long / empty newsItemId", () => {
    expect(validateCorrection({ newsItemId: "n", kind: "wrong_vendor", vendorSlug: "bad slug!" }).ok).toBe(false);
    expect(validateCorrection({ newsItemId: "", kind: "other", note: "x" }).ok).toBe(false);
    expect(validateCorrection({ newsItemId: "x".repeat(300), kind: "other", note: "x" }).ok).toBe(false);
  });

  it("bounds an over-long note to 500 chars", () => {
    const r = validateCorrection({ newsItemId: "n", kind: "other", note: "z".repeat(2000) });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.note ?? "").length).toBe(500);
  });

  it("the three kinds are exactly the supported set", () => {
    expect([...CORRECTION_KINDS].sort()).toEqual(["missing_vendor", "other", "wrong_vendor"]);
  });
});
