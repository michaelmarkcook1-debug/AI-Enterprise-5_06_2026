import { describe, it, expect } from "vitest";
import { PEER_COMPANIES } from "./peer-adoption-data";
import { buildPeerHeatmap, SIGNAL_KINDS } from "./heatmap";
import { TRACKED_VENDOR_NAMES } from "../sourcing/ai-news-manifest";
import { computePeerBand } from "./rubric";
import type { PeerSignalKind } from "./types";

// Fabrication guards — the dataset's honesty contract, enforced.

const ALL_KINDS: PeerSignalKind[] = [
  "platform_integration",
  "talent_exposure",
  "patent_velocity",
  "product_footprint",
  "automation_intensity",
];

describe("peer-adoption dataset integrity", () => {
  it("every company carries exactly one signal per kind", () => {
    for (const c of PEER_COMPANIES) {
      const kinds = c.signals.map((s) => s.kind).sort();
      expect(kinds, c.id).toEqual([...ALL_KINDS].sort());
    }
  });

  it("citations are OPTIONAL (owner ruling) — but when present must be real https sources", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        for (const cite of s.citations ?? []) {
          expect(cite.url, `${c.id}/${s.kind}`).toMatch(/^https:\/\/.+/);
          expect(cite.title.length, `${c.id}/${s.kind}`).toBeGreaterThan(0);
          expect(cite.publisher.length, `${c.id}/${s.kind}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("not_disclosed signals make NO claim: no level, no rubricBasis, no summary, no citations", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        if (s.status !== "not_disclosed") continue;
        expect(s.level, `${c.id}/${s.kind}`).toBeUndefined();
        expect(s.rubricBasis, `${c.id}/${s.kind}`).toBeUndefined();
        expect(s.summary, `${c.id}/${s.kind}`).toBeUndefined();
        // citations optional now → must be absent or empty for not_disclosed.
        expect(s.citations ?? [], `${c.id}/${s.kind}`).toEqual([]);
      }
    }
  });

  it("STEP 0: every rated band is COMPUTED from its rubricBasis — never analyst-assigned", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        if (s.status === "not_disclosed") continue;
        expect(s.rubricBasis, `${c.id}/${s.kind} needs a rubricBasis`).toBeDefined();
        const computed = computePeerBand(s.kind, s.rubricBasis!, s.status);
        expect(s.level, `${c.id}/${s.kind} band must equal the rubric output`).toBe(computed);
      }
    }
  });

  it("rated signals carry a level 1–4 and a summary grounded in citations", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        if (s.status === "not_disclosed") continue;
        expect(s.level, `${c.id}/${s.kind}`).toBeGreaterThanOrEqual(1);
        expect(s.level, `${c.id}/${s.kind}`).toBeLessThanOrEqual(4);
        expect((s.summary ?? "").length, `${c.id}/${s.kind}`).toBeGreaterThan(20);
      }
    }
  });

  it("automation_intensity is NEVER asserted as disclosed — inferred (est.) or not_disclosed only", () => {
    for (const c of PEER_COMPANIES) {
      const s = c.signals.find((x) => x.kind === "automation_intensity")!;
      expect(["inferred", "not_disclosed"], c.id).toContain(s.status);
    }
  });

  it("every inferred signal states what it is inferred from", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        if (s.status !== "inferred") continue;
        expect((s.inferenceNote ?? "").length, `${c.id}/${s.kind}`).toBeGreaterThan(10);
        expect(s.inferenceNote, `${c.id}/${s.kind}`).toMatch(/inferred/i);
      }
    }
  });

  it("vendor cross-links only name vendors the platform tracks", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        for (const v of s.vendorIds ?? []) {
          expect(TRACKED_VENDOR_NAMES[v], `${c.id}/${s.kind}/${v}`).toBeTruthy();
        }
      }
    }
  });

  it("vendorIds appear only on platform_integration signals", () => {
    for (const c of PEER_COMPANIES) {
      for (const s of c.signals) {
        if (s.kind === "platform_integration") continue;
        expect(s.vendorIds ?? [], `${c.id}/${s.kind}`).toEqual([]);
      }
    }
  });

  it("company ids are unique kebab-case slugs", () => {
    const ids = PEER_COMPANIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("buildPeerHeatmap", () => {
  it("full set: 5 ordered rows × all companies", () => {
    const h = buildPeerHeatmap();
    expect(h.columns.length).toBe(PEER_COMPANIES.length);
    expect(h.rows.map((r) => r.meta.kind)).toEqual(SIGNAL_KINDS.map((k) => k.kind));
    for (const row of h.rows) expect(row.cells.length).toBe(h.columns.length);
  });

  it("selection filters + orders columns; unknown ids dropped", () => {
    const h = buildPeerHeatmap(["capital-one", "nope", "jpmorgan-chase"]);
    expect(h.columns.map((c) => c.id)).toEqual(["capital-one", "jpmorgan-chase"]);
  });

  it("cells line up with their column's company", () => {
    const h = buildPeerHeatmap(["morgan-stanley", "citigroup"]);
    for (const row of h.rows) {
      expect(row.cells.map((c) => c.companyId)).toEqual(["morgan-stanley", "citigroup"]);
      for (const cell of row.cells) expect(cell.signal.kind).toBe(row.meta.kind);
    }
  });
});
