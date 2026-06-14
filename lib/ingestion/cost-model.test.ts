import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, estimateIngestionCost, PRICES } from "./cost-model";

describe("ingestion cost model", () => {
  it("computes a hand-verifiable total for the default 42-vendor run", () => {
    const e = estimateIngestionCost();
    // URL finding: 42×2000 in, 42×300 out on Sonnet = 0.084M×$3 + 0.0126M×$15 = 0.252+0.189 = $0.441
    // Extraction: 252 docs ×8000 in, ×1200 out on Haiku = 2.016M×$1 + 0.3024M×$5 = 2.016+1.512 = $3.528
    // Enrichment: 42×6000 in, 42×1500 out on Sonnet = 0.252M×$3 + 0.063M×$15 = 0.756+0.945 = $1.701
    // Narrative: 42×12000 in, 42×2500 out on Opus ×0.5 = (0.504M×$5 + 0.105M×$25)×0.5 = (2.52+2.625)×0.5 = $2.5725
    // Total = 0.441+3.528+1.701+2.5725 = 8.2425 → 8.24
    expect(e.totalUsd).toBe(8.24);
    expect(e.stages).toHaveLength(4);
  });

  it("scales linearly with vendor count and zeroes out at zero vendors", () => {
    const zero = estimateIngestionCost({ ...DEFAULT_ASSUMPTIONS, vendorCount: 0 });
    expect(zero.totalUsd).toBe(0);
    const double = estimateIngestionCost({ ...DEFAULT_ASSUMPTIONS, vendorCount: 84 });
    expect(double.totalUsd).toBeCloseTo(estimateIngestionCost().totalUsd * 2, 1);
  });

  it("batch toggle halves only the narrative stage", () => {
    const noBatch = estimateIngestionCost({ ...DEFAULT_ASSUMPTIONS, narrative: { ...DEFAULT_ASSUMPTIONS.narrative, useBatch: false } });
    const withBatch = estimateIngestionCost();
    const narrNo = noBatch.stages[3].costUsd;
    const narrYes = withBatch.stages[3].costUsd;
    expect(narrYes).toBeCloseTo(narrNo / 2, 6);
  });

  it("encodes the verified June 2026 price card", () => {
    expect(PRICES.haiku.inputPerMTok).toBe(1);
    expect(PRICES.sonnet.outputPerMTok).toBe(15);
    expect(PRICES.opus.outputPerMTok).toBe(25);
  });
});
