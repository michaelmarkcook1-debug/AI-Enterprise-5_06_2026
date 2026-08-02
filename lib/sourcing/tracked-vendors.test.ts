// Guard: every vendor we track competitively must be taggable in the news feed.
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-08-02: "not all vendors are featured in the news ingestion."
// Correct — and it was structural, not a sourcing problem. TRACKED_VENDOR_NAMES
// is the ONLY set of vendors the Haiku scorer is permitted to tag (see
// market-news-runner.ts, which builds NAME_TO_ID from it and drops any name that
// does not resolve). A vendor missing from that map can never be attributed to a
// story no matter how many feeds cover it, and nothing anywhere failed — the
// pipeline reported a clean run while silently ignoring a third of the roster.
//
// Two distinct defects were behind it, and this file exists to make both loud:
//
//   1. MISSING ENTRIES. 10 of the 41 vendors listed on /vendors had no entry.
//   2. WRONG ID-SPACE. "together-ai" was keyed by ENTITY slug, but this map is
//      keyed by BARE SPINE id. lib/intelligence/vendor-id.ts exists precisely
//      because those differ (together-ai→together, fireworks-ai→fireworks,
//      zhipu-glm→zai, alibaba-qwen→alibaba, moonshot-kimi→moonshot). A key in
//      the wrong space is worse than a missing one: it looks present, so the
//      vendor reads as covered while every tag it produces points at nothing.
//
// COMPETITIVE_TARGETS is the reference set because it is already curated per
// vendor (id, display name, aliases, domain) and is keyed by the same bare spine
// id. Parity with it is the invariant; both defects above break it.

import { describe, it, expect } from "vitest";
import { TRACKED_VENDOR_NAMES } from "./ai-news-manifest";
import { COMPETITIVE_TARGETS } from "../intelligence/competitive-targets";

describe("TRACKED_VENDOR_NAMES ↔ COMPETITIVE_TARGETS parity", () => {
  it("lets every competitively-tracked vendor be tagged to a story", () => {
    const missing = COMPETITIVE_TARGETS.filter((t) => !(t.vendorId in TRACKED_VENDOR_NAMES)).map(
      (t) => `${t.vendorId} (${t.name})`,
    );
    expect(
      missing,
      `These vendors can never be attributed to a news story. Add them to ` +
        `TRACKED_VENDOR_NAMES in lib/sourcing/ai-news-manifest.ts, keyed by BARE ` +
        `spine id (not entity slug).`,
    ).toEqual([]);
  });

  it("has no tracked key outside the spine id-space", () => {
    // Catches defect 2 directly: a key that is not a known vendorId is almost
    // always an entity slug that was pasted in by mistake.
    const known = new Set(COMPETITIVE_TARGETS.map((t) => t.vendorId));
    const strays = Object.keys(TRACKED_VENDOR_NAMES).filter((id) => !known.has(id));
    expect(
      strays,
      `Not valid COMPETITIVE_TARGETS vendorIds. If one is an entity slug, ` +
        `resolve it with intelVendorId() first — see lib/intelligence/vendor-id.ts.`,
    ).toEqual([]);
  });

  it("maps each vendor to a distinct, non-empty display name", () => {
    // NAME_TO_ID is built by lowercasing these values, so a duplicate silently
    // makes one vendor unreachable — the later key wins and the earlier vendor
    // stops being taggable without any error.
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const [id, name] of Object.entries(TRACKED_VENDOR_NAMES)) {
      expect(name.trim(), `${id} has an empty display name`).not.toBe("");
      const key = name.toLowerCase();
      const prior = seen.get(key);
      if (prior) collisions.push(`"${name}" used by both ${prior} and ${id}`);
      else seen.set(key, id);
    }
    expect(collisions).toEqual([]);
  });
});
