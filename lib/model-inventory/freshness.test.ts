import { describe, it, expect } from "vitest";
import { freshnessBadge } from "./freshness";

const NOW = new Date("2026-07-08T14:30:00Z");

describe("freshnessBadge", () => {
  it("returns null for missing or unparseable dates — never a guessed freshness", () => {
    expect(freshnessBadge(null, NOW)).toBeNull();
    expect(freshnessBadge(undefined, NOW)).toBeNull();
    expect(freshnessBadge("not-a-date", NOW)).toBeNull();
  });

  it("labels today and yesterday specially", () => {
    expect(freshnessBadge("2026-07-08", NOW)).toEqual({ daysOld: 0, label: "today", level: "fresh" });
    expect(freshnessBadge("2026-07-07", NOW)).toEqual({ daysOld: 1, label: "1 day ago", level: "fresh" });
  });

  it("crosses into 'aging' at 2 days, 'stale' at 7 days", () => {
    expect(freshnessBadge("2026-07-06", NOW)?.level).toBe("aging"); // 2 days
    expect(freshnessBadge("2026-07-03", NOW)?.level).toBe("aging"); // 5 days
    expect(freshnessBadge("2026-07-02", NOW)).toEqual({ daysOld: 6, label: "6 days ago", level: "aging" });
    expect(freshnessBadge("2026-07-01", NOW)?.level).toBe("stale"); // 7 days
    expect(freshnessBadge("2026-06-01", NOW)?.level).toBe("stale");
  });

  it("never goes negative for a future-dated (clock-skew) publish date", () => {
    expect(freshnessBadge("2026-07-09", NOW)?.daysOld).toBe(0);
  });

  it("is deterministic for the same inputs", () => {
    expect(freshnessBadge("2026-07-02", NOW)).toEqual(freshnessBadge("2026-07-02", NOW));
  });
});
