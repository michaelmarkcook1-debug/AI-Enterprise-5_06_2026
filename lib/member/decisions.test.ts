import { describe, it, expect } from "vitest";
import { sanitizeDecision } from "./decisions";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import { ENTITIES } from "../intelligence/entities";
import { MARKET_CATEGORIES } from "../intelligence/seed";

const FULL_WEIGHTS = ASSESSMENT_DOMAINS.reduce((acc, d) => {
  acc[d] = 10;
  return acc;
}, {} as Record<string, number>);

const REAL_CATEGORY = MARKET_CATEGORIES[0]!.id as string;
// Prefer a vendor whose id and slug DIFFER, so the test actually exercises the
// id-vs-slug distinction rather than passing coincidentally on either.
const ID_NEQ_SLUG_ENTITY = ENTITIES.find((e) => e.id !== e.slug);
const REAL_VENDOR_ID = (ID_NEQ_SLUG_ENTITY ?? ENTITIES[0]!).id;

function base(overrides: Record<string, unknown> = {}) {
  return { name: "My shortlist", category: REAL_CATEGORY, weights: FULL_WEIGHTS, ...overrides };
}

describe("sanitizeDecision", () => {
  it("accepts a valid decision with all 12 domain weights", () => {
    const out = sanitizeDecision(base());
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.name).toBe("My shortlist");
      expect(out.data.category).toBe(REAL_CATEGORY);
      expect(Object.keys(out.data.weights)).toHaveLength(ASSESSMENT_DOMAINS.length);
    }
  });

  it("rejects a missing or blank name", () => {
    expect(sanitizeDecision(base({ name: "" })).ok).toBe(false);
    expect(sanitizeDecision(base({ name: "   " })).ok).toBe(false);
    expect(sanitizeDecision({ category: REAL_CATEGORY, weights: FULL_WEIGHTS }).ok).toBe(false);
  });

  it("trims and caps the name length", () => {
    const out = sanitizeDecision(base({ name: `  ${"x".repeat(200)}  ` }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.name.length).toBe(120);
      expect(out.data.name.startsWith(" ")).toBe(false);
    }
  });

  it("rejects an unknown or missing category", () => {
    expect(sanitizeDecision(base({ category: "not-a-real-category" })).ok).toBe(false);
    expect(sanitizeDecision(base({ category: "" })).ok).toBe(false);
  });

  it("rejects when any of the 12 domain weights is missing or invalid", () => {
    const { [ASSESSMENT_DOMAINS[0]!]: _dropped, ...missingOne } = FULL_WEIGHTS;
    expect(sanitizeDecision(base({ weights: missingOne })).ok).toBe(false);

    expect(sanitizeDecision(base({ weights: { ...FULL_WEIGHTS, [ASSESSMENT_DOMAINS[1]!]: -1 } })).ok).toBe(false);
    expect(sanitizeDecision(base({ weights: { ...FULL_WEIGHTS, [ASSESSMENT_DOMAINS[1]!]: "10" } })).ok).toBe(false);
    expect(sanitizeDecision(base({ weights: { ...FULL_WEIGHTS, [ASSESSMENT_DOMAINS[1]!]: NaN } })).ok).toBe(false);
  });

  it("defaults to framework weights when weights are OMITTED entirely (the interrogation→shortlist handoff seeds a decision with no priorities yet)", () => {
    const out = sanitizeDecision(base({ weights: undefined }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(Object.keys(out.data.weights)).toHaveLength(ASSESSMENT_DOMAINS.length);
  });

  it("accepts a zero weight (a domain the member deliberately zeroed out, not omitted)", () => {
    const out = sanitizeDecision(base({ weights: { ...FULL_WEIGHTS, [ASSESSMENT_DOMAINS[0]!]: 0 } }));
    expect(out.ok).toBe(true);
  });

  it("validates shortlist entries against real vendor ids (not slugs) and drops unknowns", () => {
    const out = sanitizeDecision(
      base({ shortlist: [{ vendorId: REAL_VENDOR_ID }, { vendorId: "not-a-real-vendor" }] }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.shortlist.map((s) => s.vendorId)).toEqual([REAL_VENDOR_ID]);
    }
  });

  it("keeps a shortlisted vendor whose id differs from its slug", () => {
    expect(ID_NEQ_SLUG_ENTITY, "fixture assumes at least one vendor has id !== slug").toBeTruthy();
    const out = sanitizeDecision(base({ shortlist: [{ vendorId: ID_NEQ_SLUG_ENTITY!.id }] }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.shortlist).toEqual([{ vendorId: ID_NEQ_SLUG_ENTITY!.id }]);
  });

  it("dedupes shortlist entries and caps at 50", () => {
    const dup = sanitizeDecision(base({ shortlist: [{ vendorId: REAL_VENDOR_ID }, { vendorId: REAL_VENDOR_ID }] }));
    expect(dup.ok).toBe(true);
    if (dup.ok) expect(dup.data.shortlist).toHaveLength(1);

    const many = ENTITIES.slice(0, 60).map((e) => ({ vendorId: e.id }));
    const capped = sanitizeDecision(base({ shortlist: many }));
    expect(capped.ok).toBe(true);
    if (capped.ok) expect(capped.data.shortlist.length).toBeLessThanOrEqual(50);
  });

  it("keeps a trimmed note and drops an empty one", () => {
    const out = sanitizeDecision(
      base({ shortlist: [{ vendorId: REAL_VENDOR_ID, note: "  worth a POC  " }] }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.shortlist[0]).toEqual({ vendorId: REAL_VENDOR_ID, note: "worth a POC" });

    const noNote = sanitizeDecision(base({ shortlist: [{ vendorId: REAL_VENDOR_ID, note: "   " }] }));
    expect(noNote.ok).toBe(true);
    if (noNote.ok) expect(noNote.data.shortlist[0]).toEqual({ vendorId: REAL_VENDOR_ID });
  });

  it("validates asOfDate as YYYY-MM-DD, else null", () => {
    expect(sanitizeDecision(base({ asOfDate: "2026-07-01" })).ok).toBe(true);
    const bad = sanitizeDecision(base({ asOfDate: "not-a-date" }));
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.data.asOfDate).toBeNull();
    const missing = sanitizeDecision(base());
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.data.asOfDate).toBeNull();
  });

  it("ignores non-array shortlist and null input safely", () => {
    const out = sanitizeDecision(base({ shortlist: "not-an-array" }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.shortlist).toEqual([]);
    expect(sanitizeDecision(null).ok).toBe(false);
  });
});
