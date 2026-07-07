// AIE-06 — Anonymization: the ONLY place a PoolContribution gets produced.
// ─────────────────────────────────────────────────────────────────────────────
// "Anonymize BEFORE pooling, never after" (the ticket's non-negotiable). This
// module is the boundary: it takes an IntentProfile's raw free text (goal,
// constraints — which can contain identifying detail, e.g. a company name
// embedded in "we're First National looking to...") and reduces it to fixed,
// coarse taxonomy tags via a CHEAP-TIER (Haiku) call — per AIE-06's own
// model-tier directive: "Cheap tier for any tagging... No reasoning-tier work
// here." The output type (PoolContribution) has no org/seat/session field at
// all, so what this function returns is structurally safe to pool — there is
// no later "strip the identity" step because identity was never captured.

import { extractStructured, type LLMResult } from "../agents/llm-client";
import { GOAL_CATEGORIES, CONSTRAINT_TAGS, type GoalCategoryId, type ConstraintTagId, type PoolContribution } from "./types";
import type { IntentProfile } from "../interrogation/types";

const GOAL_IDS = new Set<string>(GOAL_CATEGORIES.map((g) => g.id));
const CONSTRAINT_IDS = new Set<string>(CONSTRAINT_TAGS.map((c) => c.id));

const SYSTEM_PROMPT = `You classify a CIO's stated AI goal and constraints into FIXED, COARSE categories for an anonymized peer-benchmark pool. You NEVER see or repeat identifying detail (company names, specific numbers, anything narrow) — you only output category ids from the allowed lists below. If nothing fits well, use "other".

ALLOWED goalCategory ids: ${GOAL_CATEGORIES.map((g) => g.id).join(", ")}
ALLOWED constraintTag ids: ${CONSTRAINT_TAGS.map((c) => c.id).join(", ")}`;

const SCHEMA = {
  name: "anonymized_classification",
  description: "The coarse goal category and constraint tags for a contribution.",
  jsonSchema: {
    type: "object" as const,
    properties: {
      goalCategory: { type: "string", description: "One id from the allowed goalCategory list." },
      constraintTags: { type: "array", description: "0+ ids from the allowed constraintTag list.", items: { type: "string" } },
    },
    required: ["goalCategory", "constraintTags"],
  },
};

interface RawClassification {
  goalCategory: string;
  constraintTags: string[];
}

/** Parse + validate against the fixed taxonomies. An invalid/unrecognized id
 *  from the model falls back to "other" — never an invented category, and
 *  never a pass-through of raw text. Exported for tests. */
export function parseClassification(raw: unknown): { goalCategory: GoalCategoryId; constraintTags: ConstraintTagId[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const goalRaw = typeof o.goalCategory === "string" ? o.goalCategory : "";
  const goalCategory = (GOAL_IDS.has(goalRaw) ? goalRaw : "other") as GoalCategoryId;
  const tagsRaw = Array.isArray(o.constraintTags) ? o.constraintTags : [];
  const seen = new Set<string>();
  const constraintTags = tagsRaw
    .filter((t): t is string => typeof t === "string")
    .filter((t) => CONSTRAINT_IDS.has(t))
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)))
    .slice(0, CONSTRAINT_TAGS.length) as ConstraintTagId[];
  return { goalCategory, constraintTags };
}

async function classify(intent: IntentProfile): Promise<LLMResult<RawClassification>> {
  return extractStructured<RawClassification>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `GOAL: ${intent.goal}\nCONSTRAINTS: ${intent.constraints.join("; ") || "(none stated)"}`,
    schema: SCHEMA,
    parse: (raw) => raw as RawClassification, // validated by parseClassification below
    maxTokens: 200,
    // Cheap tier — mechanical tagging, per AIE-06's model-tier directive.
    model: process.env.ANTHROPIC_POOL_TAG_MODEL ?? "claude-haiku-4-5",
    fallback: () => ({ goalCategory: "other", constraintTags: [] }),
  });
}

/** Build the ONLY thing ever written to the pool: no org/seat/session, no raw
 *  text, just the coarse categorical shape. `now` is injectable for tests. */
export async function anonymizeForPool(intent: IntentProfile, now: Date = new Date()): Promise<PoolContribution> {
  const result = await classify(intent);
  const { goalCategory, constraintTags } = parseClassification(result.data);
  return {
    vertical: intent.vertical,
    sizeBand: intent.sizeBand,
    region: intent.region,
    goalCategory,
    constraintTags,
    contributedAt: now.toISOString().slice(0, 10),
  };
}
