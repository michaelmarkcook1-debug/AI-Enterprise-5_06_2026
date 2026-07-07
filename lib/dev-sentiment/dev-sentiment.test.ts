import { describe, it, expect } from "vitest";
import { redditConnector } from "../connectors/reddit";
import { huggingFaceConnector } from "../connectors/huggingface";
import { CONNECTORS } from "../connectors/registry";
import { DEV_SENTIMENT_DATA } from "./data";
import { aggregateDevSentiment, aggregateAllDevSentiment } from "./aggregate";
import { isDevSentimentVendor, isDevSentimentCategory, DEV_SENTIMENT_VENDORS } from "./scope";
import { TRACKED_VENDOR_NAMES } from "../sourcing/ai-news-manifest";

describe("dev-sentiment dataset integrity", () => {
  it("every source signal has ≥1 real https citation and a numeric weight", () => {
    for (const r of DEV_SENTIMENT_DATA) {
      expect(r.sources.length, r.vendorId).toBeGreaterThan(0);
      for (const s of r.sources) {
        expect(s.citations.length, `${r.vendorId}/${s.source}`).toBeGreaterThan(0);
        for (const c of s.citations) expect(c.url).toMatch(/^https:\/\//);
        expect(typeof s.signalWeight, `${r.vendorId}/${s.source}`).toBe("number");
      }
    }
  });

  it("HN sources are labelled as ENGAGEMENT, never as sentiment", () => {
    for (const r of DEV_SENTIMENT_DATA) {
      const hn = r.sources.find((s) => s.source === "hackernews");
      if (hn) expect(hn.measures, r.vendorId).toBe("engagement");
    }
  });

  it("every dataset vendor is a real, in-scope coding vendor", () => {
    for (const r of DEV_SENTIMENT_DATA) {
      expect(DEV_SENTIMENT_VENDORS.has(r.vendorId), r.vendorId).toBe(true);
      expect(TRACKED_VENDOR_NAMES[r.vendorId], r.vendorId).toBeTruthy();
    }
  });

  it("top HN threads link to real hn item urls", () => {
    for (const r of DEV_SENTIMENT_DATA) {
      for (const s of r.sources) {
        for (const t of s.topThreads ?? []) {
          expect(t.url).toMatch(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/);
          expect(t.points).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("Reddit source (wired, gated on credentials — never fabricated)", () => {
  it("is registered as a connector and reports not_configured without creds", () => {
    expect(CONNECTORS.reddit).toBeTruthy();
    const h = redditConnector.health();
    // In test env (no REDDIT_CLIENT_ID/SECRET) it must be honest not_configured.
    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
      expect(h.status).toBe("not_configured");
      expect(h.configured).toBe(false);
    }
    expect(h.envVars).toContain("REDDIT_CLIENT_ID");
  });

  it("fetch returns nothing (no fabricated rows) when unconfigured", async () => {
    if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) return;
    const r = await redditConnector.fetch({ subreddit: "LocalLLaMA", q: "claude" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe("not_configured");
    expect(r.records).toEqual([]);
  });
});

describe("Hugging Face source (real open-model adoption, no credentials required)", () => {
  it("is registered as a connector and reports configured/ok (public API, no key needed)", () => {
    expect(CONNECTORS.huggingface).toBeTruthy();
    const h = huggingFaceConnector.health();
    expect(h.configured).toBe(true);
    expect(h.status).toBe("ok");
    expect(h.requiresKey).toBe(false);
  });

  it("every huggingface DevSourceSignal cites the real https org URL and reports likes as signalWeight", () => {
    for (const r of DEV_SENTIMENT_DATA) {
      const hf = r.sources.find((s) => s.source === "huggingface");
      if (!hf) continue;
      expect(hf.measures, r.vendorId).toBe("adoption");
      expect(hf.citations.length, r.vendorId).toBeGreaterThan(0);
      for (const c of hf.citations) expect(c.url).toMatch(/^https:\/\/huggingface\.co\//);
      expect(hf.signalWeight, r.vendorId).toBeGreaterThan(0);
    }
  });

  it("closed-weight vendors never carry a fabricated huggingface entry", () => {
    // Anthropic, OpenAI and Google are all in scope, but only vendors that
    // genuinely publish open weights on Hugging Face may have this source.
    const anthropic = DEV_SENTIMENT_DATA.find((r) => r.vendorId === "anthropic")!;
    expect(anthropic.sources.find((s) => s.source === "huggingface")).toBeUndefined();
  });
});

describe("scope is a hard rule", () => {
  it("out-of-scope vendors return null (never render the signal)", () => {
    expect(aggregateDevSentiment("salesforce")).toBeNull();
    expect(aggregateDevSentiment("servicenow")).toBeNull();
    expect(aggregateDevSentiment("snowflake")).toBeNull();
  });

  it("scope predicates: coding categories only", () => {
    expect(isDevSentimentCategory("developer_coding_agent")).toBe(true);
    expect(isDevSentimentCategory("frontier_model_api")).toBe(true);
    expect(isDevSentimentCategory("rag_enterprise_search")).toBe(false);
    expect(isDevSentimentCategory("crm_customer_ai")).toBe(false);
    expect(isDevSentimentVendor("anthropic")).toBe(true);
    expect(isDevSentimentVendor("vendor_anthropic")).toBe(true);
    expect(isDevSentimentVendor("salesforce")).toBe(false);
  });
});

describe("anti-gaming + coverage gates", () => {
  it("a source below its volume floor does not count toward diversity", () => {
    // Mistral: single ageing HN source (~1,200 pts, below the 1,500 floor) +
    // one real Hugging Face source (clears its floor) → still only 1 counting
    // source → insufficient. Real HF adoption alone can't manufacture a 2nd
    // independent source for THIS vendor — an honest, evidenced gap.
    const mistral = aggregateDevSentiment("mistral")!;
    expect(mistral.state).toBe("insufficient_evidence");
    expect(mistral.countingSources.length).toBeLessThan(2);
    expect(mistral.countingSources).toContain("huggingface");
  });

  it("Meta: real Hugging Face adoption (Llama family) closes the coverage gap GitHub alone couldn't", () => {
    // HN stays below floor (665 < 1,500); GitHub (16,300★) + Hugging Face
    // (56,053 likes, well above the 5,000 floor) → 2 counting sources → rated.
    const meta = aggregateDevSentiment("meta")!;
    expect(meta.state).toBe("rated");
    expect(meta.countingSources).toContain("github");
    expect(meta.countingSources).toContain("huggingface");
    expect(meta.countingSources).not.toContain("hackernews");
    expect(meta.reading).toBeTruthy();
    expect(meta.tier).toBe("moderate"); // 2 counting sources, not 3
  });

  it("four floor-clearing sources (openai/google) or three (deepseek/alibaba) → strong; Anthropic (no HF org) stays at its original three → strong", () => {
    expect(aggregateDevSentiment("anthropic")!.tier).toBe("strong");
    expect(aggregateDevSentiment("openai")!.tier).toBe("strong");
    expect(aggregateDevSentiment("google")!.tier).toBe("strong");
    // DeepSeek + Alibaba upgrade from moderate (2 sources) to strong (3) now
    // that a real, evidenced Hugging Face signal is included — not tuned, the
    // same uniform HF methodology applied to every open-weight vendor.
    expect(aggregateDevSentiment("deepseek")!.tier).toBe("strong");
    expect(aggregateDevSentiment("alibaba")!.tier).toBe("strong");
  });

  it("Anthropic has no Hugging Face org (closed-weight vendor) — honestly omitted, never a fabricated zero", () => {
    const anthropic = aggregateDevSentiment("anthropic")!;
    const hf = anthropic.record.sources.find((s) => s.source === "huggingface");
    expect(hf).toBeUndefined();
  });

  it("a rated vendor always carries a reading; an insufficient one never does", () => {
    for (const a of aggregateAllDevSentiment()) {
      if (a.state === "rated") {
        expect(a.reading, a.vendorId).toBeTruthy();
        expect(a.tier, a.vendorId).toBeTruthy();
      } else {
        expect(a.reading, a.vendorId).toBeUndefined();
        expect(a.coverageNote).toMatch(/[Ii]nsufficient/);
      }
    }
  });
});
