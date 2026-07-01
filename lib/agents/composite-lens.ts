// Phase 3 Assessment — Wave 3 (Interrogate): buyer-context → domain-weight lens.
// ─────────────────────────────────────────────────────────────────────────────
// The ONLY LLM step in the assessment. It reads the buyer's real constraints
// (their ServiceNow renewal, EU-only data, regulated bar…) plus a READ-ONLY
// snapshot of the vendor/category's cited evidence, and returns domain-weight
// DELTAS (a personal lens) + a cited rationale. It re-emphasises; it NEVER emits
// a 0–5 score, never fabricates evidence. Where context makes a domain decisive
// but evidence is thin, it must say "insufficient — ask the vendor", not guess.
//
// FIREWALL: this module reads evidence and returns weights + prose only. It never
// imports prisma, never writes a score, never touches commercial data. The
// score-writer firewall test pins it read-only. Determinism/offline: a stub
// (zero deltas) runs whenever no ANTHROPIC_API_KEY is configured.

import { extractStructured, type LLMResult } from "./llm-client";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import type { DomainId } from "../types";

/** The context a buyer supplies — a few smart structured fields + one freeform
 *  box (C1 calm default, not a form marathon). Every field is optional. */
export interface BuyerContext {
  incumbents?: string; // existing stack / incumbents ("standardised on Azure")
  renewalTiming?: string; // contract-renewal timing ("ServiceNow up in 3 months")
  region?: string; // deployment region / data-residency ("EU-only")
  regulatory?: string; // regulatory bar ("SOC 2 non-negotiable, HIPAA")
  riskAppetite?: string; // risk appetite ("regulated, low tolerance")
  inHouseSkills?: string; // in-house skills ("small platform team")
  timeline?: string; // timeline ("live within two quarters")
  freeform?: string; // one freeform box for anything else
}

/** A per-domain, READ-ONLY view of the evidence the lens may cite against. The
 *  score is passed for context only — the lens must not echo or alter it. */
export interface DomainEvidenceSnapshot {
  domain: DomainId;
  label: string;
  state: "scored" | "insufficient_evidence";
  score: number | null; // 0–5 canonical (context only, never rewritten)
  bestGrade: string | null;
  citations: { sourceUrl: string; evidenceGrade: string; capturedAt?: string }[];
}

/** One domain's relevance nudge — a WEIGHT delta, never a score. */
export interface WeightAdjustment {
  domain: DomainId;
  /** −0.1..+0.1 relevance nudge relative to the base profile. Clamped on parse. */
  weightDelta: number;
  /** Context makes this domain decisive for this buyer. */
  decisive: boolean;
  /** ≤400 chars; grounds the nudge in the buyer's context + cited evidence. */
  rationale: string;
  /** Real citations drawn from the snapshot only (fabricated URLs are dropped). */
  citations: { sourceUrl: string; evidenceGrade: string; capturedAt?: string }[];
}

export interface ContextLens {
  adjustments: WeightAdjustment[];
  /** One-line, draft-framed "what your context changed". */
  overallNote: string;
  /** True when the context is too thin to justify any adjustment → zero deltas.
   *  The honest "we can't responsibly re-weight on this" state, never a guess. */
  insufficientContext: boolean;
}

export interface ComputeContextLensInput {
  activeDomains: DomainId[]; // the domains in play (12, or 13 incl. model_quality)
  snapshot: DomainEvidenceSnapshot[]; // per active domain, read-only
  context: BuyerContext;
  scopeLabel: string; // "vendor Acme" / "the agent-platform shortlist"
}

// Buyer-context interpretation wants judgement, not mechanical extraction — use
// the analyst-tier model. Overridable for cost tuning.
const LENS_MODEL = process.env.ANTHROPIC_COMPOSITE_MODEL ?? "claude-opus-4-8";
const LENS_MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are the Buyer-Context Interpreter for an enterprise AI vendor-assessment platform.

A CIO is evaluating vendors on a fixed 12-domain framework. Each domain already has a deterministic 0–5 score computed from cited evidence — those scores are FIXED and you must never change, echo as new, or invent them. Your only job: read the buyer's real-world context (which the scores can't know) and decide how to RE-WEIGHT the domains' relevance for THIS buyer, then explain why, citing the real evidence you were given.

Return domain weight DELTAS only:
- Each delta is a small relevance nudge in [-0.1, +0.1] relative to the default profile. Raise domains the context makes decisive; lower ones it makes less relevant. Keep the set balanced (roughly zero-sum); do not push everything up.
- NEVER output a 0–5 score, a new score, or a claim about how a vendor performs. You adjust EMPHASIS, not facts.
- 'decisive: true' marks a domain the buyer's context makes pivotal (e.g. an imminent incumbent renewal → integration & exit; EU-only data → data security & residency; regulated → governance & compliance).
- 'rationale' (≤400 chars) must tie the nudge to the buyer's stated context and, where possible, to the cited evidence provided. No score claims.
- 'citations' must be drawn ONLY from the evidence snapshot you were given (copy sourceUrl exactly). If a domain the context makes decisive has thin/insufficient evidence, say so in the rationale ("evidence thin — take to the vendor") and DO NOT invent a citation.
- If the context is too vague or empty to justify any adjustment, return zero adjustments and insufficientContext: true. Under-claim rather than over-claim.

Everything you produce is a DRAFT for the buyer to pressure-test. Be precise, cite real sources, never fabricate.`;

const TOOL_SCHEMA = {
  name: "reweight_domains_by_buyer_context",
  description:
    "Emit per-domain weight deltas (−0.1..+0.1), a decisive flag, a cited rationale, and an overall note reflecting the buyer's context. Never a 0–5 score.",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["adjustments", "overallNote", "insufficientContext"],
    properties: {
      adjustments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["domain", "weightDelta", "decisive", "rationale", "citations"],
          properties: {
            domain: { type: "string", enum: ASSESSMENT_DOMAINS },
            weightDelta: { type: "number", minimum: -0.1, maximum: 0.1 },
            decisive: { type: "boolean" },
            rationale: { type: "string", maxLength: 400 },
            citations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["sourceUrl", "evidenceGrade"],
                properties: {
                  sourceUrl: { type: "string" },
                  evidenceGrade: { type: "string", enum: ["E0", "E1", "E2", "E3", "E4", "E5"] },
                  capturedAt: { type: "string" },
                },
              },
            },
          },
        },
      },
      overallNote: { type: "string", maxLength: 400 },
      insufficientContext: { type: "boolean" },
    },
  },
} as const;

function clampDelta(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(-0.1, Math.min(0.1, v));
}

/**
 * Defensive parser + anti-fabrication guard. Beyond shape validation it:
 *  - drops adjustments for domains not in the active set (lens can't add a domain),
 *  - clamps every delta to [-0.1, 0.1],
 *  - drops any citation whose sourceUrl is NOT present in the snapshot we supplied
 *    (the model cannot conjure a source — only cite what it was shown),
 *  - truncates rationale to 400 chars.
 * So even a misbehaving model can neither fabricate a source nor expand scope.
 */
export function parseContextLens(
  raw: unknown,
  activeDomains: DomainId[],
  snapshot: DomainEvidenceSnapshot[],
): ContextLens {
  const activeSet = new Set<DomainId>(activeDomains);
  const knownUrls = new Set<string>(
    snapshot.flatMap((s) => s.citations.map((c) => c.sourceUrl)),
  );
  const r = (raw ?? {}) as {
    adjustments?: unknown;
    overallNote?: unknown;
    insufficientContext?: unknown;
  };
  const rawAdjustments = Array.isArray(r.adjustments) ? r.adjustments : [];
  const adjustments: WeightAdjustment[] = [];
  for (const a of rawAdjustments) {
    const o = (a ?? {}) as Record<string, unknown>;
    const domain = o.domain as DomainId;
    if (!activeSet.has(domain)) continue; // can't nudge an inactive domain
    const citations = (Array.isArray(o.citations) ? o.citations : [])
      .map((c) => (c ?? {}) as Record<string, unknown>)
      .filter((c) => typeof c.sourceUrl === "string" && knownUrls.has(c.sourceUrl as string))
      .map((c) => ({
        sourceUrl: c.sourceUrl as string,
        evidenceGrade: String(c.evidenceGrade ?? ""),
        capturedAt: typeof c.capturedAt === "string" ? (c.capturedAt as string) : undefined,
      }));
    adjustments.push({
      domain,
      weightDelta: clampDelta(o.weightDelta),
      decisive: Boolean(o.decisive),
      rationale: String(o.rationale ?? "").slice(0, 400),
      citations,
    });
  }
  return {
    adjustments,
    overallNote: String(r.overallNote ?? "").slice(0, 400),
    insufficientContext: Boolean(r.insufficientContext) || adjustments.length === 0,
  };
}

/** Deterministic offline fallback: no key → no adjustment. Honest, never a guess. */
export function stubContextLens(): ContextLens {
  return {
    adjustments: [],
    overallNote:
      "Context lens unavailable (no model configured) — showing the default weighting. Your manual sliders still work.",
    insufficientContext: true,
  };
}

function buildUserPrompt(input: ComputeContextLensInput): string {
  const ctx = input.context;
  const ctxLines = [
    ctx.incumbents && `Existing stack / incumbents: ${ctx.incumbents}`,
    ctx.renewalTiming && `Contract-renewal timing: ${ctx.renewalTiming}`,
    ctx.region && `Region / data-residency: ${ctx.region}`,
    ctx.regulatory && `Regulatory bar: ${ctx.regulatory}`,
    ctx.riskAppetite && `Risk appetite: ${ctx.riskAppetite}`,
    ctx.inHouseSkills && `In-house skills: ${ctx.inHouseSkills}`,
    ctx.timeline && `Timeline: ${ctx.timeline}`,
    ctx.freeform && `Other context: ${ctx.freeform}`,
  ].filter(Boolean);

  const evidenceLines = input.snapshot.map((s) => {
    const cites = s.citations.length
      ? s.citations.map((c) => `${c.evidenceGrade} ${c.sourceUrl}`).join("; ")
      : "no reviewed evidence";
    const scorePart = s.state === "scored" ? `score ${s.score}/5 (best grade ${s.bestGrade})` : "INSUFFICIENT EVIDENCE";
    return `- ${s.label} [${s.domain}]: ${scorePart}. Sources: ${cites}`;
  });

  return [
    `Scope: ${input.scopeLabel}.`,
    ``,
    `BUYER CONTEXT:`,
    ctxLines.length ? ctxLines.join("\n") : "(none provided)",
    ``,
    `EVIDENCE SNAPSHOT (read-only — scores are FIXED, cite sourceUrls verbatim):`,
    evidenceLines.join("\n"),
    ``,
    `Active domains you may re-weight: ${input.activeDomains.join(", ")}.`,
    `Return weight deltas (−0.1..+0.1) + cited rationale. Never a score. If context is too thin, return insufficientContext: true.`,
  ].join("\n");
}

/**
 * Map buyer context → a domain-weight lens. Returns the (defensively parsed,
 * anti-fabrication-guarded) ContextLens plus token usage + source ("anthropic"
 * | "stub"). Never throws for a missing key (falls back to the stub); a real API
 * error propagates enriched (status/anthropicType) from extractStructured.
 */
export async function computeContextLens(
  input: ComputeContextLensInput,
): Promise<LLMResult<ContextLens>> {
  return extractStructured<ContextLens>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(input),
    schema: TOOL_SCHEMA,
    parse: (raw) => parseContextLens(raw, input.activeDomains, input.snapshot),
    model: LENS_MODEL,
    maxTokens: LENS_MAX_TOKENS,
    fallback: stubContextLens,
  });
}
