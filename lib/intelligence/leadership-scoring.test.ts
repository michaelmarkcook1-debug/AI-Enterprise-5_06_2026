// Regression guards for the leadership downgrade (Jun 2026).
// Pins the scoring math AND the sniff test the user asked for: scale /
// distribution / capital incumbents must NOT outrank genuine capability leaders
// in the headline ranking, while a real model house (Google) is NOT demoted just
// because its primary tag is a platform role.
import { describe, it, expect } from "vitest";
import {
  blendLeadership,
  compressScaleLeadership,
  rankingLeadership,
  ENTITIES,
  type RoleScore,
  type RoleScores,
} from "./entities";

const roleScore = (leadership: number): RoleScore => ({
  leadership,
  innovation: 70,
  readiness: 70,
  reach: 70,
  confidence: 70,
  evidenceGrade: "E3",
  rationale: "test",
});

describe("blendLeadership", () => {
  it("weights market 0.5 / readiness 0.3 / innovation 0.2", () => {
    expect(blendLeadership(100, 0, 0)).toBe(50);
    expect(blendLeadership(0, 100, 0)).toBe(30);
    expect(blendLeadership(0, 0, 100)).toBe(20);
  });

  it("clamps to 0..100 and passes through a uniform score", () => {
    expect(blendLeadership(100, 100, 100)).toBe(100);
    expect(blendLeadership(0, 0, 0)).toBe(0);
    expect(blendLeadership(80, 80, 80)).toBe(80);
  });

  it("coerces non-finite inputs instead of producing NaN", () => {
    const v = blendLeadership(Number.NaN, 50, 50);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(blendLeadership(0, 50, 50)); // NaN market → treated as 0
  });
});

describe("compressScaleLeadership", () => {
  it("compresses scale roles halfway toward the 70 anchor when above it", () => {
    expect(compressScaleLeadership(90, "Platform Vendor")).toBe(80);
    expect(compressScaleLeadership(100, "Cloud / Hosting Provider")).toBe(85);
    expect(compressScaleLeadership(93, "Investor")).toBe(82);
  });

  it("leaves capability roles and sub-anchor values untouched", () => {
    expect(compressScaleLeadership(90, "Model Provider")).toBe(90);
    expect(compressScaleLeadership(90, "Hardware Provider")).toBe(90);
    expect(compressScaleLeadership(65, "Investor")).toBe(65);
    expect(compressScaleLeadership(70, "Platform Vendor")).toBe(70); // not > anchor
  });
});

describe("rankingLeadership", () => {
  it("compresses a scale-primary incumbent with no model strength", () => {
    // blend(91,91,76)=87 → compress(Platform)=79
    expect(rankingLeadership(91, 91, 76, "Platform Vendor")).toBe(79);
    expect(rankingLeadership(91, 91, 76, "Platform Vendor", { "Model Provider": roleScore(56) })).toBe(79);
  });

  it("does not compress a capability-primary vendor", () => {
    // Model-Provider blend weights are 0.7/0.1/0.2 since the Jun-2026 readiness
    // downgrade (entities.ts): 89*0.7 + 78*0.1 + 90*0.2 = 88.1 → 88; no compression.
    expect(rankingLeadership(89, 78, 90, "Model Provider")).toBe(88);
  });

  it("carve-out: a frontier-model house keeps its blended score despite a scale primary tag", () => {
    const blended = blendLeadership(88, 82, 84); // 86
    const carved = rankingLeadership(88, 82, 84, "Platform Vendor", { "Model Provider": roleScore(89) });
    expect(carved).toBe(blended);
    // …and that is strictly higher than it would be if compressed as a scale player.
    expect(carved).toBeGreaterThan(rankingLeadership(88, 82, 84, "Platform Vendor"));
  });
});

describe("ENTITIES sniff test (the user's actual requirement)", () => {
  const byId = new Map(ENTITIES.map((e) => [e.id, e]));
  const microsoft = byId.get("microsoft")!;
  const openai = byId.get("openai")!;
  const anthropic = byId.get("anthropic")!;
  const google = byId.get("google")!;

  it("preserves the raw market score separately from the downgraded leadership score", () => {
    expect(microsoft.marketLeadership).toBe(91); // raw editorial input untouched
    expect(microsoft.leadershipScore).toBeLessThan(microsoft.marketLeadership);
    expect(microsoft.leadershipScore).toBe(79);
  });

  it("ranks capability leaders above the platform/distribution giant", () => {
    expect(microsoft.leadershipScore).toBeLessThan(openai.leadershipScore);
    expect(microsoft.leadershipScore).toBeLessThan(anthropic.leadershipScore);
    expect(microsoft.leadershipScore).toBeLessThan(google.leadershipScore);
  });

  it("does NOT demote Google despite its platform primary tag (capability carve-out)", () => {
    expect(google.leadershipScore).toBeGreaterThanOrEqual(85);
  });

  it("compresses per-role scale leadership but leaves the model role intact", () => {
    const rs = microsoft.roleScores as RoleScores;
    expect(rs["Platform Vendor"]!.leadership).toBe(81); // 91 → compressed
    expect(rs["Investor"]!.leadership).toBe(82); // 93 → compressed
    expect(rs["Model Provider"]!.leadership).toBe(56); // capability role unchanged
  });
});
