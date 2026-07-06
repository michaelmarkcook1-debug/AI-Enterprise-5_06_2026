import { describe, it, expect } from "vitest";
import { parseFinding, validateFinding, synthesizeFinding } from "./synthesis";
import type { EvidenceBundle, EvidenceItem, IntentProfile } from "./types";

const CONF = "\n\n*Confidence: high — directly cited.*";

const intent: IntentProfile = {
  vertical: "financial_services",
  sizeBand: "global_enterprise",
  region: "north_america",
  goal: "coding copilot",
  constraints: [],
};

function bundle(items: EvidenceItem[]): EvidenceBundle {
  return {
    intent,
    items,
    coverage: {
      exactSegmentMatch: items.length > 0,
      nearestPeerScope: items.length > 0 ? "Your vertical" : null,
      disclosedAdopters: 0,
      poolContributors: 0,
      hasModelData: items.some((i) => i.layer === "model"),
    },
  };
}

const item = (url: string, layer: EvidenceItem["layer"] = "peer_public", headline = "some cited fact"): EvidenceItem => ({
  layer,
  scopeLabel: "Your vertical",
  headline,
  sourceUrl: url,
});

const ALLOWED = "https://www.census.gov/x";
const NOT_ALLOWED = "https://made-up-source.example/fabricated";

describe("parseFinding — anti-fabrication citation allowlist", () => {
  it("keeps only cited URLs that appear in the evidence bundle", () => {
    const allow = new Set([ALLOWED]);
    const f = parseFinding({ markdown: "…", citedSourceUrls: [ALLOWED, NOT_ALLOWED] }, allow);
    expect(f.citedSourceUrls).toEqual([ALLOWED]);
  });

  it("dedupes repeated citations", () => {
    const allow = new Set([ALLOWED]);
    const f = parseFinding({ markdown: "…", citedSourceUrls: [ALLOWED, ALLOWED] }, allow);
    expect(f.citedSourceUrls).toEqual([ALLOWED]);
  });
});

describe("validateFinding — rejects anything that reached beyond the evidence", () => {
  it("FAILS when the model cited a source that was dropped as out-of-bundle", () => {
    const b = bundle([item(ALLOWED)]);
    const raw = { markdown: "Peers do X.", citedSourceUrls: [ALLOWED, NOT_ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    const v = validateFinding(raw, parsed, b);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/not in the evidence bundle/);
  });

  it("FAILS when it made claims with zero surviving citations while evidence was available", () => {
    const b = bundle([item(ALLOWED)]);
    const raw = { markdown: "Peers overwhelmingly do X.", citedSourceUrls: [] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    const v = validateFinding(raw, parsed, b);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/no surviving citation/);
  });

  it("FAILS an empty finding", () => {
    const b = bundle([item(ALLOWED)]);
    const raw = { markdown: "", citedSourceUrls: [] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    expect(validateFinding(raw, parsed, b).ok).toBe(false);
  });

  it("PASSES a finding that cites only in-bundle sources", () => {
    const b = bundle([item(ALLOWED)]);
    const raw = { markdown: `Peers do X (per the survey).${CONF}`, citedSourceUrls: [ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    expect(validateFinding(raw, parsed, b).ok).toBe(true);
  });

  it("PASSES an honest no-evidence finding (empty bundle, no citations expected)", () => {
    const b = bundle([]);
    const raw = { markdown: `There isn't enough cited data for a grounded peer read yet.${CONF}`, citedSourceUrls: [] };
    const parsed = parseFinding(raw, new Set());
    // no evidence available → making no citation is honest, not a violation
    expect(validateFinding(raw, parsed, b).ok).toBe(true);
  });

  it("REQUIRES the Confidence disclosure line — a finding missing it fails even if otherwise grounded", () => {
    const b = bundle([item(ALLOWED)]);
    const raw = { markdown: "Peers do X (per the survey).", citedSourceUrls: [ALLOWED] }; // no Confidence line
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    const v = validateFinding(raw, parsed, b);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/Confidence/);
  });
});

describe("validateFinding — prose-level fabrication guard (numbers, not just citation URLs)", () => {
  it("FAILS when the prose states a figure that appears NOWHERE in the evidence (the citation-URL gate alone misses this)", () => {
    const b = bundle([item(ALLOWED, "peer_public", "33.9% of Finance & Insurance firms use AI.")]);
    // Cites the one real URL, but the 47% is invented — not the source's real 33.9%.
    const raw = { markdown: `Peers do X. 47% of your-band peers use it.${CONF}`, citedSourceUrls: [ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    const v = validateFinding(raw, parsed, b);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/figure\(s\) not present/);
  });

  it("PASSES a percentage within rounding tolerance of the cited figure (33.9% source -> \"34%\" prose)", () => {
    const b = bundle([item(ALLOWED, "peer_public", "33.9% of Finance & Insurance firms use AI.")]);
    const raw = { markdown: `34% of peers use it, per the survey.${CONF}`, citedSourceUrls: [ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    expect(validateFinding(raw, parsed, b).ok).toBe(true);
  });

  it("PASSES a precise figure (e.g. an Elo score) copied exactly from the evidence", () => {
    const b = bundle([item(ALLOWED, "model", "Anthropic leads overall at 1501 Elo.")]);
    const raw = { markdown: `Anthropic leads at 1501 Elo.${CONF}`, citedSourceUrls: [ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    expect(validateFinding(raw, parsed, b).ok).toBe(true);
  });

  it("FAILS a precise figure that is close-but-not-exact (Elo/counts get no rounding tolerance)", () => {
    const b = bundle([item(ALLOWED, "model", "Anthropic leads overall at 1501 Elo.")]);
    const raw = { markdown: `Anthropic leads at 1510 Elo.${CONF}`, citedSourceUrls: [ALLOWED] };
    const parsed = parseFinding(raw, new Set([ALLOWED]));
    expect(validateFinding(raw, parsed, b).ok).toBe(false);
  });
});

describe("synthesizeFinding — a stub result (no API key) is NOT exempt from validation", () => {
  it("does not ship an empty stub finding as valid — it falls through like any real attempt", async () => {
    const b = bundle([item(ALLOWED)]);
    const attempts = await synthesizeFinding(b);
    // With no ANTHROPIC_API_KEY configured in the test environment, every
    // attempt is a stub returning empty markdown, which MUST fail validation
    // (previously this was given a free pass and shipped as "complete").
    for (const a of attempts) {
      expect(a.source).toBe("stub");
      expect(a.validation.ok).toBe(false);
    }
  });
});
