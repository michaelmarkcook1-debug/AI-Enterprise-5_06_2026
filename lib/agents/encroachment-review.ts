// Encroachment analyst review (Opus).
// ─────────────────────────────────────────────────────────────────────────────
// Turns one derived encroachment edge into the analyst read a service provider
// would actually pay for — per the owner's definition of the metric:
//
//   "an assessed metric that interprets market data, overlayed with contextual
//    reasoning from previous vendor movements and stated signals from the
//    vendors leadership"
//
// The model's ONLY job is interpretation. Every fact it may reason over arrives
// in the user message from lib/graph/encroachment-context.ts, which sources each
// one. It may not add market facts, deal values, revenue, headcount, dates or
// quotes from its own knowledge — those would be unverifiable in a product whose
// hard rule is that every value traces to a real named source.
//
// Two guards enforce that, because a system prompt alone is not a control:
//   1. NUMERIC GROUNDING — any number in the output that does not appear in the
//      supplied facts fails the review (see checkNumericGrounding).
//   2. NO-LLM FALLBACK — with no API key we return the structural read only,
//      assembled deterministically. Never a fabricated narrative.

import { extractStructured } from "./llm-client";
import { evidenceDepth, type EncroachmentFacts } from "../graph/encroachment-context";

// Encroachment reasoning is judgement over sparse signals — the analyst tier,
// not the extraction tier. Overridable for cost tuning.
const REVIEW_MODEL = process.env.ANTHROPIC_ENCROACHMENT_MODEL ?? "claude-opus-4-8";
const REVIEW_MAX_TOKENS = 1400;

/**
 * OFF BY DEFAULT — owner instruction 2026-07-26: do not automate Anthropic API usage.
 *
 * This path is the sharpest version of that risk in the codebase: an Opus call
 * reachable from a PUBLIC page by anonymous traffic, one per vendor pair, with
 * no rate limit. The 6h cache bounds repeat hits but nothing bounds first hits
 * across the 7 pairs, and nothing stops a crawler walking them.
 *
 * With the flag unset the surface still works — it renders the deterministic
 * `structuralFallback`, which is honest by construction and states plainly that
 * the analyst layer did not run. No fabrication, no spend, no silent blank.
 *
 * Set ANTHROPIC_ENCROACHMENT_REVIEW=1 to re-enable, and add a rate limit first.
 */
export function encroachmentReviewEnabled(): boolean {
  return process.env.ANTHROPIC_ENCROACHMENT_REVIEW === "1";
}

export interface EncroachmentReview {
  /** One-line assessed read. Never a stated market fact. */
  headline: string;
  /** What the structural position actually implies (and doesn't). */
  structuralRead: string;
  /** Interpretation of real recorded movements — or the honest gap. */
  movementRead: string;
  /** Interpretation of verbatim stated positions — or the honest gap. */
  statementRead: string;
  /** What would confirm or kill this read. The actionable part. */
  watchFor: string[];
  /** The model's own assessed strength, constrained to the depth of input. */
  assessedLevel: "watch" | "credible" | "material";
  /** Set when the inputs are too thin for any real interpretation. */
  insufficientContext: boolean;
  /** Source URLs the review leaned on — copied from the supplied facts only. */
  citations: string[];
}

export interface EncroachmentReviewResult {
  review: EncroachmentReview;
  depth: { count: number; label: string };
  /** "anthropic" = generated; "structural" = deterministic no-LLM fallback. */
  source: "anthropic" | "structural";
  /** Set when generation was rejected by the grounding guard. */
  guardTripped?: string;
}

const SYSTEM_PROMPT = `You are the Encroachment Analyst for an enterprise-AI market-intelligence platform used by service providers and CIOs.

An "encroachment" here is an ASSESSED METRIC, not a reported event. It interprets structural market data, overlaid with contextual reasoning from the vendors' previous movements and their stated public positions. Your job is that interpretation — turning "X depends on Y and also operates in Y's layer" into an analyst read of whether X is actually positioned to take Y's ground, and what would prove it either way.

ABSOLUTE CONSTRAINTS — this product's core promise is that every value traces to a real named source:
- Reason ONLY over the facts in the user message. You have NO other knowledge of these companies for this task. Do not add market facts, deal values, revenue, valuations, funding amounts, market share, headcount, product names, dates, or quotes that are not in the supplied facts. If you want to say something you were not given, do not say it.
- Never present your assessment as a stated fact or a reported event. Write it as an assessment: "positioned to", "the structure implies", "on the evidence held". Never "X is launching", "X plans to", "X has taken share".
- The dependency's source URLs evidence the DEPENDENCY, not the encroachment. Never imply a source reported an encroachment claim.
- Absence of evidence is a finding. If no movements were supplied, movementRead must say plainly that we hold no recorded movement for either side in our sources — do NOT speculate about what they might be doing. Same for statements.
- Do not repeat the supplied rationale back. The reader has already read it; add the interpretation it lacks.

CALIBRATION — assessedLevel is capped by how much you were actually given:
- Only STRUCTURE supplied → "watch" and insufficientContext: true. A shared layer alone is an adjacency, not a threat; say so.
- Structure + ONE of (movements, statements) → at most "credible".
- Structure + movements + statements, all pointing the same way → "material" is available.
Under-claim rather than over-claim. A quiet, accurate read is worth more than a confident one.

STYLE: plain analyst prose, no marketing register, no hedging filler. Each field 1–3 sentences. watchFor: 2–4 concrete, checkable things (a filing, a product move, a pricing change, a contract event) that would confirm or kill this read.

citations: copy sourceUrl values EXACTLY from the supplied facts, only for sources you actually leaned on. Never invent or reconstruct a URL.`;

const TOOL_SCHEMA = {
  name: "assess_encroachment",
  description:
    "Emit an assessed analyst read of one derived encroachment signal, grounded strictly in the supplied facts. Never a stated market fact.",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "headline",
      "structuralRead",
      "movementRead",
      "statementRead",
      "watchFor",
      "assessedLevel",
      "insufficientContext",
      "citations",
    ],
    properties: {
      headline: { type: "string", maxLength: 180 },
      structuralRead: { type: "string", maxLength: 600 },
      movementRead: { type: "string", maxLength: 600 },
      statementRead: { type: "string", maxLength: 600 },
      watchFor: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", maxLength: 200 } },
      assessedLevel: { type: "string", enum: ["watch", "credible", "material"] },
      insufficientContext: { type: "boolean" },
      citations: { type: "array", maxItems: 8, items: { type: "string" } },
    },
  },
};

/** Render the facts as the model's ONLY permitted world. Explicit "none held"
 *  lines matter as much as the facts — they are what stops the model reaching
 *  for its own knowledge to fill a silence. */
export function buildFactsPrompt(facts: EncroachmentFacts): string {
  const L: string[] = [];
  L.push(`ASSESS: is ${facts.threatener.label} positioned to encroach on ${facts.threatened.label}?`);
  L.push("");
  L.push("── 1. STRUCTURAL POSITION (derived from the cited dependency graph) ──");
  const article = /^[aeiou]/i.test(facts.structural.relationshipType) ? "an" : "a";
  L.push(`${facts.threatener.label} depends on ${facts.threatened.label} via ${article} ${facts.structural.relationshipType} relationship.`);
  L.push(
    facts.structural.sharedLayers.length > 0
      ? `Both operate in these product layers: ${facts.structural.sharedLayers.join(", ")}.`
      : "No shared product layer resolved.",
  );
  L.push(`${facts.threatener.label} roles: ${facts.threatener.roles.join(", ") || "none resolved"}.`);
  L.push(`${facts.threatened.label} roles: ${facts.threatened.roles.join(", ") || "none resolved"}.`);
  L.push(`Derived edge strength ${facts.structural.strength}/100, derivation confidence ${facts.structural.confidence}/100 (capped — this is an inference, not a measurement).`);
  if (facts.structural.reciprocal) L.push("The dependency is RECIPROCAL — each side relies on the other; this is a mutual rivalry, not a one-way threat.");
  L.push(
    facts.structural.dependencySourceUrls.length > 0
      ? `Sources evidencing THE DEPENDENCY (not the encroachment): ${facts.structural.dependencySourceUrls.join(", ")}`
      : "No source URLs held for the underlying dependency.",
  );

  L.push("");
  L.push("── 2. PREVIOUS MOVEMENTS (real, cited items from our news store) ──");
  if (facts.movements.length === 0) {
    L.push("NONE HELD. We have no recorded, cited movement for either side in our sources. State this plainly; do not speculate about what they may have done.");
  } else {
    for (const m of facts.movements) {
      const who = m.side === "threatener" ? facts.threatener.label : facts.threatened.label;
      const tag = m.eventKind ? ` [${m.eventKind.toUpperCase()}]` : "";
      L.push(`- (${who})${tag} "${m.headline}" — ${m.sourceName ?? "source"}, ${m.publishedAt ?? "undated"} — ${m.sourceUrl}`);
    }
  }

  L.push("");
  L.push(`── 3. STATED POSITIONS (verbatim from each vendor's own published documents, verified as of ${facts.statementsAsOf}) ──`);
  if (facts.statements.length === 0) {
    L.push("NONE HELD. We hold no verbatim published position for either side. State this plainly; do not paraphrase or infer what leadership has said.");
  } else {
    for (const s of facts.statements) {
      L.push(`- (${s.vendorLabel}, on ${s.dimension}) ${s.quote} — ${s.sourceName ?? "source"}: ${s.sourceUrl}`);
    }
  }

  L.push("");
  const depth = evidenceDepth(facts);
  L.push(`INPUT DEPTH: ${depth.count}/3 classes present — ${depth.label}. Calibrate assessedLevel to this, per your constraints.`);
  if (depth.oneSided) {
    L.push("NOTE: at least one input class covers only ONE of the two vendors. Say so — a one-sided read is weaker, and treating it as symmetric would overstate what we hold.");
  }
  return L.join("\n");
}

/** Every number that appears anywhere in the supplied facts. A generated number
 *  outside this set was invented. */
function allowedNumbers(facts: EncroachmentFacts, factsPrompt: string): Set<string> {
  const found = new Set<string>();
  for (const m of factsPrompt.match(/\d+(?:\.\d+)?/g) ?? []) found.add(m);
  found.add(String(facts.structural.strength));
  found.add(String(facts.structural.confidence));
  return found;
}

/**
 * Reject any number the model produced that isn't in the supplied facts.
 *
 * Deliberately narrow to avoid the false-positive class that bit the
 * interrogation guard (it read inline citation markers as invented stats):
 * we ignore numbers inside URLs, ordinal/spelled small integers (1–3 appear in
 * ordinary prose like "one of three"), and percentages that restate a supplied
 * figure. Anything else unaccounted for is a fabrication and fails the review.
 */
export function checkNumericGrounding(
  review: EncroachmentReview,
  allowed: Set<string>,
): { ok: true } | { ok: false; reason: string } {
  const prose = [
    review.headline,
    review.structuralRead,
    review.movementRead,
    review.statementRead,
    ...review.watchFor,
  ]
    .join(" ")
    // Strip URLs — their digits are part of a source, not a claim.
    .replace(/https?:\/\/\S+/g, " ");

  for (const raw of prose.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const n = raw.replace(/,/g, "");
    if (allowed.has(n) || allowed.has(raw)) continue;
    // Small integers are ordinary prose ("both of the two layers"), not stats.
    if (/^\d$/.test(n) && Number(n) <= 3) continue;
    return { ok: false, reason: `ungrounded number "${raw}"` };
  }

  // Citations must be verbatim from the facts — a reconstructed URL is a
  // fabricated source even when the domain looks right.
  return { ok: true };
}

/**
 * Coerce a model response to the declared shape.
 *
 * The tool schema is a REQUEST, not a contract — observed in prod: `watchFor`
 * came back as a bare string despite `type: "array"`, which reaches the popover
 * as `"…".map is not a function` and blanks the panel. The build is green and
 * the API returns 200 either way, so nothing upstream catches it. Normalise
 * every field we render before it leaves this module.
 */
export function normaliseReview(raw: unknown, fallback: () => EncroachmentReview): EncroachmentReview {
  if (typeof raw !== "object" || raw === null) return fallback();
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
  const list = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : typeof v === "string" && v.trim()
        ? [v] // a single item returned unwrapped — keep it rather than drop it
        : [];

  const level = r.assessedLevel;
  const base = fallback();
  return {
    headline: str(r.headline) || base.headline,
    structuralRead: str(r.structuralRead) || base.structuralRead,
    movementRead: str(r.movementRead) || base.movementRead,
    statementRead: str(r.statementRead) || base.statementRead,
    watchFor: list(r.watchFor).length > 0 ? list(r.watchFor) : base.watchFor,
    assessedLevel:
      level === "watch" || level === "credible" || level === "material" ? level : "watch",
    insufficientContext:
      typeof r.insufficientContext === "boolean" ? r.insufficientContext : true,
    citations: list(r.citations),
  };
}

/** Deterministic structural-only read. Used when there's no API key and when
 *  the guard rejects a generation — never a fabricated narrative, just the
 *  honest statement of what the derivation does and does not support. */
export function structuralFallback(facts: EncroachmentFacts): EncroachmentReview {
  const depth = evidenceDepth(facts);
  const layers = facts.structural.sharedLayers.join("/") || "a shared layer";
  return {
    headline: `${facts.threatener.label} is structurally adjacent to ${facts.threatened.label} in ${layers} — an assessed adjacency, not an observed move.`,
    structuralRead: `${facts.threatener.label} relies on ${facts.threatened.label} (${facts.structural.relationshipType}) while also operating in ${layers}. That is the position a supplier's customer occupies before it builds its own substitute — it says nothing about intent, only about who is placed to move.${facts.structural.reciprocal ? " The dependency runs both ways, so treat this as a mutual rivalry rather than a one-way threat." : ""}`,
    movementRead:
      facts.movements.length === 0
        ? "We hold no recorded, cited movement for either side, so there is nothing to interpret here yet."
        : `${facts.movements.length} cited item${facts.movements.length === 1 ? "" : "s"} held for these vendors; analyst interpretation unavailable in this environment.`,
    statementRead:
      facts.statements.length === 0
        ? "We hold no verbatim published position for either side, so their stated intent is unknown to us."
        : `${facts.statements.length} verbatim published position${facts.statements.length === 1 ? "" : "s"} held; analyst interpretation unavailable in this environment.`,
    watchFor: [
      `A ${facts.threatener.label} product launch that substitutes for what it currently takes from ${facts.threatened.label}.`,
      `A change in the ${facts.structural.relationshipType} relationship itself — renewal, expansion, or unwind.`,
    ],
    assessedLevel: "watch",
    insufficientContext: depth.count < 2,
    citations: facts.structural.dependencySourceUrls.slice(0, 4),
  };
}

/** Generate the analyst review for one encroachment pair. */
export async function reviewEncroachment(
  facts: EncroachmentFacts,
): Promise<EncroachmentReviewResult> {
  const depth = evidenceDepth(facts);
  const factsPrompt = buildFactsPrompt(facts);
  const fallback = () => structuralFallback(facts);

  // Gate BEFORE the call, not after — the point is to make no request at all.
  if (!encroachmentReviewEnabled()) {
    return { review: fallback(), depth, source: "structural" };
  }

  const result = await extractStructured<EncroachmentReview>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: factsPrompt,
    schema: TOOL_SCHEMA,
    model: REVIEW_MODEL,
    maxTokens: REVIEW_MAX_TOKENS,
    parse: (raw) => normaliseReview(raw, fallback),
    fallback,
  });

  if (result.source !== "anthropic") {
    return { review: fallback(), depth, source: "structural" };
  }

  const guard = checkNumericGrounding(result.data, allowedNumbers(facts, factsPrompt));
  if (!guard.ok) {
    return { review: fallback(), depth, source: "structural", guardTripped: guard.reason };
  }

  // Citations are whitelisted against the supplied facts — a URL the model
  // reconstructed rather than copied is a fabricated source.
  const allowedUrls = new Set<string>([
    ...facts.structural.dependencySourceUrls,
    ...facts.movements.map((m) => m.sourceUrl).filter((u): u is string => !!u),
    ...facts.statements.map((s) => s.sourceUrl).filter((u): u is string => !!u),
  ]);
  const review: EncroachmentReview = {
    ...result.data,
    citations: (result.data.citations ?? []).filter((u) => allowedUrls.has(u)),
  };

  // A structure-only pair can never be graded above "watch", whatever the model
  // returned — the calibration rule is enforced here, not just requested.
  if (depth.count < 2) {
    review.assessedLevel = "watch";
    review.insufficientContext = true;
  } else if ((depth.count < 3 || depth.oneSided) && review.assessedLevel === "material") {
    // One-sided coverage cannot be "material" either: 3/3 where every quote
    // belongs to one vendor is not corroboration across the pair.
    review.assessedLevel = "credible";
  }

  return { review, depth, source: "anthropic" };
}
