import { describe, it, expect } from "vitest";
import { answerTabQuestion, parseTabAnswer } from "./tab-chat";
import {
  buildDependenciesTabSnapshot,
  buildPeersTabSnapshot,
  snapshotUrlAllowlist,
} from "./tab-snapshots";

// The anti-fabrication contract, pinned. Same discipline as composite-lens:
// a citation the snapshot didn't supply must never survive parsing.

describe("parseTabAnswer — the citation firewall", () => {
  const allow = new Set(["https://real.example/a", "https://real.example/b"]);

  it("drops fabricated citations, keeps allowlisted, dedupes", () => {
    const out = parseTabAnswer(
      {
        answer: "Grounded answer.",
        citations: [
          { sourceUrl: "https://real.example/a" },
          { sourceUrl: "https://fabricated.example/nope" }, // dropped
          { sourceUrl: "https://real.example/a" }, // deduped
          { sourceUrl: "https://real.example/b" },
          { sourceUrl: 42 }, // dropped (not a string)
        ],
        insufficientEvidence: false,
      },
      allow,
    );
    expect(out.citations.map((c) => c.sourceUrl)).toEqual([
      "https://real.example/a",
      "https://real.example/b",
    ]);
    expect(out.insufficientEvidence).toBe(false);
  });

  it("an empty answer is coerced to insufficientEvidence", () => {
    const out = parseTabAnswer({ answer: "", citations: [], insufficientEvidence: false }, allow);
    expect(out.insufficientEvidence).toBe(true);
  });

  it("malformed payloads degrade safely (never throw)", () => {
    const out = parseTabAnswer(null, allow);
    expect(out.answer).toBe("");
    expect(out.citations).toEqual([]);
    expect(out.insufficientEvidence).toBe(true);
  });

  it("clamps runaway lengths", () => {
    const out = parseTabAnswer(
      { answer: "x".repeat(10_000), citations: [], insufficientEvidence: false, whatWouldHelp: "y".repeat(2_000) },
      allow,
    );
    expect(out.answer.length).toBeLessThanOrEqual(2400);
    expect((out.whatWouldHelp ?? "").length).toBeLessThanOrEqual(500);
  });
});

describe("answerTabQuestion — honest stub in unconfigured environments", () => {
  it("returns source=stub + insufficient when no LLM key (test env)", async () => {
    const snapshot = buildPeersTabSnapshot()!;
    const res = await answerTabQuestion({ snapshot, question: "Who leads on disclosed AI adoption?" });
    expect(res.source).toBe("stub");
    expect(res.data.insufficientEvidence).toBe(true);
    expect(res.data.citations).toEqual([]);
  });
});

describe("tab snapshots stay inside their sources", () => {
  it("peers snapshot cites ONLY dataset citation URLs and labels est./not-disclosed honestly", () => {
    const s = buildPeersTabSnapshot()!;
    const urls = [...snapshotUrlAllowlist(s)];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^https:\/\//);
    const allFacts = s.sections.flatMap((x) => x.facts).join("\n");
    expect(allFacts).toContain("[est. — inferred, not asserted]");
    expect(allFacts).toContain("NOT DISCLOSED");
  });

  it("dependencies snapshot carries the derived-signal caveat and only edge URLs", () => {
    const s = buildDependenciesTabSnapshot()!;
    const caveats = s.sections.find((x) => x.label === "Caveats");
    expect(caveats?.facts.join(" ")).toMatch(/DERIVED analytical signal/);
    for (const u of snapshotUrlAllowlist(s)) expect(u).toMatch(/^https?:\/\//);
  });

  it("peers snapshot scoped to unknown ids → null (honest empty)", () => {
    expect(buildPeersTabSnapshot(["nobody"])).toBeNull();
  });
});
