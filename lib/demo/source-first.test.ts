import { afterEach, describe, expect, it } from "vitest";
import {
  assessModuleStatus,
  explainStatus,
  isDemoSourceFirst,
  summariseCounts,
  DEMO_MODULE_STATUS_LABEL,
  type DemoModuleAssessment,
} from "./source-first";

describe("assessModuleStatus", () => {
  it("liveSignalCount=0 → seed_fallback regardless of seed count", () => {
    expect(assessModuleStatus({ liveSignalCount: 0, seedSignalCount: 0 })).toBe("seed_fallback");
    expect(assessModuleStatus({ liveSignalCount: 0, seedSignalCount: 9999 })).toBe("seed_fallback");
  });

  it("liveSignalCount>0 + seedSignalCount=0 → live", () => {
    expect(assessModuleStatus({ liveSignalCount: 1, seedSignalCount: 0 })).toBe("live");
    expect(assessModuleStatus({ liveSignalCount: 500, seedSignalCount: 0 })).toBe("live");
  });

  it("both>0 → mixed", () => {
    expect(assessModuleStatus({ liveSignalCount: 5, seedSignalCount: 5 })).toBe("mixed");
  });

  it("forceMixed overrides", () => {
    expect(assessModuleStatus({ liveSignalCount: 10, seedSignalCount: 0, forceMixed: true })).toBe("mixed");
  });

  it("forceSeedFallback overrides everything", () => {
    expect(
      assessModuleStatus({ liveSignalCount: 100, seedSignalCount: 0, forceSeedFallback: true, forceMixed: true }),
    ).toBe("seed_fallback");
  });
});

describe("explainStatus", () => {
  it("live message references the live signal count", () => {
    const msg = explainStatus({ status: "live", liveSignalCount: 5, seedSignalCount: 0, moduleLabel: "Capabilities" });
    expect(msg).toContain("Capabilities");
    expect(msg).toContain("5 live signals");
    expect(msg).toContain("no seed fallback");
  });

  it("mixed message references both counts", () => {
    const msg = explainStatus({ status: "mixed", liveSignalCount: 3, seedSignalCount: 7, moduleLabel: "Briefings" });
    expect(msg).toContain("3 live");
    expect(msg).toContain("7 seed");
  });

  it("seed_fallback message never claims verification", () => {
    const msg = explainStatus({ status: "seed_fallback", liveSignalCount: 0, seedSignalCount: 1, moduleLabel: "Investor Tools" });
    expect(msg).toContain("seed-backed");
    expect(msg).toContain("labelled accordingly");
    expect(msg).not.toContain("verified");
  });

  it("singular vs plural ('1 signal' / '2 signals')", () => {
    expect(explainStatus({ status: "live", liveSignalCount: 1, seedSignalCount: 0, moduleLabel: "X" })).toContain("1 live signal,");
    expect(explainStatus({ status: "live", liveSignalCount: 2, seedSignalCount: 0, moduleLabel: "X" })).toContain("2 live signals,");
  });
});

describe("isDemoSourceFirst", () => {
  const originalEnv = process.env.DEMO_SOURCE_FIRST;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DEMO_SOURCE_FIRST;
    else process.env.DEMO_SOURCE_FIRST = originalEnv;
  });

  it("returns true only when env var === '1'", () => {
    process.env.DEMO_SOURCE_FIRST = "1";
    expect(isDemoSourceFirst()).toBe(true);
  });
  it("returns false for any other value", () => {
    process.env.DEMO_SOURCE_FIRST = "true";
    expect(isDemoSourceFirst()).toBe(false);
    process.env.DEMO_SOURCE_FIRST = "0";
    expect(isDemoSourceFirst()).toBe(false);
    delete process.env.DEMO_SOURCE_FIRST;
    expect(isDemoSourceFirst()).toBe(false);
  });
});

describe("summariseCounts", () => {
  it("counts each status bucket", () => {
    const mk = (id: string, status: DemoModuleAssessment["status"]): DemoModuleAssessment => ({
      id, label: id, route: `/${id}`, safeToShow: true, status,
      liveSignalCount: 0, seedSignalCount: 0, reason: "",
    });
    const counts = summariseCounts([
      mk("a", "live"), mk("b", "live"),
      mk("c", "mixed"),
      mk("d", "seed_fallback"), mk("e", "seed_fallback"), mk("f", "seed_fallback"),
    ]);
    expect(counts).toEqual({ live: 2, mixed: 1, seed_fallback: 3 });
  });
});

describe("DEMO_MODULE_STATUS_LABEL — human-readable labels", () => {
  it("never claims 'verified' for seed", () => {
    expect(DEMO_MODULE_STATUS_LABEL.live).toBe("Live");
    expect(DEMO_MODULE_STATUS_LABEL.mixed).toBe("Mixed");
    expect(DEMO_MODULE_STATUS_LABEL.seed_fallback).toBe("Seed fallback");
    for (const v of Object.values(DEMO_MODULE_STATUS_LABEL)) {
      expect(v.toLowerCase()).not.toContain("verified");
    }
  });
});
