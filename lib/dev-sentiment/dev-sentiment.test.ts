import { describe, it, expect } from "vitest";
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
    // Mistral: single ageing HN source (~1,200 pts) below the 1,500 floor → insufficient.
    const mistral = aggregateDevSentiment("mistral")!;
    expect(mistral.state).toBe("insufficient_evidence");
    expect(mistral.countingSources.length).toBeLessThan(2);
  });

  it("one large source alone is still 'insufficient' (diversity required)", () => {
    // Meta: HN below floor + one GitHub source → 1 counting source → insufficient.
    const meta = aggregateDevSentiment("meta")!;
    expect(meta.state).toBe("insufficient_evidence");
    expect(meta.reading).toBeUndefined();
  });

  it("three floor-clearing sources → strong; two → moderate", () => {
    expect(aggregateDevSentiment("anthropic")!.tier).toBe("strong");
    expect(aggregateDevSentiment("openai")!.tier).toBe("strong");
    expect(aggregateDevSentiment("google")!.tier).toBe("strong");
    expect(aggregateDevSentiment("deepseek")!.tier).toBe("moderate");
    expect(aggregateDevSentiment("alibaba")!.tier).toBe("moderate");
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
