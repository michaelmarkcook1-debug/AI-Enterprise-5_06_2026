// AIE-05 — The adaptive questioner (mid-tier / Sonnet).
// ─────────────────────────────────────────────────────────────────────────────
// Works out what the CIO is actually trying to achieve by asking a small number
// of nuanced questions, each genuinely shaped by prior answers — never a fixed
// form. It gathers INTENT only; it is barred from asserting any market fact (a
// chip may say "Financial services" but never "…where 34% already use AI").
// Facts appear only in the final grounded finding.
//
// The stopping rule is enforced in CODE, not the prompt (decideAction, a pure
// unit-tested function): always ask ≥ MIN_QUESTIONS, then let the model conclude
// when it has enough signal, with NO user-facing cap — a MAX_TURNS bug-guard
// force-concludes only to stop a logic error from spiralling cost. The model
// ALWAYS returns both a best next question AND a best-effort intent profile, so
// the code can enforce either branch without ever inventing a question.

import { extractStructured, type LLMResult, type LLMUsage } from "../agents/llm-client";
import { VERTICALS, SIZE_BANDS, REGIONS } from "../peer/segments";
import type { IntentProfile, QuestionerAction, TranscriptTurn } from "./types";

export const MIN_QUESTIONS = 2;
/** Bug-guard only — NOT a UX cap. If the "ready" signal never fires by here,
 *  force conclusion so a logic bug can't loop the model (and its cost) forever. */
export const MAX_TURNS = 12;
/** "Quick response" mode's REAL UX ceiling (distinct from MAX_TURNS above,
 *  which is a bug-guard for BOTH modes). Chosen once at session start. */
export const QUICK_MODE_MAX_QUESTIONS = 5;

// Explicitly typed as Set<string> (not the narrower literal-union Set the ids'
// own types would infer): these check membership of an ARBITRARY incoming
// string from the model's JSON output, which is the whole point — a plain
// string is what's being validated against the real taxonomy.
const VERTICAL_IDS: Set<string> = new Set(VERTICALS.map((v) => v.id));
const SIZE_IDS: Set<string> = new Set(SIZE_BANDS.map((b) => b.id));
const REGION_IDS: Set<string> = new Set(REGIONS.map((r) => r.id));
/** The real taxonomy chip labels — the only categorical suggested-answer text
 *  parseQuestionerResponse will accept (see `options` filtering below). */
const CHIP_LABELS: Set<string> = new Set([...VERTICALS, ...SIZE_BANDS, ...REGIONS].map((r) => r.label));

/** The raw, always-both-branches shape the model returns each turn. */
export interface QuestionerResponse {
  nextQuestion: string;
  options?: string[];
  readyToConclude: boolean;
  intentProfile: IntentProfile;
  /** False when the model's categorical ids aren't valid taxonomy ids — the
   *  profile can't be trusted to conclude on, so decideAction keeps asking. */
  profileValid: boolean;
}

/**
 * PURE stopping-rule enforcement. Given how many questions have already been
 * asked and the model's latest response, decide the actual next action.
 * Order matters: bug-guard cap, then the mode's real UX cap (if any), then
 * the ≥MIN floor, then the model's own judgement. No DB, no LLM — fully
 * unit-tested.
 *
 * `maxQuestions` is the "quick response" mode's real ceiling (undefined in
 * comprehensive mode — no extra cap beyond MAX_TURNS/MIN_QUESTIONS below).
 */
export function decideAction(questionsAsked: number, resp: QuestionerResponse, maxQuestions?: number): QuestionerAction {
  if (questionsAsked >= MAX_TURNS) {
    // Deliberately unconditional — NOT gated on profileValid. This is a
    // termination guarantee: if a model bug meant profileValid never turns
    // true, gating on it here would defeat the entire purpose of the bug-guard
    // (the loop would never stop). Downstream is safe either way — retrieval's
    // segment lookups (segmentId, VERTICAL_STATS, etc.) are plain map lookups
    // that simply miss on an invalid/empty id, degrading to an honest thin-
    // evidence finding rather than crashing or fabricating.
    return { action: "ready", intentProfile: resp.intentProfile };
  }
  if (maxQuestions != null && questionsAsked >= maxQuestions) {
    // Same reasoning as the MAX_TURNS bug-guard above, applied to the mode's
    // chosen ceiling: unconditional, so a thin/invalid profile still degrades
    // to an honest thin-evidence finding rather than exceeding what the
    // visitor actually asked for ("quick" must mean quick, always).
    return { action: "ready", intentProfile: resp.intentProfile };
  }
  if (questionsAsked < MIN_QUESTIONS) {
    return { action: "ask", question: resp.nextQuestion, options: resp.options };
  }
  if (resp.readyToConclude && resp.profileValid) {
    return { action: "ready", intentProfile: resp.intentProfile };
  }
  return { action: "ask", question: resp.nextQuestion, options: resp.options };
}

const SYSTEM_PROMPT = `You are the adaptive intake analyst of AI Enterprise, an evidence-based enterprise-AI market-intelligence product. A CIO has arrived with a goal. Your job is to work out what they are ACTUALLY trying to achieve with AI by asking a few sharp, nuanced questions — each one genuinely shaped by their previous answers, never a fixed checklist.

RULES:
1. Ask ONE question at a time. Fewer, sharper questions beat a long interrogation — a busy CIO must not be annoyed.
2. Each question must depend on what they have already told you. Do not re-ask what you know.
3. You GATHER INTENT ONLY. Never assert, imply, or preview any market fact, statistic, model score, ranking, or peer figure — those come later, from cited evidence, not from you. A suggested answer chip may name a category ("Financial services") but never attach a claim to it.
4. For CATEGORICAL dimensions with a fixed vocabulary (industry vertical, company-size band, region), offer suggested-answer chips drawn EXACTLY from the allowed ids below — this lets the busy CIO click instead of type. For OPEN dimensions (their specific goal, their constraints) do NOT offer chips; let them speak freely.
5. Always return BOTH: (a) your best next question, and (b) a best-effort intentProfile capturing everything inferred so far. Set readyToConclude=true only once you genuinely have enough to give a tailored finding (industry, size, region, a clear goal, and any hard constraints).

ALLOWED CATEGORICAL IDS (use these EXACT id strings in intentProfile, and their human labels as chip text):
- vertical: {{VERTICALS}}
- sizeBand: {{SIZE_BANDS}}
- region: {{REGIONS}}`;

function buildSystemPrompt(): string {
  const fmt = (rows: readonly { id: string; label: string }[]) =>
    rows.map((r) => `${r.id} ("${r.label}")`).join(", ");
  return SYSTEM_PROMPT.replace("{{VERTICALS}}", fmt(VERTICALS))
    .replace("{{SIZE_BANDS}}", fmt(SIZE_BANDS))
    .replace("{{REGIONS}}", fmt(REGIONS));
}

const SCHEMA = {
  name: "adaptive_intake",
  description: "The next intake question plus the best-effort intent profile so far.",
  jsonSchema: {
    type: "object" as const,
    properties: {
      nextQuestion: { type: "string", description: "The single best next question, shaped by prior answers." },
      options: {
        type: "array",
        description: "Suggested-answer chips ONLY for a categorical question, drawn from the allowed ids' labels. Omit for open questions.",
        items: { type: "string" },
      },
      readyToConclude: { type: "boolean", description: "True only when you have enough signal for a tailored finding." },
      intentProfile: {
        type: "object",
        description: "Best-effort so far. Categorical ids MUST be from the allowed lists.",
        properties: {
          vertical: { type: "string" },
          sizeBand: { type: "string" },
          region: { type: "string" },
          goal: { type: "string" },
          constraints: { type: "array", items: { type: "string" } },
        },
        required: ["vertical", "sizeBand", "region", "goal", "constraints"],
      },
    },
    required: ["nextQuestion", "readyToConclude", "intentProfile"],
  },
};

/** Parse + validate the model output. Categorical ids are checked against the
 *  real taxonomy; an invalid id flips profileValid=false so decideAction will
 *  keep asking rather than conclude on an untrustworthy segment. */
export function parseQuestionerResponse(raw: unknown): QuestionerResponse {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = (o.intentProfile ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const vertical = str(p.vertical);
  const sizeBand = str(p.sizeBand);
  const region = str(p.region);
  const goal = str(p.goal).slice(0, 1000);
  const constraints = (Array.isArray(p.constraints) ? p.constraints : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.slice(0, 300))
    .slice(0, 12);
  const profileValid =
    VERTICAL_IDS.has(vertical) && SIZE_IDS.has(sizeBand) && REGION_IDS.has(region) && goal.length > 0;
  const rawOptions = (Array.isArray(o.options) ? o.options : [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, 120))
    .slice(0, 6);
  // If any offered chip looks like a categorical pick, keep ONLY the ones that
  // are real taxonomy labels — never a look-alike the model invented (which
  // would otherwise silently drift from the enum ids the segment join relies
  // on). A non-categorical suggestion set (e.g. a yes/no confirmation) has no
  // overlap with the taxonomy and passes through unfiltered.
  const isTaxonomyChip = rawOptions.some((x) => CHIP_LABELS.has(x));
  const options = isTaxonomyChip ? rawOptions.filter((x) => CHIP_LABELS.has(x)) : rawOptions;
  return {
    nextQuestion: str(o.nextQuestion).slice(0, 600) || "Could you tell me a little more about what you're trying to achieve?",
    options: options.length > 0 ? options : undefined,
    readyToConclude: o.readyToConclude === true,
    // Cast is safe: the ids are validated against the runtime taxonomy above,
    // and profileValid gates any use of this profile to conclude.
    intentProfile: { vertical, sizeBand, region, goal, constraints } as unknown as IntentProfile,
    profileValid,
  };
}

function renderTranscript(transcript: TranscriptTurn[]): string {
  return transcript
    .map((t) => `${t.role === "question" ? "You asked" : "They answered"}: ${t.content.slice(0, 800)}`)
    .join("\n");
}

export interface QuestionerStep {
  next: QuestionerAction;
  usage: LLMUsage;
  source: LLMResult<unknown>["source"];
}

/**
 * Run one questioner step: call the mid-tier model, parse+validate, then apply
 * the pure stopping rule. `questionsAsked` is how many questions have already
 * been put to the user (NOT counting this call's output).
 */
export async function runQuestioner(input: {
  transcript: TranscriptTurn[];
  questionsAsked: number;
  /** "quick" mode's real ceiling — omit for comprehensive (no extra cap). */
  maxQuestions?: number;
}): Promise<QuestionerStep> {
  const result = await extractStructured<QuestionerResponse>({
    systemPrompt: buildSystemPrompt(),
    userPrompt: `CONVERSATION SO FAR:\n${renderTranscript(input.transcript)}\n\nReturn your next question and best-effort intent profile.`,
    schema: SCHEMA,
    parse: parseQuestionerResponse,
    maxTokens: 900,
    // Mid tier — the adaptive questioning flow (working out the next good
    // question) is light judgement, not deep synthesis. Env-overridable.
    model: process.env.ANTHROPIC_QUESTIONER_MODEL ?? "claude-sonnet-4-6",
    // No API key → a deterministic stub that asks a single generic question and
    // never concludes, so the flow degrades honestly in dev/CI without a key.
    fallback: () => ({
      nextQuestion: "What's the specific outcome you're trying to reach with AI, and what's your biggest constraint?",
      readyToConclude: false,
      profileValid: false,
      intentProfile: { vertical: "", sizeBand: "", region: "", goal: "", constraints: [] } as unknown as IntentProfile,
    }),
  });
  return {
    next: decideAction(input.questionsAsked, result.data, input.maxQuestions),
    usage: result.usage,
    source: result.source,
  };
}
