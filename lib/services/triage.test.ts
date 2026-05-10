import { describe, expect, it } from "vitest";
import {
  triageProposal,
  triageBatch,
  summariseLanes,
  summariseReasons,
  detectUnsafeCategory,
  type TriageInput,
} from "./triage";

const NOW = new Date("2026-05-10T00:00:00Z");

function base(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    id: "prop_1",
    vendorId: "msft",
    productId: "msft_copilot",
    productMention: "Microsoft 365 Copilot",
    domain: "model_reliability",
    subfactor: "documented_evals",
    excerpt:
      "Microsoft 365 Copilot achieved 97% accuracy on the internal benchmark per the published security review on 2026-04-12.",
    proposedGrade: "E3",
    proposedRawScore: 80,
    sourceUrl: "https://learn.microsoft.com/en-us/copilot/microsoft-365/security",
    sourceIds: ["src_msft_copilot_security"],
    capturedAt: new Date("2026-04-12T00:00:00Z"),
    classifierConfidence: 0.92,
    isInferredTransformation: false,
    hasSourceConflict: false,
    dataStatus: "documented",
    freshnessStatus: "fresh",
    ...overrides,
  };
}

describe("triageProposal — auto_approve happy path", () => {
  it("auto-approves a high-confidence E3 record with vendor + product + source + fresh", () => {
    const decision = triageProposal(base(), { now: NOW });
    expect(decision.lane).toBe("auto_approve");
    expect(decision.signals.gradeOk).toBe(true);
    expect(decision.signals.confidenceOk).toBe(true);
    expect(decision.signals.hasSource).toBe(true);
    expect(decision.signals.notStale).toBe(true);
    expect(decision.signals.notInferred).toBe(true);
    expect(decision.signals.notDisputed).toBe(true);
    expect(decision.signals.notUnsafeCategory).toBe(true);
    expect(decision.unsafeCategory).toBeUndefined();
  });

  it("auto-approves at exactly the confidence threshold", () => {
    const decision = triageProposal(base({ classifierConfidence: 0.85 }), {
      now: NOW,
      autoApproveConfidence: 0.85,
    });
    expect(decision.lane).toBe("auto_approve");
  });
});

describe("UNSAFE CATEGORIES — must NEVER auto-approve", () => {
  it("market share claim → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "Microsoft Copilot has 47% market share in enterprise AI assistants.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("market_share");
  });

  it("market_position domain with 'leading' wording → not auto_approve", () => {
    const decision = triageProposal(
      base({
        domain: "market_position",
        subfactor: "competitive_position",
        excerpt: "Microsoft is the leading provider of enterprise AI assistants.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("market_share");
  });

  it("adoption estimate → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "Microsoft has approximately 1.5 million Copilot enterprise users.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("adoption_estimate");
  });

  it("IPO timing claim → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "Anthropic plans an IPO in 2027 according to the report.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("ipo_timing");
  });

  it("valuation claim → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "OpenAI is valued at $300 billion in the most recent funding round.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("valuation");
  });

  it("disputed language in excerpt → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "Microsoft denies that Copilot retains user prompts beyond the session.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("disputed");
  });

  it("dataStatus: 'disputed' → not auto_approve", () => {
    const decision = triageProposal(base({ dataStatus: "disputed" }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.unsafeCategory).toBe("disputed");
  });
});

describe("HARD GATES — must NEVER auto-approve when violated", () => {
  it("source conflict flagged → not auto_approve", () => {
    const decision = triageProposal(base({ hasSourceConflict: true }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.notDisputed).toBe(false);
  });

  it("stale data (captured > 365d ago) → not auto_approve", () => {
    const decision = triageProposal(
      base({ capturedAt: new Date("2024-01-01T00:00:00Z") }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.notStale).toBe(false);
  });

  it("freshnessStatus 'stale' → not auto_approve", () => {
    const decision = triageProposal(base({ freshnessStatus: "stale" }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
  });

  it("inferred transformation flag → not auto_approve", () => {
    const decision = triageProposal(
      base({ isInferredTransformation: true }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.notInferred).toBe(false);
  });

  it("hedged language in excerpt → not auto_approve", () => {
    const decision = triageProposal(
      base({
        excerpt: "Microsoft Copilot may achieve roughly 90% accuracy on internal benchmarks.",
      }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.notInferred).toBe(false);
  });

  it("evidenceGrade E1 (below E2 floor) → not auto_approve", () => {
    const decision = triageProposal(base({ proposedGrade: "E1" }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.gradeOk).toBe(false);
  });

  it("evidenceGrade E0 → not auto_approve and routed to review", () => {
    const decision = triageProposal(base({ proposedGrade: "E0" }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
    expect(["human_review_required", "recommend_reject"]).toContain(decision.lane);
  });

  it("low classifier confidence → not auto_approve", () => {
    const decision = triageProposal(base({ classifierConfidence: 0.5 }), {
      now: NOW,
      autoApproveConfidence: 0.85,
    });
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.confidenceOk).toBe(false);
  });

  it("missing source URL and missing sourceIds → not auto_approve", () => {
    const decision = triageProposal(
      base({ sourceUrl: null, sourceIds: [] }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.hasSource).toBe(false);
    expect(decision.lane).toBe("human_review_required");
  });

  it("empty vendorId → not auto_approve", () => {
    const decision = triageProposal(base({ vendorId: "" }), { now: NOW });
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.hasEntityMatch).toBe(false);
  });

  it("missing productId AND no productMention → not auto_approve", () => {
    const decision = triageProposal(
      base({ productId: null, productMention: null }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("auto_approve");
    expect(decision.signals.hasProductMatch).toBe(false);
  });
});

describe("recommend_approve lane", () => {
  it("routes to recommend_approve when product linkage is missing but everything else is clean", () => {
    const decision = triageProposal(
      base({ productId: null, productMention: null }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_approve");
    expect(decision.reasons.some((r) => /product linkage missing/.test(r))).toBe(true);
  });

  it("routes medium-confidence (0.6 ≤ conf < 0.85) source-backed E2+ to recommend_approve", () => {
    const decision = triageProposal(
      base({ classifierConfidence: 0.7 }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_approve");
    expect(decision.reasons.some((r) => /medium confidence/.test(r))).toBe(true);
  });

  it("matches productMention against knownProductNames to allow auto_approve", () => {
    const decision = triageProposal(
      base({ productId: null, productMention: "Microsoft 365 Copilot" }),
      { now: NOW, knownProductNames: ["Microsoft 365 Copilot", "Azure OpenAI"] },
    );
    expect(decision.lane).toBe("auto_approve");
  });
});

describe("classifier-fallback handling", () => {
  it("confidenceIsFallback always routes to human_review_required regardless of how high the stamped value is", () => {
    const decision = triageProposal(
      base({ classifierConfidence: 0.99, confidenceIsFallback: true }),
      { now: NOW },
    );
    expect(decision.lane).toBe("human_review_required");
    expect(decision.reasons.some((r) => /classifier unavailable/.test(r))).toBe(true);
  });

  it("confidenceIsFallback blocks auto_approve even when every other gate is green", () => {
    const decision = triageProposal(
      base({ confidenceIsFallback: true }),
      { now: NOW },
    );
    expect(decision.lane).toBe("human_review_required");
  });

  it("confidenceIsFallback does NOT trigger recommend_reject (we don't reject for missing classifier output)", () => {
    const decision = triageProposal(
      base({ classifierConfidence: 0.5, confidenceIsFallback: true }),
      { now: NOW },
    );
    expect(decision.lane).not.toBe("recommend_reject");
  });
});

describe("recommend_reject lane", () => {
  it("very low real confidence → recommend_reject", () => {
    const decision = triageProposal(
      base({ classifierConfidence: 0.2 }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_reject");
  });

  it("E1 grade with confidence < 0.6 → recommend_reject", () => {
    const decision = triageProposal(
      base({ proposedGrade: "E1", classifierConfidence: 0.5 }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_reject");
  });

  it("hedged language with real confidence → recommend_reject", () => {
    const decision = triageProposal(
      base({
        classifierConfidence: 0.65,
        excerpt: "Microsoft Copilot may achieve roughly 90% accuracy on internal benchmarks.",
      }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_reject");
  });

  it("stale data (>365d) with real confidence → recommend_reject", () => {
    const decision = triageProposal(
      base({ capturedAt: new Date("2024-01-01T00:00:00Z") }),
      { now: NOW },
    );
    expect(decision.lane).toBe("recommend_reject");
  });
});

describe("ALL FOUR LANES MUST BE REACHABLE", () => {
  it("auto_approve is reachable", () => {
    expect(triageProposal(base(), { now: NOW }).lane).toBe("auto_approve");
  });
  it("recommend_approve is reachable", () => {
    expect(
      triageProposal(base({ classifierConfidence: 0.7 }), { now: NOW }).lane,
    ).toBe("recommend_approve");
  });
  it("recommend_reject is reachable", () => {
    expect(
      triageProposal(base({ classifierConfidence: 0.2 }), { now: NOW }).lane,
    ).toBe("recommend_reject");
  });
  it("human_review_required is reachable", () => {
    expect(
      triageProposal(base({ confidenceIsFallback: true }), { now: NOW }).lane,
    ).toBe("human_review_required");
  });
});

describe("audit-trail outputs", () => {
  it("decision carries proposalId, sourceIds, confidence and reasons", () => {
    const decision = triageProposal(base(), { now: NOW });
    expect(decision.proposalId).toBe("prop_1");
    expect(decision.sourceIds).toEqual(["src_msft_copilot_security"]);
    expect(decision.confidence).toBe(0.92);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  it("falls back sourceIds to sourceUrl when sourceIds not provided", () => {
    const decision = triageProposal(
      base({ sourceIds: undefined }),
      { now: NOW },
    );
    expect(decision.sourceIds.length).toBe(1);
    expect(decision.sourceIds[0]).toMatch(/^https/);
  });

  it("unsafeCategory is echoed in the decision", () => {
    const decision = triageProposal(
      base({ excerpt: "Microsoft has 47% market share." }),
      { now: NOW },
    );
    expect(decision.unsafeCategory).toBe("market_share");
  });
});

describe("detectUnsafeCategory direct tests", () => {
  it.each([
    ["market share", { excerpt: "47% market share" }, "market_share"],
    ["adoption", { excerpt: "approximately 2 million users" }, "adoption_estimate"],
    ["IPO", { excerpt: "plans IPO in Q3 2027" }, "ipo_timing"],
    ["valuation", { excerpt: "valued at $50 billion" }, "valuation"],
    ["disputed", { excerpt: "Microsoft denies the claim" }, "disputed"],
  ] as const)("flags %s", (_name, override, expected) => {
    const result = detectUnsafeCategory(base(override));
    expect(result).toBe(expected);
  });

  it("does NOT flag clean documentation", () => {
    expect(
      detectUnsafeCategory(
        base({
          excerpt:
            "Microsoft 365 Copilot supports tenant-isolated data processing per the published security architecture.",
          domain: "data_security_privacy",
        }),
      ),
    ).toBeNull();
  });
});

describe("batch helpers", () => {
  it("triageBatch returns decisions for every input", () => {
    const decisions = triageBatch([base({ id: "a" }), base({ id: "b" })], { now: NOW });
    expect(decisions).toHaveLength(2);
    expect(decisions.map((d) => d.proposalId)).toEqual(["a", "b"]);
  });

  it("summariseLanes counts by lane", () => {
    const decisions = triageBatch(
      [
        base({ id: "a" }),
        base({ id: "b", proposedGrade: "E0" }),
        base({ id: "c", excerpt: "47% market share" }),
        base({ id: "d", classifierConfidence: 0.2 }),
      ],
      { now: NOW },
    );
    const counts = summariseLanes(decisions);
    expect(counts.auto_approve).toBe(1);
    expect(counts.human_review_required + counts.recommend_reject).toBeGreaterThanOrEqual(2);
  });

  it("summariseReasons collapses numeric variations and counts most-common first", () => {
    const decisions = triageBatch(
      [
        base({ id: "a", classifierConfidence: 0.2 }),
        base({ id: "b", classifierConfidence: 0.3 }),
        base({ id: "c", classifierConfidence: 0.25 }),
        base({ id: "d", proposedGrade: "E0" }),
      ],
      { now: NOW },
    );
    const reasons = summariseReasons(decisions);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0].count).toBeGreaterThanOrEqual(reasons[reasons.length - 1].count);
    // Numeric percentages collapse into a single bucket
    const lowConf = reasons.find((r) => /low classifier confidence N%/.test(r.reason));
    expect(lowConf).toBeDefined();
    expect(lowConf!.count).toBeGreaterThanOrEqual(3);
  });
});

describe("INVARIANT — exhaustive unsafe-category sweep", () => {
  // Every unsafe-category fixture, no matter how clean every other field,
  // must NEVER end up in the auto_approve lane.
  const unsafeFixtures: { name: string; over: Partial<TriageInput> }[] = [
    { name: "market share", over: { excerpt: "Microsoft has 60% market share globally." } },
    {
      name: "market position dominance",
      over: { domain: "market_position", excerpt: "Microsoft remains dominant in enterprise AI." },
    },
    { name: "adoption estimate", over: { excerpt: "Roughly 3 million enterprise users." } },
    { name: "IPO timing", over: { excerpt: "IPO expected in Q4 2027." } },
    { name: "valuation", over: { excerpt: "Valued at $200 billion post-money." } },
    { name: "disputed", over: { excerpt: "Microsoft denies the data retention claim." } },
    { name: "dataStatus disputed", over: { dataStatus: "disputed" } },
    { name: "source conflict", over: { hasSourceConflict: true } },
    { name: "low confidence", over: { classifierConfidence: 0.3 } },
    { name: "missing source", over: { sourceUrl: null, sourceIds: [] } },
    { name: "stale", over: { capturedAt: new Date("2023-01-01T00:00:00Z") } },
    { name: "inferred", over: { isInferredTransformation: true } },
    { name: "E0 grade", over: { proposedGrade: "E0" } },
    { name: "E1 grade", over: { proposedGrade: "E1" } },
  ];

  for (const fx of unsafeFixtures) {
    it(`NEVER auto-approves: ${fx.name}`, () => {
      const decision = triageProposal(base(fx.over), { now: NOW });
      expect(decision.lane).not.toBe("auto_approve");
    });
  }
});
