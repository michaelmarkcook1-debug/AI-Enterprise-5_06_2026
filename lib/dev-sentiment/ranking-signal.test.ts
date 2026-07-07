import { describe, it, expect } from "vitest";
import { synthesizeDevSentimentDomain } from "./ranking-signal";
import { resolveDomainWeights, DEV_SENTIMENT_WEIGHT, categoryActivatesDevSentiment } from "../assessment/category-weights";
import { DEV_SENTIMENT_IN_RANKING } from "../availability";

describe("synthesizeDevSentimentDomain", () => {
  it("maps a strong/positive vendor to a scored dev_sentiment domain (business_fit pillar)", () => {
    const d = synthesizeDevSentimentDomain("anthropic");
    expect(d).not.toBeNull();
    expect(d!.domain).toBe("dev_sentiment");
    // 2026-07-08 market-strength-split: dev_sentiment no longer feeds
    // Market Strength (that's now market_position — real adoption evidence).
    // Score/weight/composite contribution are unchanged; only the pillar
    // rollup used for display moves.
    expect(d!.pillar).toBe("business_fit");
    expect(d!.state).toBe("scored");
    if (d!.state === "scored") {
      expect(d!.score).toBe(5.0); // positive → 5.0 (fixed table, never tuned)
      expect(d!.confidence).toBe(90); // strong tier
    }
  });

  it("moderate tier → lower confidence (engine-native discount), still scored", () => {
    const d = synthesizeDevSentimentDomain("deepseek");
    expect(d!.state).toBe("scored");
    if (d!.state === "scored") {
      expect(d!.confidence).toBe(60);
      expect(d!.lowConfidence).toBe(true);
    }
  });

  it("insufficient vendors → null (coverage-discounted, never fabricated)", () => {
    expect(synthesizeDevSentimentDomain("meta")).toBeNull();
    expect(synthesizeDevSentimentDomain("mistral")).toBeNull();
  });

  it("out-of-scope vendors → null (never a dev_sentiment domain)", () => {
    expect(synthesizeDevSentimentDomain("salesforce")).toBeNull();
    expect(synthesizeDevSentimentDomain("snowflake")).toBeNull();
  });
});

describe("resolveDomainWeights + the DEV_SENTIMENT_IN_RANKING flag", () => {
  it("weight is applied to coding categories ONLY when the flag is on", () => {
    const frontier = resolveDomainWeights("frontier_model_api");
    const coding = resolveDomainWeights("developer_coding_agent");
    const enterprise = resolveDomainWeights("enterprise_assistant");
    if (DEV_SENTIMENT_IN_RANKING) {
      expect(frontier.dev_sentiment).toBe(DEV_SENTIMENT_WEIGHT);
      expect(coding.dev_sentiment).toBe(DEV_SENTIMENT_WEIGHT);
    } else {
      expect(frontier.dev_sentiment ?? 0).toBe(0);
      expect(coding.dev_sentiment ?? 0).toBe(0);
    }
    // NEVER on a non-coding category, flag or no flag (scope lock).
    expect(enterprise.dev_sentiment ?? 0).toBe(0);
    expect(categoryActivatesDevSentiment("enterprise_assistant")).toBe(false);
    expect(categoryActivatesDevSentiment("rag_enterprise_search")).toBe(false);
  });

  it("the fixed weight is 0.25 (documented, owner-set, not tuned per vendor)", () => {
    expect(DEV_SENTIMENT_WEIGHT).toBe(0.25);
  });
});
