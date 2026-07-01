// Phase 3 Assessment — Wave 4 (C9): vendor-meeting question generator (LLM).
// ─────────────────────────────────────────────────────────────────────────────
// The tailored part of the prep kit: 8–12 meeting questions GROUNDED in a
// vendor's real weak / thin / insufficient domains. The LLM writes QUESTIONS and
// their rationale ONLY — it never invents evidence, a score, or a vendor fact.
// Insufficient-evidence domains become honest "ask them to demonstrate X"
// questions. Where the model tries to assert a fact it is reframed by the prompt
// as a question; the parser drops anything not tied to a real framework domain.
//
// FIREWALL: reads the (already-computed) domain digest, returns text questions.
// No prisma, no score write, no commercial data. Stub fallback runs with no key.

import { extractStructured, type LLMResult } from "./llm-client";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import { DOMAIN_LABEL } from "../assessment/domain-labels";
import { fallbackQuestions, type KitQuestion, type KitTargets, type DomainDigest } from "../assessment/prep-kit";
import type { DomainId } from "../types";

const KIT_MODEL = process.env.ANTHROPIC_PREPKIT_MODEL ?? "claude-opus-4-8";
const KIT_MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are an enterprise-AI procurement analyst writing the questions a CIO should ask a vendor in a buying meeting.

You are given a vendor's assessment: a fixed 0–5 score (or "insufficient evidence") per domain of a 12-domain framework, with the WEAK and INSUFFICIENT domains flagged. Those scores are FACTS you must never restate, change, or invent. Your job is to turn the vendor's GAPS into 8–12 sharp, specific meeting questions.

Rules:
- Write QUESTIONS ONLY. Never assert a vendor fact, capability, or score ("you don't support X"). Ask ("can you demonstrate X, and where are the limits?").
- Prioritise the flagged WEAK domains and the INSUFFICIENT domains. For an INSUFFICIENT domain, set askTheVendor: true and frame it as "we couldn't independently evidence your <domain> — can you demonstrate it / show proof?".
- Each question ties to exactly one framework domain (from the provided list) and includes a one-line rationale referencing the real state (weak / low-confidence / insufficient). No rationale may claim a score or a fact not given to you.
- Make questions specific and evidence-seeking (ask for a demo, a document, a reference, a test result) — not generic. 8–12 total; cover the flagged gaps first, then the most enterprise-critical domains.
- Everything is a DRAFT for the buyer to take into the meeting. Never fabricate.`;

const TOOL_SCHEMA = {
  name: "emit_prep_questions",
  description: "Emit 8–12 vendor-meeting questions, each grounded in one framework domain and the vendor's real weak/thin/insufficient state. Questions only — never a vendor fact or score.",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: 6,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["domain", "question", "rationale", "askTheVendor"],
          properties: {
            domain: { type: "string", enum: ASSESSMENT_DOMAINS },
            question: { type: "string", maxLength: 400 },
            rationale: { type: "string", maxLength: 240 },
            askTheVendor: { type: "boolean" },
          },
        },
      },
    },
  },
} as const;

export interface GenerateQuestionsInput {
  vendorName: string;
  digest: DomainDigest[];
  targets: KitTargets;
}

/** Defensive parser: keep only questions tied to a real framework domain with a
 *  non-empty question; cap at 12. So a misbehaving model can neither invent a
 *  domain nor overflow the kit. */
export function parsePrepQuestions(raw: unknown): KitQuestion[] {
  const domainSet = new Set<DomainId>(ASSESSMENT_DOMAINS);
  const r = (raw ?? {}) as { questions?: unknown };
  const list = Array.isArray(r.questions) ? r.questions : [];
  const out: KitQuestion[] = [];
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const domain = o.domain as DomainId;
    const question = typeof o.question === "string" ? o.question.trim() : "";
    if (!domainSet.has(domain) || !question) continue;
    out.push({
      domain,
      question: question.slice(0, 400),
      rationale: (typeof o.rationale === "string" ? o.rationale : "").slice(0, 240),
      askTheVendor: Boolean(o.askTheVendor),
    });
    if (out.length >= 12) break;
  }
  return out;
}

function buildUserPrompt(input: GenerateQuestionsInput): string {
  const lines = input.digest.map((d) => {
    const state = d.state === "scored" ? `${d.score}/5${d.lowConfidence ? " (low confidence)" : ""}` : "INSUFFICIENT EVIDENCE";
    const flag = d.weak ? "  ← FLAGGED (weak/thin)" : "";
    return `- ${d.label} [${d.domain}]: ${state}${flag}`;
  });
  const weakLabels = input.targets.weak.map((d) => DOMAIN_LABEL[d]).join(", ") || "(none)";
  const insufficientLabels = input.targets.insufficient.map((d) => DOMAIN_LABEL[d]).join(", ") || "(none)";
  return [
    `Vendor: ${input.vendorName}.`,
    input.targets.contextAdjusted ? "(Gaps below reflect the buyer's context-adjusted priorities from Interrogate.)" : "",
    "",
    "ASSESSMENT (scores are FIXED facts — turn gaps into questions, never restate a score):",
    lines.join("\n"),
    "",
    `WEAK / low-confidence domains: ${weakLabels}`,
    `INSUFFICIENT-evidence domains (ask them to demonstrate): ${insufficientLabels}`,
    "",
    "Write 8–12 questions. Cover the flagged gaps first. For insufficient domains, askTheVendor: true.",
  ].filter(Boolean).join("\n");
}

/**
 * Generate the tailored meeting questions. Returns the (validated) LLM questions
 * + source ("anthropic" | "stub"). Never throws for a missing key (falls back to
 * the deterministic fallbackQuestions); a real API error propagates enriched.
 */
export async function generatePrepQuestions(input: GenerateQuestionsInput): Promise<LLMResult<KitQuestion[]>> {
  return extractStructured<KitQuestion[]>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input),
    schema: TOOL_SCHEMA,
    parse: parsePrepQuestions,
    model: KIT_MODEL,
    maxTokens: KIT_MAX_TOKENS,
    fallback: () => fallbackQuestions(input.targets),
  });
}
