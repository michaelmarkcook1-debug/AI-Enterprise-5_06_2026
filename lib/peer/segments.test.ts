import { describe, it, expect } from "vitest";
import {
  VERTICALS,
  SIZE_BANDS,
  REGIONS,
  segmentId,
  exemplarsForSegment,
  disclosedPlatformsForSegment,
  type Segment,
} from "./segments";
import { PEER_COMPANIES } from "./peer-adoption-data";
import {
  resolveBenchmark,
  composeBenchmark,
  SEGMENT_BENCHMARKS,
  GLOBAL_STATS,
  REGION_STATS,
  VERTICAL_STATS,
  SIZE_STATS,
  type SegmentStat,
} from "./segment-benchmarks";
import { youVsCohort } from "./you-vs-cohort";

const FS_NA: Segment = { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" };

describe("segment vocabulary + exemplar tagging", () => {
  it("every exemplar company carries a VALID segment tag", () => {
    const verticals = new Set<string>(VERTICALS.map((v) => v.id));
    const sizes = new Set<string>(SIZE_BANDS.map((s) => s.id));
    const regions = new Set<string>(REGIONS.map((r) => r.id));
    for (const c of PEER_COMPANIES) {
      expect(verticals.has(c.segment.vertical), `${c.id} vertical`).toBe(true);
      expect(sizes.has(c.segment.sizeBand), `${c.id} sizeBand`).toBe(true);
      expect(regions.has(c.segment.region), `${c.id} region`).toBe(true);
    }
  });

  it("the fs × global-enterprise × NA cohort resolves exactly its tagged exemplars", () => {
    const ex = exemplarsForSegment(FS_NA);
    const tagged = PEER_COMPANIES.filter(
      (c) =>
        c.segment.vertical === FS_NA.vertical &&
        c.segment.sizeBand === FS_NA.sizeBand &&
        c.segment.region === FS_NA.region,
    );
    expect(ex.map((c) => c.id).sort()).toEqual(tagged.map((c) => c.id).sort());
    // Multi-segment dataset now: FS_NA is a strict subset of all companies.
    expect(ex.length).toBeLessThan(PEER_COMPANIES.length);
  });

  it("an unseeded segment has NO exemplars and NO exact benchmark — but still composes cited layers", () => {
    const empty: Segment = { vertical: "education", sizeBand: "smb", region: "latam" };
    expect(exemplarsForSegment(empty)).toEqual([]);
    expect(resolveBenchmark(empty)).toBeNull();
    const composed = composeBenchmark(empty);
    expect(composed.exact).toBeNull();
    // education has a BTOS vertical layer; latam/smb have none; global always applies.
    expect(composed.layers.map((l) => l.scope)).toEqual(["vertical", "global"]);
  });

  it("EVERY vertical × region composes at least the global baseline — no dead segments", () => {
    for (const v of VERTICALS) {
      for (const r of REGIONS) {
        const composed = composeBenchmark({ vertical: v.id, sizeBand: "global_enterprise", region: r.id });
        expect(composed.layers.length, `${v.id}×${r.id}`).toBeGreaterThan(0);
        const last = composed.layers[composed.layers.length - 1];
        expect(last.scope, `${v.id}×${r.id} ends on the global baseline`).toBe("global");
      }
    }
  });

  it("layers compose most-specific first for the seeded segment", () => {
    const composed = composeBenchmark(FS_NA);
    expect(composed.exact).not.toBeNull();
    expect(composed.layers.map((l) => l.scope)).toEqual(["segment", "vertical", "size", "region", "global"]);
  });

  it("disclosed platforms are derived from DISCLOSED exemplar cells only, with counts", () => {
    const platforms = disclosedPlatformsForSegment(FS_NA);
    expect(platforms.length).toBeGreaterThan(0);
    // Every vendor must trace back to a disclosed platform_integration cell —
    // scoped to THIS segment's exemplars (the dataset is now multi-segment).
    const cohort = exemplarsForSegment(FS_NA);
    for (const p of platforms) {
      const adopters = cohort.filter((c) => {
        const s = c.signals.find((x) => x.kind === "platform_integration");
        return s?.status === "disclosed" && (s.vendorIds ?? []).includes(p.vendorId);
      });
      expect(adopters.length, p.vendorId).toBe(p.adopters);
    }
    // Sorted by adopter count, descending.
    for (let i = 1; i < platforms.length; i++) {
      expect(platforms[i - 1].adopters).toBeGreaterThanOrEqual(platforms[i].adopters);
    }
  });
});

describe("segment benchmarks honesty", () => {
  const assertStat = (s: SegmentStat, ctx: string) => {
    expect(s.source.url, ctx).toMatch(/^https:\/\//);
    expect(s.source.publisher.length, ctx).toBeGreaterThan(0);
    expect(s.source.surveyDate.length, ctx).toBeGreaterThan(0);
    expect(s.segmentFitNote.length, `${ctx} needs an honest fit note`).toBeGreaterThan(5);
    expect(s.headline.length, ctx).toBeGreaterThan(20);
  };

  it("every seeded exact benchmark stat is cited and carries a segment-fit note", () => {
    for (const [key, b] of Object.entries(SEGMENT_BENCHMARKS)) {
      expect(segmentId(b.segment), key).toBe(key);
      expect(b.stats.length, `${key} must not be seeded empty`).toBeGreaterThan(0);
      for (const s of b.stats) assertStat(s, `${key}/${s.kind}`);
      for (const u of b.topUseCases) {
        expect(u.source.url).toMatch(/^https:\/\//);
      }
      expect(b.anchorRationale.length).toBeGreaterThan(10);
    }
  });

  it("every LAYER stat (vertical / size / region / global) is cited with a fit note", () => {
    for (const s of GLOBAL_STATS) assertStat(s, "global");
    for (const [k, stats] of Object.entries(VERTICAL_STATS)) for (const s of stats ?? []) assertStat(s, `vertical/${k}`);
    for (const [k, stats] of Object.entries(SIZE_STATS)) for (const s of stats ?? []) assertStat(s, `size/${k}`);
    for (const [k, stats] of Object.entries(REGION_STATS)) for (const s of stats ?? []) assertStat(s, `region/${k}`);
  });

  it("layer keys are valid vocabulary ids", () => {
    const verticals = new Set<string>(VERTICALS.map((v) => v.id));
    const sizes = new Set<string>(SIZE_BANDS.map((s) => s.id));
    const regions = new Set<string>(REGIONS.map((r) => r.id));
    for (const k of Object.keys(VERTICAL_STATS)) expect(verticals.has(k), k).toBe(true);
    for (const k of Object.keys(SIZE_STATS)) expect(sizes.has(k), k).toBe(true);
    for (const k of Object.keys(REGION_STATS)) expect(regions.has(k), k).toBe(true);
  });
});

describe("youVsCohort", () => {
  const bench = {
    segment: FS_NA,
    stats: [],
    topUseCases: [],
    cohortMaturityAnchor: "developing" as const,
    anchorRationale: "test anchor",
    compiledAt: "2026-07-04",
  };

  it("is deterministic and directional with the honesty caveat", () => {
    expect(youVsCohort("advanced", bench)?.position).toBe("ahead");
    expect(youVsCohort("developing", bench)?.position).toBe("at");
    expect(youVsCohort("early", bench)?.position).toBe("behind");
    expect(youVsCohort("early", bench)?.gap).toBe(-1);
    expect(youVsCohort("advanced", bench)?.caveat).toMatch(/Directional comparison/);
  });
});
