// External competitive-intel ingest — validation is the fabrication firewall
// for the Routine channel; these tests pin every rejection rule.
import { describe, it, expect } from "vitest";
import {
  validateFinding,
  validateProposal,
  newsItemId,
  deriveExternalImpact,
  type ExternalFinding,
  type ExternalProposal,
} from "./competitive-intel";

const VENDORS = new Set(["anthropic", "openai", "microsoft"]);

const finding = (over: Partial<ExternalFinding> = {}): ExternalFinding => ({
  vendorId: "anthropic",
  title: "Anthropic signs enterprise deal with a major bank",
  summary: "A multi-year enterprise agreement covering Claude deployment across the bank's advisory workflows.",
  sourceName: "Reuters",
  sourceUrl: "https://www.reuters.com/technology/some-real-article",
  publishedAt: "2026-07-01",
  whyItMatters: "Signals regulated-industry adoption depth beyond pilots for Anthropic.",
  ...over,
});

const proposal = (over: Partial<ExternalProposal> = {}): ExternalProposal => ({
  vendorId: "anthropic",
  domain: "governance_compliance",
  subfactor: "certifications",
  excerpt: "The bank's press release states the deployment completed a joint model-risk-management review under SR 11-7 guidance before production rollout.",
  sourceUrl: "https://www.example-bank.com/press/ai-deployment",
  proposedGrade: "E2",
  proposedRawScore: 3,
  ...over,
});

describe("validateFinding — news channel", () => {
  it("accepts a real, cited finding", () => {
    expect(validateFinding(finding(), VENDORS)).toBeNull();
  });
  it("rejects unknown vendors — vendors are never invented", () => {
    expect(validateFinding(finding({ vendorId: "made-up-corp" }), VENDORS)).toMatch(/unknown vendorId/);
  });
  it("rejects http (non-https) and garbage URLs", () => {
    expect(validateFinding(finding({ sourceUrl: "http://reuters.com/x" }), VENDORS)).toMatch(/https/);
    expect(validateFinding(finding({ sourceUrl: "not a url" }), VENDORS)).toMatch(/https/);
  });
  it("rejects placeholder/seed content", () => {
    expect(validateFinding(finding({ sourceName: "[MOCK] feed" }), VENDORS)).not.toBeNull();
    expect(validateFinding(finding({ title: "placeholder title for testing here" }), VENDORS)).not.toBeNull();
  });
  it("rejects future publishedAt and invalid dates", () => {
    expect(validateFinding(finding({ publishedAt: "2099-01-01" }), VENDORS)).toMatch(/future|invalid/);
    expect(validateFinding(finding({ publishedAt: "not-a-date" }), VENDORS)).toMatch(/invalid/);
  });
  it("rejects thin content (title/summary/whyItMatters minimums)", () => {
    expect(validateFinding(finding({ title: "short" }), VENDORS)).toMatch(/title/);
    expect(validateFinding(finding({ summary: "too short" }), VENDORS)).toMatch(/summary/);
    expect(validateFinding(finding({ whyItMatters: "meh" }), VENDORS)).toMatch(/whyItMatters/);
  });
  it("rejects invalid sentiment", () => {
    expect(validateFinding(finding({ sentiment: "bullish" as never }), VENDORS)).toMatch(/sentiment/);
  });
});

describe("validateProposal — model channel (triage queue)", () => {
  it("accepts a real, cited proposal", () => {
    expect(validateProposal(proposal(), VENDORS)).toBeNull();
  });
  it("hard-caps external grades at E3 — E4/E5 need analyst review", () => {
    expect(validateProposal(proposal({ proposedGrade: "E4" as never }), VENDORS)).toMatch(/capped at E3/);
    expect(validateProposal(proposal({ proposedGrade: "E5" as never }), VENDORS)).toMatch(/capped at E3/);
  });
  it("rejects non-proposable domains (model_quality is synthesized)", () => {
    expect(validateProposal(proposal({ domain: "model_quality" }), VENDORS)).toMatch(/not a proposable/);
    expect(validateProposal(proposal({ domain: "vibes" }), VENDORS)).toMatch(/not a proposable/);
  });
  it("requires a substantive cited excerpt (min 40 chars)", () => {
    expect(validateProposal(proposal({ excerpt: "they are good at compliance" }), VENDORS)).toMatch(/excerpt/);
  });
  it("rejects out-of-range raw scores", () => {
    expect(validateProposal(proposal({ proposedRawScore: 6 }), VENDORS)).toMatch(/0-5/);
    expect(validateProposal(proposal({ proposedRawScore: -1 }), VENDORS)).toMatch(/0-5/);
  });
  it("rejects unknown vendors", () => {
    expect(validateProposal(proposal({ vendorId: "nope" }), VENDORS)).toMatch(/unknown vendorId/);
  });
});

describe("deriveExternalImpact — importance so real intel reaches Breaking", () => {
  it("a routine-supplied impactScore always wins", () => {
    expect(deriveExternalImpact(finding({ impactScore: 12 }))).toBe(12);
    expect(deriveExternalImpact(finding({ impactScore: 99 }))).toBe(99);
  });
  it("every cited item clears the Breaking floor (>=50) — no more silent 40 default", () => {
    // A plain item with none of the boost keywords still ranks as newsworthy.
    expect(deriveExternalImpact(finding({
      title: "Cohere opens a new London office",
      summary: "Cohere expands its European presence with a new central-London site.",
      whyItMatters: "Signals continued European go-to-market investment by Cohere.",
    }))).toBeGreaterThanOrEqual(50);
  });
  it("scores major market events higher than routine press", () => {
    const funding = deriveExternalImpact(finding({ title: "Anthropic raises $65B Series H", category: "funding" }));
    const launch = deriveExternalImpact(finding({ title: "OpenAI launches GPT-5.5", category: "model_release" }));
    const press = deriveExternalImpact(finding({
      title: "Mistral publishes a research blog post",
      summary: "A short technical write-up on inference latency improvements in the API.",
      whyItMatters: "Minor technical note, limited enterprise decision relevance for Mistral.",
      category: "press_coverage",
    }));
    expect(funding).toBeGreaterThan(press);
    expect(launch).toBeGreaterThan(press);
    expect(funding).toBeGreaterThanOrEqual(80); // billion-dollar event
  });
});

describe("newsItemId — dedupes against the in-app competitive monitor", () => {
  it("is stable for the same (vendor, url, day) and matches the monitor's scheme", () => {
    const a = newsItemId("anthropic", "https://x.com/a", "2026-07-01");
    const b = newsItemId("anthropic", "https://x.com/a", "2026-07-01");
    expect(a).toBe(b);
    expect(a).toMatch(/^compintel_[0-9a-f]{24}$/);
    expect(newsItemId("openai", "https://x.com/a", "2026-07-01")).not.toBe(a);
  });
});
