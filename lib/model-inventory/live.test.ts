// Live model inventory — the firewall guarantee: with no database it returns
// the honest EMPTY state, NEVER a seed fallback. (The real aggregation is
// validated end-to-end against live benchmark data on the preview.)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("getLiveModelInventory — honest empty state, never seed", () => {
  const saved = process.env.DATABASE_URL;
  beforeEach(() => {
    vi.resetModules();
    delete process.env.DATABASE_URL; // hasDatabase() → false
  });
  afterEach(() => {
    if (saved !== undefined) process.env.DATABASE_URL = saved;
    vi.resetModules();
  });

  it("returns EMPTY (no models) when there is no database — not the hardcoded seed", async () => {
    const { getLiveModelInventory } = await import("./live");
    const inv = await getLiveModelInventory();
    expect(inv.totalModels).toBe(0);
    expect(inv.models).toEqual([]);
    expect(inv.totalVendors).toBe(0);
    expect(inv.freshestPublishDate).toBeNull();
    expect(inv.sources).toEqual([]);
  });
});
