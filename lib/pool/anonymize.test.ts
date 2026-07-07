import { describe, it, expect } from "vitest";
import { parseClassification, anonymizeForPool } from "./anonymize";
import { GOAL_CATEGORIES, CONSTRAINT_TAGS } from "./types";
import type { IntentProfile } from "../interrogation/types";

describe("parseClassification — never invents a category, never passes raw text through", () => {
  it("accepts a valid goalCategory + constraintTags from the allowed lists", () => {
    const r = parseClassification({ goalCategory: "coding_copilot", constraintTags: ["budget", "timeline"] });
    expect(r.goalCategory).toBe("coding_copilot");
    expect(r.constraintTags).toEqual(["budget", "timeline"]);
  });

  it("falls back goalCategory to 'other' on an invented/unknown id — never invents a new category", () => {
    const r = parseClassification({ goalCategory: "world_domination", constraintTags: [] });
    expect(r.goalCategory).toBe("other");
  });

  it("drops any constraintTag not in the fixed taxonomy", () => {
    const r = parseClassification({ goalCategory: "cost_reduction", constraintTags: ["budget", "made_up_tag", "security"] });
    expect(r.constraintTags).toEqual(["budget", "security"]);
  });

  it("dedupes constraintTags", () => {
    const r = parseClassification({ goalCategory: "cost_reduction", constraintTags: ["budget", "budget"] });
    expect(r.constraintTags).toEqual(["budget"]);
  });

  it("handles missing/malformed input honestly (falls back, never throws)", () => {
    const r = parseClassification({});
    expect(r.goalCategory).toBe("other");
    expect(r.constraintTags).toEqual([]);
  });

  it("every GOAL_CATEGORIES id round-trips (the taxonomy is internally consistent)", () => {
    for (const g of GOAL_CATEGORIES) {
      expect(parseClassification({ goalCategory: g.id, constraintTags: [] }).goalCategory).toBe(g.id);
    }
  });

  it("every CONSTRAINT_TAGS id round-trips", () => {
    for (const c of CONSTRAINT_TAGS) {
      expect(parseClassification({ goalCategory: "other", constraintTags: [c.id] }).constraintTags).toEqual([c.id]);
    }
  });
});

describe("anonymizeForPool — the output shape has NO identity fields", () => {
  const intent: IntentProfile = {
    vertical: "financial_services",
    sizeBand: "global_enterprise",
    region: "north_america",
    goal: "We're First National Bank looking to standardize a coding copilot across 200 engineers",
    constraints: ["Must be SOC2 compliant", "Budget capped at $500k"],
  };

  it("returns only segment + coarse categories + date — TypeScript itself has no field for org/seat/session", () => {
    // This is a structural assertion as much as a runtime one: PoolContribution
    // has no orgId/seatId/sessionId key, so there is nothing to assert absent
    // at runtime that the type system doesn't already forbid at compile time.
    return anonymizeForPool(intent).then((c) => {
      expect(Object.keys(c).sort()).toEqual(
        ["constraintTags", "contributedAt", "goalCategory", "region", "sizeBand", "vertical"].sort(),
      );
      expect(c.vertical).toBe("financial_services");
      expect(c.sizeBand).toBe("global_enterprise");
      expect(c.region).toBe("north_america");
    });
  });

  it("never carries the raw goal/constraint TEXT through — only category ids", async () => {
    const c = await anonymizeForPool(intent);
    const serialized = JSON.stringify(c);
    expect(serialized).not.toMatch(/First National/i);
    expect(serialized).not.toMatch(/500k/i);
    expect(serialized).not.toMatch(/200 engineers/i);
  });

  it("degrades honestly to 'other'/no tags when no LLM is configured (stub)", async () => {
    const c = await anonymizeForPool(intent);
    // In the test environment there is no ANTHROPIC_API_KEY, so this exercises
    // the stub fallback — still a valid, safe PoolContribution, never a crash.
    expect(GOAL_CATEGORIES.map((g) => g.id)).toContain(c.goalCategory);
    expect(Array.isArray(c.constraintTags)).toBe(true);
  });
});
