import { describe, expect, it } from "vitest";
import { buildDemoSummary } from "./runner";
import { urlContainsSecret } from "../connectors/url-scrub";

describe("buildDemoSummary", () => {
  it("returns the expected envelope and module set", async () => {
    const s = await buildDemoSummary();
    expect(s.mode === "on" || s.mode === "off").toBe(true);
    expect(s.globalProvenance === "live" || s.globalProvenance === "seed").toBe(true);
    expect(s.modules.length).toBeGreaterThanOrEqual(8);
    expect(s.counts.live + s.counts.mixed + s.counts.seed_fallback).toBe(s.modules.length);
    // Every module has a status, route, label, and reason
    for (const m of s.modules) {
      expect(m.status === "live" || m.status === "mixed" || m.status === "seed_fallback").toBe(true);
      expect(m.route.startsWith("/")).toBe(true);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.reason.length).toBeGreaterThan(0);
    }
  });

  it("includes the four hero pillars (Assessment, Vendor Intelligence, Capabilities, Briefings)", async () => {
    const s = await buildDemoSummary();
    const ids = new Set(s.modules.map((m) => m.id));
    expect(ids.has("assessment")).toBe(true);
    expect(ids.has("vendor_intelligence")).toBe(true);
    expect(ids.has("capabilities")).toBe(true);
    expect(ids.has("briefings")).toBe(true);
  });

  it("Investor Tools is included but explicitly marked Mixed or Seed fallback", async () => {
    const s = await buildDemoSummary();
    const it = s.modules.find((m) => m.id === "investor_tools");
    expect(it).toBeDefined();
    expect(it!.status === "mixed" || it!.status === "seed_fallback").toBe(true);
    // Investor Tools must NOT show as Live — IPO timing is model_estimate_not_fact
    expect(it!.status).not.toBe("live");
    expect(it!.caveat).toMatch(/MODELLED|model_estimate_not_fact/);
  });

  it("INVARIANT — no field in the summary contains a leaked secret", async () => {
    const s = await buildDemoSummary();
    const serialised = JSON.stringify(s);
    // Common secret param shapes — would never appear in a clean payload
    expect(serialised).not.toMatch(/api_key=[A-Za-z0-9]/);
    expect(serialised).not.toMatch(/apikey=[A-Za-z0-9]/i);
    expect(serialised).not.toMatch(/access_token=[A-Za-z0-9]/);
    // Spot-check every URL-looking field
    for (const c of s.connectors) {
      // We don't expose URLs at all — but if a future change adds them,
      // they must pass urlContainsSecret() === false
      const anyUrl = (c as unknown as { sourceUrl?: string }).sourceUrl;
      if (anyUrl) expect(urlContainsSecret(anyUrl)).toBe(false);
    }
  });

  it("connector list contains only safe fields (no URLs, no env values)", async () => {
    const s = await buildDemoSummary();
    for (const c of s.connectors) {
      // No URL fields should be on the demo summary at all
      expect((c as unknown as Record<string, unknown>).sourceUrl).toBeUndefined();
      expect((c as unknown as Record<string, unknown>).apiDocsUrl).toBeUndefined();
      expect((c as unknown as Record<string, unknown>).homepageUrl).toBeUndefined();
      // No env var values exposed
      expect((c as unknown as Record<string, unknown>).envVars).toBeUndefined();
    }
  });
});
