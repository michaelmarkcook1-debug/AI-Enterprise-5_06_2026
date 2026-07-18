import { describe, it, expect } from "vitest";
import { assembleEvidenceBundle, retrievePoolEvidence } from "./retrieval";
import { bundleAllowlist, type IntentProfile } from "./types";
import type { FrontierComparison } from "../model-inventory/frontier";
import type { ComposedBenchmark } from "../peer/segment-benchmarks";
import type { PeerCompany } from "../peer/types";

const intent: IntentProfile = {
  vertical: "financial_services",
  sizeBand: "global_enterprise",
  region: "north_america",
  goal: "coding copilot",
  constraints: ["SOC2"],
};

const frontier: FrontierComparison = {
  columns: [
    { vendorId: "openai", vendorName: "OpenAI", present: true, modelName: "gpt-x", ratings: { intelligence: 55, coding: 58 }, overall: 55, overallRank: 2, sourceUrl: "https://artificialanalysis.ai/models", publishDate: "2026-07-02" },
    { vendorId: "anthropic", vendorName: "Anthropic", present: true, modelName: "claude-x", ratings: { intelligence: 60, coding: 56 }, overall: 60, overallRank: 1, sourceUrl: "https://artificialanalysis.ai/models", publishDate: "2026-07-02" },
  ],
  categoryLeaders: { intelligence: "anthropic", coding: "openai" },
  asOf: "2026-07-02",
  sourceUrl: "https://artificialanalysis.ai/models",
  source: "artificial_analysis",
  presentCount: 2,
};

const composedExact: ComposedBenchmark = {
  exact: { segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" }, stats: [], topUseCases: [], cohortMaturityAnchor: "scaling" as never, anchorRationale: "", compiledAt: "2026-07-04" },
  layers: [
    {
      scope: "segment",
      scopeLabel: "Your exact segment",
      stats: [
        { kind: "adoption_rate", headline: "33.9% of US Finance & Insurance firms use AI.", source: { title: "BTOS", publisher: "US Census Bureau", url: "https://www.census.gov/btos", surveyDate: "May 2026" }, segmentFitNote: "US-only; all sizes." },
      ],
    },
  ],
};

const composedAdjacent: ComposedBenchmark = {
  exact: null,
  layers: [
    {
      scope: "vertical",
      scopeLabel: "Your vertical",
      stats: [
        { kind: "adoption_rate", headline: "Finance sector adopts AI above the national rate.", source: { title: "BTOS", publisher: "US Census Bureau", url: "https://www.census.gov/btos-wp", surveyDate: "2026" }, segmentFitNote: "US-only." },
      ],
    },
  ],
};

const exemplarCited: PeerCompany = {
  id: "morgan-stanley",
  name: "Morgan Stanley",
  industry: "Financial services",
  segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
  signals: [
    { kind: "platform_integration", summary: "built OpenAI-based advisor tooling", citations: [{ url: "https://www.cnbc.com/ms", publisher: "CNBC" }] } as never,
  ],
};

const exemplarUncited: PeerCompany = {
  id: "acme-bank",
  name: "Acme Bank",
  industry: "Financial services",
  segment: { vertical: "financial_services", sizeBand: "global_enterprise", region: "north_america" },
  signals: [{ kind: "platform_integration", summary: "uses AI somewhere", citations: [] } as never],
};

describe("assembleEvidenceBundle — deterministic, honest, cited", () => {
  it("assembles model + public-peer layers, each item carrying a real sourceUrl", () => {
    const b = assembleEvidenceBundle(intent, frontier, composedExact, []);
    expect(b.items.some((i) => i.layer === "model")).toBe(true);
    expect(b.items.some((i) => i.layer === "peer_public")).toBe(true);
    expect(b.items.every((i) => /^https?:\/\//.test(i.sourceUrl))).toBe(true);
  });

  it("sets exactSegmentMatch=true only when an exact benchmark exists", () => {
    expect(assembleEvidenceBundle(intent, frontier, composedExact, []).coverage.exactSegmentMatch).toBe(true);
    expect(assembleEvidenceBundle(intent, frontier, composedAdjacent, []).coverage.exactSegmentMatch).toBe(false);
  });

  it("reports the nearest peer scope honestly for an adjacent-only match", () => {
    const b = assembleEvidenceBundle(intent, frontier, composedAdjacent, []);
    expect(b.coverage.nearestPeerScope).toBe("Your vertical");
  });

  it("only includes a NAMED adopter when it carries a real cited URL — never an unbacked name", () => {
    const b = assembleEvidenceBundle(intent, frontier, composedExact, [exemplarCited, exemplarUncited]);
    const named = b.items.filter((i) => i.scopeLabel === "Named disclosed adopter");
    expect(named.length).toBe(1);
    expect(named[0].headline).toMatch(/Morgan Stanley/);
    // disclosed count reflects only companies with a cited disclosure
    expect(b.coverage.disclosedAdopters).toBe(1);
  });

  it("poolContributors stays 0 with no pool items (AIE-07 not built) and rises with pool items", () => {
    expect(assembleEvidenceBundle(intent, frontier, composedExact, []).coverage.poolContributors).toBe(0);
    const withPool = assembleEvidenceBundle(intent, frontier, composedExact, [], [
      { layer: "peer_pool", scopeLabel: "Anonymised pool", headline: "12 peers report X", sourceUrl: "pool://agg/1" },
    ]);
    expect(withPool.coverage.poolContributors).toBe(1);
    expect(withPool.items.some((i) => i.layer === "peer_pool")).toBe(true);
  });

  it("hasModelData reflects whether the frontier comparison had present columns", () => {
    const empty: FrontierComparison = { ...frontier, columns: [], presentCount: 0, categoryLeaders: {}, sourceUrl: null, asOf: null };
    expect(assembleEvidenceBundle(intent, empty, composedExact, []).coverage.hasModelData).toBe(false);
  });

  it("surfaces the tracked vendors PRESENT in the frontier evidence, best-first — the grounded shortlist seed", () => {
    // These are the real vendorIds the finding rests on; the handoff can only ever
    // shortlist a vendor that was actually in the evidence (never scraped from prose).
    const b = assembleEvidenceBundle(intent, frontier, composedExact, []);
    expect(b.vendors).toEqual([
      { id: "anthropic", name: "Anthropic" }, // overallRank 1
      { id: "openai", name: "OpenAI" }, // overallRank 2
    ]);
  });

  it("carries no shortlist seed when the frontier evidence is empty (nothing to ground it)", () => {
    const empty: FrontierComparison = { ...frontier, columns: [], presentCount: 0, categoryLeaders: {}, sourceUrl: null, asOf: null };
    expect(assembleEvidenceBundle(intent, empty, composedExact, []).vendors).toEqual([]);
  });

  it("the allowlist is exactly the set of item sourceUrls (the synthesis gate's basis)", () => {
    const b = assembleEvidenceBundle(intent, frontier, composedExact, [exemplarCited]);
    const allow = bundleAllowlist(b);
    expect(allow.has("https://artificialanalysis.ai/models")).toBe(true);
    expect(allow.has("https://www.census.gov/btos")).toBe(true);
    expect(allow.has("https://www.cnbc.com/ms")).toBe(true);
  });
});

describe("retrievePoolEvidence — a pool-subsystem failure must NEVER crash the core engine", () => {
  it("swallows a rejection from getPoolAggregate and returns an empty array, not a throw", async () => {
    const failing = async () => {
      throw new Error("pool: no database configured");
    };
    await expect(retrievePoolEvidence(intent, failing)).resolves.toEqual([]);
  });

  it("still returns real evidence when the aggregate resolves normally", async () => {
    const ok = async () => null; // below the floor — the honest empty case
    await expect(retrievePoolEvidence(intent, ok)).resolves.toEqual([]);
  });
});
