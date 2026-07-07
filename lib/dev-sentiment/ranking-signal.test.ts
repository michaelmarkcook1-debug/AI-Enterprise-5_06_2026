import { describe, it, expect } from "vitest";
import { synthesizeDevSentimentDomain } from "./ranking-signal";
import { resolveDomainWeights, DEV_SENTIMENT_WEIGHT, categoryActivatesDevSentiment } from "../assessment/category-weights";
import { DEV_SENTIMENT_IN_RANKING } from "../availability";

describe("synthesizeDevSentimentDomain", () => {
  it("maps a strong/positive vendor to a scored dev_sentiment domain (market_strength pillar)", () => {
    const d = synthesizeDevSentimentDomain("anthropic");
    expect(d).not.toBeNull();
    expect(d!.domain).toBe("dev_sentiment");
    expect(d!.pillar).toBe("market_strength");
    expect(d!.state).toBe("scored");
    if (d!.state === "scored") {
      expect(d!.score).toBe(5.0); // positive → 5.0 (fixed table, never tuned)
      expect(d!.confidence).toBe(90); // strong tier
    }
  });

  it("moderate tier → lower confidence (engine-native discount), still scored", () => {
    // Meta: GitHub + Hugging Face clear their floors (2 counting sources) but
    // HN doesn't → moderate, not strong.
    const d = synthesizeDevSentimentDomain("meta");
    expect(d!.state).toBe("scored");
    if (d!.state === "scored") {
      expect(d!.confidence).toBe(60);
      expect(d!.lowConfidence).toBe(true);
    }
  });

  it("real Hugging Face evidence upgrades an already-rated vendor's tier (deepseek/alibaba: moderate → strong)", () => {
    // Not a coverage-gate flip like Meta — these were already "rated"; adding a
    // real 3rd independent source raises confidence, same engine-native rule
    // every other domain follows.
    const deepseek = synthesizeDevSentimentDomain("deepseek");
    const alibaba = synthesizeDevSentimentDomain("alibaba");
    expect(deepseek!.state).toBe("scored");
    expect(alibaba!.state).toBe("scored");
    if (deepseek!.state === "scored") {
      expect(deepseek!.confidence).toBe(90);
      expect(deepseek!.lowConfidence).toBe(false);
    }
    if (alibaba!.state === "scored") {
      expect(alibaba!.confidence).toBe(90);
      expect(alibaba!.lowConfidence).toBe(false);
    }
  });

  it("label reflects the ACTUAL counting sources per vendor, not a static full-list claim", () => {
    // Meta: GitHub + Hugging Face counted; HN did NOT (below floor) — the label
    // must not claim HN as if it drove the score.
    const meta = synthesizeDevSentimentDomain("meta");
    expect(meta!.state).toBe("scored");
    if (meta!.state === "scored") {
      expect(meta!.label).toBe("Developer Sentiment (GitHub · Hugging Face)");
      expect(meta!.label).not.toMatch(/HN/);
    }
    // Anthropic: three original sources, no Hugging Face org → unaffected.
    const anthropic = synthesizeDevSentimentDomain("anthropic");
    if (anthropic!.state === "scored") {
      expect(anthropic!.label).toBe("Developer Sentiment (HN · GitHub · Stack Overflow)");
    }
    // DeepSeek: now GitHub + HN + Hugging Face (3 sources, upgraded to strong).
    const deepseek = synthesizeDevSentimentDomain("deepseek");
    if (deepseek!.state === "scored") {
      expect(deepseek!.label).toBe("Developer Sentiment (HN · GitHub · Hugging Face)");
    }
  });

  it("insufficient vendors → null (coverage-discounted, never fabricated)", () => {
    // Mistral: HN below floor + one real Hugging Face source alone → still
    // only 1 counting source (need ≥2) → stays insufficient even with real
    // HF adoption evidence — an honest, evidenced gap, not fabricated relief.
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
