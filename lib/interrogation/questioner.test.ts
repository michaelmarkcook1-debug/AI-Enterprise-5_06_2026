import { describe, it, expect } from "vitest";
import {
  decideAction,
  parseQuestionerResponse,
  MIN_QUESTIONS,
  MAX_TURNS,
  type QuestionerResponse,
} from "./questioner";
import type { IntentProfile } from "./types";

const validProfile: IntentProfile = {
  vertical: "financial_services",
  sizeBand: "global_enterprise",
  region: "north_america",
  goal: "standardize a coding copilot",
  constraints: ["SOC2"],
};

function resp(over: Partial<QuestionerResponse>): QuestionerResponse {
  return {
    nextQuestion: "What's your biggest constraint?",
    readyToConclude: false,
    profileValid: true,
    intentProfile: validProfile,
    ...over,
  };
}

describe("decideAction — the stopping rule, enforced in code not the prompt", () => {
  it("forces ASK for the first MIN_QUESTIONS turns even if the model says it's ready", () => {
    for (let asked = 0; asked < MIN_QUESTIONS; asked++) {
      const a = decideAction(asked, resp({ readyToConclude: true, profileValid: true }));
      expect(a.action).toBe("ask");
    }
  });

  it("lets the model conclude from turn MIN_QUESTIONS onward when ready + valid", () => {
    const a = decideAction(MIN_QUESTIONS, resp({ readyToConclude: true, profileValid: true }));
    expect(a.action).toBe("ready");
    if (a.action === "ready") expect(a.intentProfile.vertical).toBe("financial_services");
  });

  it("keeps asking past the minimum when the model is not yet ready (uncapped)", () => {
    const a = decideAction(7, resp({ readyToConclude: false }));
    expect(a.action).toBe("ask");
  });

  it("does NOT conclude on an invalid profile even when the model claims ready", () => {
    const a = decideAction(5, resp({ readyToConclude: true, profileValid: false }));
    expect(a.action).toBe("ask"); // can't trust the segment → keep asking
  });

  it("bug-guard: force-concludes at MAX_TURNS regardless of the model's judgement", () => {
    const a = decideAction(MAX_TURNS, resp({ readyToConclude: false }));
    expect(a.action).toBe("ready");
  });
});

describe("parseQuestionerResponse — validates categorical ids against the real taxonomy", () => {
  it("marks profileValid TRUE only when vertical/size/region are real ids and goal is set", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Q",
      readyToConclude: true,
      intentProfile: {
        vertical: "financial_services",
        sizeBand: "global_enterprise",
        region: "north_america",
        goal: "coding copilot",
        constraints: ["a", "b"],
      },
    });
    expect(r.profileValid).toBe(true);
    expect(r.readyToConclude).toBe(true);
  });

  it("marks profileValid FALSE on an invented vertical id (prevents a bad segment join)", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Q",
      readyToConclude: true,
      intentProfile: { vertical: "crypto_casinos", sizeBand: "global_enterprise", region: "north_america", goal: "x", constraints: [] },
    });
    expect(r.profileValid).toBe(false);
  });

  it("marks profileValid FALSE when the goal is empty", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Q",
      readyToConclude: true,
      intentProfile: { vertical: "legal", sizeBand: "mid_market", region: "europe", goal: "", constraints: [] },
    });
    expect(r.profileValid).toBe(false);
  });

  it("clamps options to a handful and drops non-strings", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Which region?",
      options: ["North America", "Europe", 42, "Asia-Pacific", "LATAM", "MEA", "Extra"],
      readyToConclude: false,
      intentProfile: validProfile,
    });
    expect(r.options!.length).toBeLessThanOrEqual(6);
    expect(r.options!.every((o) => typeof o === "string")).toBe(true);
  });

  it("MAX_TURNS is a real bug-guard number, not zero/negative", () => {
    expect(MAX_TURNS).toBeGreaterThan(MIN_QUESTIONS);
  });

  it("drops an invented look-alike chip label that isn't a real taxonomy label", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Which region?",
      // "North America" is real; "Antarctica" is not in REGIONS at all.
      options: ["North America", "Antarctica"],
      readyToConclude: false,
      intentProfile: validProfile,
    });
    expect(r.options).toEqual(["North America"]);
  });

  it("passes non-categorical chips through unfiltered (no overlap with the taxonomy at all)", () => {
    const r = parseQuestionerResponse({
      nextQuestion: "Do you already have a vendor shortlist?",
      options: ["Yes", "No"],
      readyToConclude: false,
      intentProfile: validProfile,
    });
    expect(r.options).toEqual(["Yes", "No"]);
  });
});
