// C16 — credit meter guarantees. Two load-bearing properties:
//  (1) with billing OFF (the default), the meter is COMPLETELY INERT — every
//      reserve is allowed and commits nothing, so the live app is unchanged;
//  (2) with billing ON but no plan access, it denies cleanly (never charges,
//      never throws). Runs without a database (hasDatabase() false in test).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("credit meter — INERT when BILLING_ENABLED is off (default)", () => {
  it("reserve is always allowed, commit is a no-op, balance reports zero usage", async () => {
    vi.resetModules();
    delete process.env.BILLING_ENABLED; // default OFF
    const { reserveCredit, getBalance } = await import("./credits");

    const res = await reserveCredit("sub_test", "interrogate");
    expect(res.allowed).toBe(true);
    expect(res.reason).toBeUndefined();
    // Committing a "real spend" must NOT throw and must record nothing (no DB).
    await expect(res.commit(true)).resolves.toBeUndefined();

    const bal = await getBalance("sub_test");
    expect(bal.used).toBe(0);
    expect(bal.remaining).toBe(bal.cap);
  });
});

describe("credit meter — ENFORCING when BILLING_ENABLED is on", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.BILLING_ENABLED = "1";
  });
  afterEach(() => {
    delete process.env.BILLING_ENABLED;
    vi.resetModules();
  });

  it("denies with no_plan_access for a signed-out (null) subscriber", async () => {
    const { reserveCredit } = await import("./credits");
    const res = await reserveCredit(null, "interrogate");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("no_plan_access");
  });

  it("denies a Free-tier member (no DB → defaults Free, which lacks the metered action)", async () => {
    // With no DATABASE_URL the entitlement resolver returns the Free plan, which
    // includes no paywalled feature — so a metered action is correctly refused.
    const { reserveCredit } = await import("./credits");
    const res = await reserveCredit("sub_free", "prep_kit");
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe("no_plan_access");
    // A denied reservation's commit is still a safe no-op.
    await expect(res.commit(true)).resolves.toBeUndefined();
  });
});
