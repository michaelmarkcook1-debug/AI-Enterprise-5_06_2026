// The encroachment review is an LLM writing prose about vendors on a public
// page. The system prompt asks it not to fabricate; these tests are what
// ENFORCES it. They cover the two mechanical guarantees:
//   1. a number the model produced that isn't in the supplied facts fails;
//   2. with no LLM (or a tripped guard) we emit the deterministic structural
//      read, which itself must claim nothing beyond the derivation.

import { describe, expect, it } from "vitest";
import {
  buildFactsPrompt,
  checkNumericGrounding,
  normaliseReview,
  structuralFallback,
  type EncroachmentReview,
} from "./encroachment-review";
import { evidenceDepth, type EncroachmentFacts } from "../graph/encroachment-context";

const baseFacts: EncroachmentFacts = {
  threatener: { nodeId: "anthropic", label: "Anthropic", slug: "anthropic", roles: ["Model Provider"] },
  threatened: { nodeId: "GOOGL", label: "Alphabet", slug: "google", roles: ["Model Provider"] },
  structural: {
    relationshipType: "investment",
    sharedLayers: ["Model Provider"],
    strength: 70,
    confidence: 40,
    rationale: "Derived signal: …",
    dependencySourceUrls: ["https://techcrunch.com/example"],
    reciprocal: false,
  },
  movements: [],
  statements: [],
  inputsPresent: { structural: true, movements: false, statements: false },
  statementsAsOf: "2026-07-14b",
};

const blank: EncroachmentReview = {
  headline: "",
  structuralRead: "",
  movementRead: "",
  statementRead: "",
  watchFor: [],
  assessedLevel: "watch",
  insufficientContext: false,
  citations: [],
};

/** The allowed set exactly as the agent builds it: every number in the prompt. */
function allowedFor(facts: EncroachmentFacts): Set<string> {
  const prompt = buildFactsPrompt(facts);
  return new Set(prompt.match(/\d+(?:\.\d+)?/g) ?? []);
}

describe("numeric grounding guard", () => {
  const allowed = allowedFor(baseFacts);

  it("passes prose that restates a supplied figure", () => {
    expect(
      checkNumericGrounding({ ...blank, structuralRead: "Edge strength 70 of 100." }, allowed).ok,
    ).toBe(true);
  });

  it.each([
    ["revenue", "Took $13 billion in revenue last year."],
    ["market share", "Holds 47% of the enterprise market."],
    ["a date we never supplied", "Has shipped its own stack since 2019."],
    ["headcount", "Moved 4200 engineers onto the effort."],
  ])("rejects an invented %s", (_label, text) => {
    const r = checkNumericGrounding({ ...blank, movementRead: text }, allowed);
    expect(r.ok).toBe(false);
  });

  it("ignores digits inside a URL — they are part of a source, not a claim", () => {
    expect(
      checkNumericGrounding(
        { ...blank, headline: "See https://example.com/2024/09/report-8821 for the filing." },
        allowed,
      ).ok,
    ).toBe(true);
  });

  it("does not false-positive on small integers in ordinary prose", () => {
    // The interrogation guard's known failure mode was over-flagging; keep this
    // one narrow enough that plain English survives it.
    expect(
      checkNumericGrounding({ ...blank, headline: "Both of the 2 layers overlap." }, allowed).ok,
    ).toBe(true);
  });
});

describe("structural fallback (no-LLM path)", () => {
  it("is capped at 'watch' and flags insufficient context on a structure-only pair", () => {
    const fb = structuralFallback(baseFacts);
    expect(fb.assessedLevel).toBe("watch");
    expect(fb.insufficientContext).toBe(true);
  });

  it("reports the absence of movements and statements rather than padding", () => {
    const fb = structuralFallback(baseFacts);
    expect(fb.movementRead).toMatch(/no recorded, cited movement/i);
    expect(fb.statementRead).toMatch(/no verbatim published position/i);
  });

  it("passes its own numeric guard — it must never assert an unsupplied figure", () => {
    const fb = structuralFallback(baseFacts);
    expect(checkNumericGrounding(fb, allowedFor(baseFacts)).ok).toBe(true);
  });

  it("cites only the dependency's own sources", () => {
    expect(structuralFallback(baseFacts).citations).toEqual([
      "https://techcrunch.com/example",
    ]);
  });
});

describe("facts prompt", () => {
  it("states the empty input classes explicitly, so the model has nothing to fill", () => {
    const prompt = buildFactsPrompt(baseFacts);
    expect(prompt).toMatch(/NONE HELD/);
    expect(prompt).toMatch(/do not speculate/i);
  });

  it("labels the dependency sources as evidencing the dependency, not the encroachment", () => {
    expect(buildFactsPrompt(baseFacts)).toMatch(/THE DEPENDENCY \(not the encroachment\)/);
  });

  it("carries the input depth so the model can calibrate", () => {
    expect(buildFactsPrompt(baseFacts)).toMatch(/INPUT DEPTH: 1\/3/);
  });
});

describe("response normalisation", () => {
  const fb = () => structuralFallback(baseFacts);

  it("wraps a bare-string watchFor — observed in prod despite the array schema", () => {
    // The live model returned watchFor as a single string. The component calls
    // .map() on it, which throws and blanks the panel; the build stays green
    // and the API still returns 200, so nothing else catches this.
    const out = normaliseReview(
      { ...fb(), watchFor: "Microsoft shipping its own model into Copilot surfaces" },
      fb,
    );
    expect(Array.isArray(out.watchFor)).toBe(true);
    expect(out.watchFor).toEqual(["Microsoft shipping its own model into Copilot surfaces"]);
  });

  it("drops non-string entries rather than rendering [object Object]", () => {
    const out = normaliseReview({ ...fb(), watchFor: ["real", { a: 1 }, null, "also real"] }, fb);
    expect(out.watchFor).toEqual(["real", "also real"]);
  });

  it("falls back on a non-object response", () => {
    expect(normaliseReview("not an object", fb).headline).toBe(fb().headline);
    expect(normaliseReview(null, fb).headline).toBe(fb().headline);
  });

  it("coerces an unknown assessedLevel down to 'watch' — never up", () => {
    expect(normaliseReview({ ...fb(), assessedLevel: "critical" }, fb).assessedLevel).toBe("watch");
    expect(normaliseReview({ ...fb(), assessedLevel: "material" }, fb).assessedLevel).toBe("material");
  });

  it("defaults insufficientContext to true when the model omits it", () => {
    const out = normaliseReview({ headline: "x" }, fb);
    expect(out.insufficientContext).toBe(true);
  });
});

describe("evidence depth", () => {
  const movement = (side: "threatener" | "threatened") => ({
    side,
    vendorLabel: side,
    headline: "h",
    publishedAt: "2026-07-01",
    sourceName: "s",
    sourceUrl: "https://example.com/a",
    eventKind: null,
  });
  const statement = (side: "threatener" | "threatened") => ({
    side,
    vendorLabel: side,
    dimension: "data retention",
    quote: "q",
    sourceName: "s",
    sourceUrl: "https://example.com/b",
  });

  it("counts only the classes that actually fired", () => {
    expect(evidenceDepth(baseFacts)).toEqual({
      count: 1,
      label: "Structural position only",
      oneSided: false,
    });
  });

  it("flags one-sided coverage — 3/3 with every quote from one vendor is not corroboration", () => {
    const d = evidenceDepth({
      ...baseFacts,
      movements: [movement("threatener"), movement("threatened")],
      statements: [statement("threatener")], // only one side
      inputsPresent: { structural: true, movements: true, statements: true },
    });
    expect(d.count).toBe(3);
    expect(d.oneSided).toBe(true);
    expect(d.label).toMatch(/one side only/);
  });

  it("does not flag one-sided when both vendors are covered in every present class", () => {
    const d = evidenceDepth({
      ...baseFacts,
      movements: [movement("threatener"), movement("threatened")],
      statements: [statement("threatener"), statement("threatened")],
      inputsPresent: { structural: true, movements: true, statements: true },
    });
    expect(d).toEqual({
      count: 3,
      label: "Structure, movements and stated positions",
      oneSided: false,
    });
  });
});
