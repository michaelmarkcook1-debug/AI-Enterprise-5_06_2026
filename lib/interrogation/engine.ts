// AIE-05 — Flow orchestrator. Ties questioner → retrieval → synthesis → store
// together so the API routes stay thin. Touches the DB + LLM, so it is
// integration-level; the honesty invariants it relies on (stopping rule,
// citation guard, cost fail-loud) are unit-tested in the pure cores.

import { runQuestioner } from "./questioner";
import { buildEvidenceBundle } from "./retrieval";
import { synthesizeFinding } from "./synthesis";
import { costColumns, type CostColumns } from "./cost";
import type { LLMUsage } from "../agents/llm-client";
import {
  createSession,
  getSession,
  appendAnswer,
  appendQuestion,
  appendMeter,
  setIntentProfile,
  setStatus,
  saveFinding,
  countQuestions,
  type SessionRow,
} from "./session-store";
import type { Finding, TranscriptTurn } from "./types";

export type AdvanceResult =
  | { kind: "question"; sessionId: string; question: string; options?: string[]; questionsAsked: number }
  | { kind: "finding"; sessionId: string; finding: Finding }
  | { kind: "failed"; sessionId: string; reason: string };

/** Conversational transcript (excludes cost-only meter rows). */
function transcriptOf(session: SessionRow): TranscriptTurn[] {
  return session.turns
    .filter((t) => t.role === "question" || t.role === "answer")
    .map((t) => ({ role: t.role as "question" | "answer", content: t.content }));
}

/** Sum a set of usages into one cost-columns row (model = the dominant/last). */
function aggregateCost(usages: LLMUsage[]): CostColumns {
  const cols = usages.map(costColumns);
  return {
    model: cols[cols.length - 1]?.model ?? "stub",
    inputTokens: cols.reduce((s, c) => s + c.inputTokens, 0),
    outputTokens: cols.reduce((s, c) => s + c.outputTokens, 0),
    costUsd: cols.reduce((s, c) => s + c.costUsd, 0),
  };
}

/** Run the synthesis stage for a session whose intent is now known. */
async function synthesize(session: SessionRow, concludingUsage: LLMUsage): Promise<AdvanceResult> {
  const intent = session.intentProfile!;
  await setStatus(session.id, "synthesizing");

  // Bank the concluding questioner (Sonnet) call as its OWN row, separate from
  // the synthesis (Opus) cost below — a combined row would mislabel which
  // model tier the tokens actually belong to, even though the org/session
  // rollup total is a plain SUM either way.
  await appendMeter(session, "(concluding questioner call)", costColumns(concludingUsage));

  const bundle = await buildEvidenceBundle(intent);
  const attempts = await synthesizeFinding(bundle);
  const last = attempts[attempts.length - 1];
  // Cost of EVERY synthesis attempt (a failed attempt still burned tokens →
  // still attributed) — Opus-only, so this row's model label stays accurate.
  const synthesisCost = aggregateCost(attempts.map((a) => a.usage));

  // A stub result (no API key) is NOT exempted from validation — see
  // synthesizeFinding's doc comment. Only a genuinely grounded finding ships.
  if (last.validation.ok) {
    await saveFinding({ sessionId: session.id, finding: last.finding, evidenceRefs: bundle.items, cost: synthesisCost });
    return { kind: "finding", sessionId: session.id, finding: last.finding };
  }

  // Ungrounded → do NOT ship. Still bank the burned cost, then fail honestly.
  await appendMeter(session, "(synthesis failed — ungrounded)", synthesisCost);
  await setStatus(session.id, "synthesis_failed");
  return { kind: "failed", sessionId: session.id, reason: last.validation.reason ?? "synthesis failed validation" };
}

/** Advance a loaded session by one questioner step, synthesizing if ready. */
async function advance(session: SessionRow): Promise<AdvanceResult> {
  const questionsAsked = countQuestions(session);
  const step = await runQuestioner({ transcript: transcriptOf(session), questionsAsked });

  if (step.next.action === "ask") {
    await appendQuestion(session, step.next.question, costColumns(step.usage));
    return {
      kind: "question",
      sessionId: session.id,
      question: step.next.question,
      options: step.next.options,
      questionsAsked: questionsAsked + 1,
    };
  }

  // action === "ready": persist the intent, then synthesize.
  await setIntentProfile(session.id, step.next.intentProfile);
  session.intentProfile = step.next.intentProfile;
  return synthesize(session, step.usage);
}

/** Public: start a new interrogation from the CIO's opening statement. */
export async function startInterrogation(input: {
  openingText: string;
  seatId?: string;
  orgId?: string;
}): Promise<AdvanceResult> {
  const sessionId = await createSession(input);
  const session = await getSession(sessionId);
  if (!session) throw new Error("interrogation: session vanished immediately after creation");
  return advance(session);
}

/** Public: submit the CIO's answer to the last question and advance. */
export async function submitAnswer(input: { sessionId: string; answer: string }): Promise<AdvanceResult> {
  const session = await getSession(input.sessionId);
  if (!session) return { kind: "failed", sessionId: input.sessionId, reason: "session not found" };
  if (session.status !== "in_progress") {
    return { kind: "failed", sessionId: input.sessionId, reason: `session is ${session.status}, not accepting answers` };
  }
  await appendAnswer(session, input.answer);
  return advance(session);
}
