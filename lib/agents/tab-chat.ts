// Per-tab grounded chat engine (piece 3) — Interrogate's discipline, pointed
// at any tab's evidence snapshot.
// ─────────────────────────────────────────────────────────────────────────────
// EXTENDS the existing stack (llm-client + the W3 anti-fabrication parser
// pattern from composite-lens.ts); it does NOT open a new ungrounded path:
//   • the model sees ONLY the tab's snapshot (built server-side, canonical);
//   • citations must be copied verbatim from the snapshot — the parser DROPS
//     any URL not in the allowlist, so a fabricated citation cannot render;
//   • a question beyond the evidence returns insufficientEvidence=true with
//     an honest "what would answer this", never a plausible guess;
//   • pure read → answer; NOTHING here writes canonical data (the score-writer
//     firewall class). Session-scoped by construction.

import { extractStructured, type LLMResult } from "./llm-client";
import {
  renderSnapshotForPrompt,
  snapshotUrlAllowlist,
  type TabEvidenceSnapshot,
} from "./tab-snapshots";

export interface TabChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface TabChatAnswer {
  answer: string;
  citations: { sourceUrl: string }[];
  insufficientEvidence: boolean;
  whatWouldHelp?: string;
}

const SYSTEM_PROMPT = `You are the grounded per-tab analyst assistant of AI Enterprise, an evidence-based enterprise-AI market-intelligence product.

NON-NEGOTIABLE RULES:
1. Answer ONLY from the evidence snapshot in the user message. It is your entire world; nothing outside it exists.
2. Citations: copy sourceUrl values EXACTLY as they appear in the snapshot. Cite every claim that has a citation available. NEVER construct, complete, or guess a URL — an invented citation is discarded and treated as a violation.
3. If the question cannot be answered from the snapshot, set insufficientEvidence=true, say plainly that you don't have evidence for it, and state in whatWouldHelp what evidence would answer it. NEVER answer from general knowledge, memory, or plausibility.
4. Never invent or adjust a number, score, rank, date, or vendor/company fact. Quote figures exactly as the snapshot states them.
5. Preserve honesty labels: anything the snapshot marks as est., inferred, derived, directional, analyst-curated, or a proxy MUST keep that label in your answer. "Not disclosed" and "insufficient evidence" are answers — repeat them as such; never fill a gap.
6. Never make claims about a company's private/internal operations; only what the snapshot's disclosed/observable facts state.
7. Be concise (under ~180 words), direct, and analyst-grade. No hedging filler, no marketing tone.`;

const SCHEMA = {
  name: "grounded_tab_answer",
  description: "The grounded answer to the user's question about this tab's evidence.",
  jsonSchema: {
    type: "object" as const,
    properties: {
      answer: {
        type: "string",
        description:
          "The answer, grounded ONLY in the snapshot. If insufficientEvidence is true this states plainly that the evidence doesn't cover the question.",
      },
      citations: {
        type: "array",
        description: "sourceUrls copied EXACTLY from the snapshot that support the answer.",
        items: {
          type: "object",
          properties: { sourceUrl: { type: "string" } },
          required: ["sourceUrl"],
        },
      },
      insufficientEvidence: {
        type: "boolean",
        description: "True when the snapshot cannot answer the question.",
      },
      whatWouldHelp: {
        type: "string",
        description: "When insufficient: what evidence/data would answer the question.",
      },
    },
    required: ["answer", "citations", "insufficientEvidence"],
  },
};

/** Parse + enforce the anti-fabrication contract. Exported for tests.
 *  - drops any citation whose sourceUrl is not in the snapshot allowlist
 *  - dedupes citations, clamps lengths, coerces types defensively */
export function parseTabAnswer(raw: unknown, allowlist: Set<string>): TabChatAnswer {
  const o = (raw ?? {}) as Record<string, unknown>;
  const answer = typeof o.answer === "string" ? o.answer.slice(0, 2400) : "";
  const seen = new Set<string>();
  const citations = (Array.isArray(o.citations) ? o.citations : [])
    .map((c) => ((c ?? {}) as Record<string, unknown>).sourceUrl)
    .filter((u): u is string => typeof u === "string")
    .filter((u) => allowlist.has(u)) // the anti-fabrication gate
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
    .map((sourceUrl) => ({ sourceUrl }));
  const insufficientEvidence = o.insufficientEvidence === true || answer.length === 0;
  const whatWouldHelp =
    typeof o.whatWouldHelp === "string" && o.whatWouldHelp.length > 0
      ? o.whatWouldHelp.slice(0, 500)
      : undefined;
  return { answer, citations, insufficientEvidence, whatWouldHelp };
}

/** Cap and serialise recent turns so follow-ups have context without letting
 *  the transcript smuggle in out-of-snapshot "facts" at unbounded length. */
function renderHistory(history: TabChatTurn[]): string {
  const turns = history.slice(-6).map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text.slice(0, 400)}`);
  return turns.length > 0 ? `\nRECENT CONVERSATION (context only — the snapshot remains the sole source of truth):\n${turns.join("\n")}\n` : "";
}

export async function answerTabQuestion(input: {
  snapshot: TabEvidenceSnapshot;
  question: string;
  history?: TabChatTurn[];
}): Promise<LLMResult<TabChatAnswer>> {
  const allowlist = snapshotUrlAllowlist(input.snapshot);
  const userPrompt = [
    "EVIDENCE SNAPSHOT (your entire world):",
    renderSnapshotForPrompt(input.snapshot),
    renderHistory(input.history ?? []),
    `QUESTION: ${input.question.slice(0, 600)}`,
  ].join("\n");

  return extractStructured<TabChatAnswer>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: SCHEMA,
    parse: (raw) => parseTabAnswer(raw, allowlist),
    maxTokens: 1000,
    // Grounded Q&A over a supplied snapshot is a constrained task — Haiku by
    // default (the spend rule), overridable per env for quality experiments.
    model: process.env.ANTHROPIC_CHAT_MODEL ?? "claude-haiku-4-5",
    fallback: () => ({
      answer: "",
      citations: [],
      insufficientEvidence: true,
      whatWouldHelp: "The AI assistant is not configured in this environment (no API key).",
    }),
  });
}
