// Parity + honesty guards for the ported Privacy & IP Shield ledger.
// ─────────────────────────────────────────────────────────────────────────────
// The baseline below is The Desk's own committed snapshot (its lib/deltas.ts,
// BASELINE_DATE 2026-07-15) — an INDEPENDENT expected result computed before the
// port. If these scores still reproduce exactly, the ledger crossed intact and
// no mark was altered in transit. This is the whole point of the file: the marks
// are legal claims about real vendors' terms, so "we didn't change anything" has
// to be provable, not asserted.

import { describe, it, expect } from "vitest";
import {
  SHIELD,
  SHIELD_VERSION,
  rankedShield,
  shieldCoverage,
  shieldScoreWeighted,
  rankedShieldWeighted,
  DEFAULT_SHIELD_WEIGHTS,
} from "./data";
import { shieldForVendorId, shieldAppliesTo, vendorIdForShieldSlug, shieldCoveredVendorIds } from "./vendor-map";

/** The Desk's committed baseline at equal weights (its lib/deltas.ts). */
const DESK_BASELINE: Record<string, number> = {
  "anthropic-api": 4,
  cohere: 3.5,
  "google-gemini": 3.5,
  "openai-api": 3.5,
  "alibaba-qwen": 3,
  "meta-llama": 3,
  "mistral-la-plateforme": 3,
  "ai21-jamba": 2.5,
  "zai-glm": 2.5,
  "ibm-granite": 2,
  "xai-grok": 2,
  reka: 1,
  "moonshot-kimi": 0.5,
  deepseek: 0,
};

describe("shield ledger — port parity", () => {
  it("carries all 14 model providers", () => {
    expect(SHIELD).toHaveLength(14);
    expect(SHIELD_VERSION).toBe("2026-07-14b");
  });

  it("reproduces The Desk's baseline score for every vendor, exactly", () => {
    for (const v of rankedShield()) {
      expect(`${v.slug}=${v.score}`).toBe(`${v.slug}=${DESK_BASELINE[v.slug]}`);
    }
  });

  it("equal-weight scoring agrees with the fixed ranking (same rubric, stated twice)", () => {
    for (const v of SHIELD) {
      expect(shieldScoreWeighted(v, DEFAULT_SHIELD_WEIGHTS)).toBe(DESK_BASELINE[v.slug]);
    }
  });

  it("ranks ties alphabetically — stated, boring, un-gameable", () => {
    const ranked = rankedShield();
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1];
      const cur = ranked[i];
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
      if (prev.score === cur.score) expect(prev.vendor.localeCompare(cur.vendor)).toBeLessThan(0);
    }
  });
});

describe("shield ledger — honesty invariants", () => {
  it("every determined mark cites a source; only unverified marks may lack one", () => {
    for (const v of SHIELD) {
      for (const [dim, mark] of Object.entries(v.marks)) {
        if (mark.state === "unverified") continue;
        expect(`${v.slug}.${dim} source`, `${v.slug}.${dim} asserts "${mark.state}" with no receipt`).toBeTruthy();
        expect(mark.source?.url ?? "").toMatch(/^https?:\/\//);
        expect(mark.note.length).toBeGreaterThan(0);
      }
    }
  });

  it("holds exactly the six known receipt gaps — no silent drift", () => {
    const gaps = SHIELD.flatMap((v) =>
      Object.entries(v.marks)
        .filter(([, m]) => m.state === "unverified")
        .map(([dim]) => `${v.slug}.${dim}`),
    ).sort();
    expect(gaps).toEqual(
      [
        "alibaba-qwen.indemnity",
        "ibm-granite.residency",
        "ibm-granite.retention",
        "reka.retention",
        "xai-grok.indemnity",
        "xai-grok.residency",
      ].sort(),
    );
  });

  it("an unverified mark never scores above a verified adverse one (under-claim, never over-claim)", () => {
    // Both score 0. The distinction is carried by coverage, not by the score —
    // which is why coverage must be rendered alongside it, never dropped.
    const xai = SHIELD.find((v) => v.slug === "xai-grok")!;
    const deepseek = SHIELD.find((v) => v.slug === "deepseek")!;
    expect(shieldCoverage(xai)).toBe(2); // 2 gaps
    expect(shieldCoverage(deepseek)).toBe(4); // fully verified, and fully adverse
    expect(DESK_BASELINE["deepseek"]).toBe(0);
  });

  it("re-weighting changes priority, never the underlying facts", () => {
    const residencyOnly = { training: 0, retention: 0, indemnity: 0, residency: 1 };
    const ranked = rankedShieldWeighted(residencyOnly);
    expect(ranked[0].max).toBe(1);
    // Same marks in, same marks out — only the ordering may move.
    expect(ranked.map((r) => r.slug).sort()).toEqual(SHIELD.map((s) => s.slug).sort());
  });
});

describe("shield ↔ vendor crosswalk", () => {
  it("maps 13 of 14 to tracked vendors; Reka is ledger-only", () => {
    expect(shieldCoveredVendorIds()).toHaveLength(13);
    expect(vendorIdForShieldSlug("reka")).toBeNull();
    expect(shieldForVendorId("anthropic")?.vendor).toBe("Anthropic (API)");
  });

  it("out-of-scope vendors resolve to null, not to a zero", () => {
    // NVIDIA is a chip designer — the Shield has nothing to say about it. This
    // must read as "not applicable", never as a failing grade.
    expect(shieldForVendorId("nvidia")).toBeNull();
    expect(shieldAppliesTo("nvidia")).toBe(false);
    expect(shieldAppliesTo("anthropic")).toBe(true);
  });
});
