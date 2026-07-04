// C16 — tier ladder + entitlement matrix invariants. The load-bearing rule:
// the FREE FUNNEL is never an entitlement, and each tier is a superset of the
// one below. Pure — no DB, no flags.
import { describe, it, expect } from "vitest";
import {
  PLANS,
  FREE_PLAN,
  planById,
  annualMonthlyUsd,
  ANNUAL_DISCOUNT,
  METERED_ACTIONS,
  type Feature,
  type PlanId,
} from "./plans";

const byId = (id: PlanId) => PLANS.find((p) => p.id === id)!;

describe("tier ladder shape", () => {
  it("has exactly the five expected plans in ladder order", () => {
    expect(PLANS.map((p) => p.id)).toEqual(["free", "individual", "pro", "team", "enterprise"]);
  });

  it("Free is genuinely free and grants NO paywalled feature (the funnel is never gated)", () => {
    expect(FREE_PLAN.id).toBe("free");
    expect(FREE_PLAN.priceMonthlyUsd).toBe(0);
    expect(FREE_PLAN.creditsIncluded).toBe(0);
    expect(FREE_PLAN.features).toEqual([]);
  });

  it("each paid tier is a feature superset of the tier below it", () => {
    const order: PlanId[] = ["free", "individual", "pro", "team", "enterprise"];
    for (let i = 1; i < order.length; i++) {
      const lower = new Set(byId(order[i - 1]).features);
      const higher = new Set(byId(order[i]).features);
      for (const f of lower) expect(higher.has(f), `${order[i]} missing ${f} from ${order[i - 1]}`).toBe(true);
    }
  });

  it("the metered actions are exactly interrogate + prep_kit + tab_chat and are real features", () => {
    // tab_chat added by the AnalystGenius batch piece 3 (per-tab grounded chat).
    expect([...METERED_ACTIONS].sort()).toEqual(["interrogate", "prep_kit", "tab_chat"]);
    const paidFeatures = new Set<Feature>(byId("individual").features);
    for (const a of METERED_ACTIONS) expect(paidFeatures.has(a)).toBe(true);
  });

  it("credit allotment never exceeds the hard cap, and paid tiers include credits", () => {
    for (const p of PLANS) {
      expect(p.creditsIncluded).toBeLessThanOrEqual(p.creditsHardCap);
      if (p.id !== "free") expect(p.creditsIncluded).toBeGreaterThan(0);
    }
  });
});

describe("pricing helpers", () => {
  it("planById defaults unknown/empty ids to Free (never full access)", () => {
    expect(planById("nope").id).toBe("free");
    expect(planById(null).id).toBe("free");
    expect(planById("pro").id).toBe("pro");
  });

  it("annualMonthlyUsd applies the ~17% discount and is null for contact-sales", () => {
    const pro = byId("pro");
    expect(annualMonthlyUsd(pro)).toBe(Math.round(pro.priceMonthlyUsd! * (1 - ANNUAL_DISCOUNT)));
    expect(annualMonthlyUsd(byId("enterprise"))).toBeNull(); // priceMonthlyUsd null
    expect(annualMonthlyUsd(FREE_PLAN)).toBe(0);
  });
});
