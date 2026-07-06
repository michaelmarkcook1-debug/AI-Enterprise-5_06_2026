// AIE-05 — The finding synthesizer (reasoning-tier / Opus).
// ─────────────────────────────────────────────────────────────────────────────
// The ONE place in the whole product where the reasoning tier is justified: the
// paid, high-value output. It receives ONLY the deterministic evidence bundle +
// the intent + honest coverage flags — no open web, no raw DB — and writes the
// ~180-word tailored finding.
//
// Fabrication is blocked by construction: the synthesizer may only cite URLs
// present on the bundle (the same anti-fabrication allowlist gate as tab-chat).
// parseFinding DROPS any cited URL not in the bundle; validateFinding then
// rejects a finding that leaned on a dropped citation, so the flow can
// regenerate once and, failing that, surface an honest failure rather than ship
// an ungrounded claim. Under-claim, never over-claim.

import { extractStructured, type LLMResult, type LLMUsage } from "../agents/llm-client";
import {
  bundleAllowlist,
  type EvidenceBundle,
  type EvidenceItem,
  type Finding,
} from "./types";

const SYSTEM_PROMPT = `You are the senior analyst of AI Enterprise. You write ONE tailored finding for a CIO, in the voice of a top-tier industry analyst (Gartner/Forrester grade): precise, decision-useful, never salesy, never hedging filler.

NON-NEGOTIABLE RULES:
1. Use ONLY the evidence bundle provided. It is your entire world; nothing outside it exists. Never add a fact, number, model score, ranking, date, or peer figure that is not in the bundle.
2. Cite exactly. Every quantitative or named claim must trace to an evidence item; copy that item's sourceUrl VERBATIM into citedSourceUrls. Never invent, complete, or guess a URL.
3. Be honest about coverage. If coverage shows no exact-segment match, say the peer read is sector/adjacent-level, not size-matched. If poolContributors is 0, do NOT imply private peer data exists. State gaps plainly ("no peer at your exact band discloses this yet") — a gap is a finding, not something to paper over.
4. Show BOTH peer layers when present: the public-disclosure layer (named companies, surveys) AND, when poolContributors > 0, the private anonymised pool — clearly distinguished. When the pool is empty, lean on the public + model layers and say the private pool isn't populated yet.
5. Length: aim for ~180 words. Structure with these short bold sections: **Your situation** / **Model fit** / **What peers are doing** / **Bottom line** / then a final italic *Confidence:* line grading how firm each part is.
6. Never fabricate. If the bundle is thin, a shorter, more tentative finding that admits what isn't known beats a confident one that reaches beyond the evidence.

Write in Markdown. Begin with a level-3 heading (### ) naming the CIO's situation.`;

const SCHEMA = {
  name: "tailored_finding",
  description: "The ~180-word tailored finding plus the sourceUrls actually cited.",
  jsonSchema: {
    type: "object" as const,
    properties: {
      markdown: { type: "string", description: "The finding, Markdown, ~180 words, in the required structure." },
      citedSourceUrls: {
        type: "array",
        description: "Every sourceUrl used, copied VERBATIM from the evidence bundle.",
        items: { type: "string" },
      },
    },
    required: ["markdown", "citedSourceUrls"],
  },
};

/** Render the bundle as the model's entire world — every item numbered with its
 *  layer, scope, honest fit note, and the exact sourceUrl to cite. */
export function renderBundleForPrompt(bundle: EvidenceBundle): string {
  const cov = bundle.coverage;
  const intent = bundle.intent;
  const header = [
    "INTENT:",
    `  vertical=${intent.vertical}  sizeBand=${intent.sizeBand}  region=${intent.region}`,
    `  goal=${intent.goal}`,
    `  constraints=${intent.constraints.length ? intent.constraints.join("; ") : "(none stated)"}`,
    "",
    "COVERAGE (state honestly, never hide):",
    `  exactSegmentMatch=${cov.exactSegmentMatch}  nearestPeerScope=${cov.nearestPeerScope ?? "none"}`,
    `  disclosedAdopters=${cov.disclosedAdopters}  poolContributors=${cov.poolContributors}  hasModelData=${cov.hasModelData}`,
    "",
    "EVIDENCE (your entire world — cite by sourceUrl, verbatim):",
  ].join("\n");
  const items = bundle.items
    .map((it, i) => {
      const lines = [
        `[${i + 1}] (${it.layer} · ${it.scopeLabel}) ${it.headline}`,
        it.detail ? `     detail: ${it.detail}` : "",
        it.fitNote ? `     fit: ${it.fitNote}` : "",
        `     sourceUrl: ${it.sourceUrl}${it.sourcePublisher ? ` (${it.sourcePublisher}${it.sourceDate ? `, ${it.sourceDate}` : ""})` : ""}`,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n");
  return `${header}\n${items || "  (no evidence items — say plainly that there is not enough cited data to give a grounded finding)"}`;
}

/** Parse + enforce the anti-fabrication contract. DROPS any cited URL not on the
 *  bundle allowlist; dedupes; clamps length. Exported for tests. */
export function parseFinding(raw: unknown, allowlist: Set<string>): Finding {
  const o = (raw ?? {}) as Record<string, unknown>;
  const markdown = typeof o.markdown === "string" ? o.markdown.slice(0, 4000) : "";
  const seen = new Set<string>();
  const citedSourceUrls = (Array.isArray(o.citedSourceUrls) ? o.citedSourceUrls : [])
    .filter((u): u is string => typeof u === "string")
    .filter((u) => allowlist.has(u)) // the anti-fabrication gate
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  return { markdown, citedSourceUrls };
}

export interface FindingValidation {
  ok: boolean;
  reason?: string;
}

interface NumericToken {
  raw: string;
  value: number;
  isPercent: boolean;
}

/** Pull out figures that read as factual claims (percentages, Elo-like scores,
 *  counts) — deliberately coarse; this is a backstop against an INVENTED
 *  statistic, not a full NLP fact-checker. Single-digit numbers (list markers,
 *  "a few", turn counts) are excluded as noise. */
function extractNumericTokens(text: string): NumericToken[] {
  const matches = text.match(/\d[\d,]*\.?\d*%?/g) ?? [];
  return matches
    .map((raw) => ({ raw, isPercent: raw.endsWith("%"), value: Number(raw.replace(/[,%]/g, "")) }))
    .filter((t) => Number.isFinite(t.value) && t.value > 9);
}

/** Is a prose figure actually backed by the evidence? Percentages get ±1 point
 *  of rounding tolerance (a source's "33.9%" may honestly render as "34%");
 *  every other figure (Elo scores, counts) must match exactly — those are
 *  precise citations, not estimates. */
function numericTokenGrounded(token: NumericToken, evidenceTokens: NumericToken[]): boolean {
  return evidenceTokens.some((e) => {
    if (token.isPercent !== e.isPercent) return false;
    if (token.isPercent) return Math.abs(Math.round(token.value) - Math.round(e.value)) <= 1;
    return token.value === e.value;
  });
}

/** Detect a finding that reached beyond the evidence. Three gates:
 *   1. it names sourceUrls that were dropped (not on the allowlist);
 *   2. it presents substantive market claims with zero surviving citations
 *      while evidence WAS available;
 *   3. it states a FIGURE (percentage, Elo score, count) that appears nowhere
 *      in the evidence bundle's text — the citation-URL gate alone doesn't
 *      catch this: a finding can cite one real URL while the actual number
 *      quoted next to it is invented. This is what makes "grounded by
 *      construction" hold for the prose content, not just its citations. */
export function validateFinding(raw: unknown, finding: Finding, bundle: EvidenceBundle): FindingValidation {
  const claimed = Array.isArray((raw as Record<string, unknown>)?.citedSourceUrls)
    ? ((raw as Record<string, unknown>).citedSourceUrls as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  const dropped = claimed.filter((u) => !finding.citedSourceUrls.includes(u));
  if (dropped.length > 0) {
    return { ok: false, reason: `cited ${dropped.length} source(s) not in the evidence bundle` };
  }
  if (bundle.items.length > 0 && finding.citedSourceUrls.length === 0 && finding.markdown.length > 0) {
    return { ok: false, reason: "made claims with no surviving citation while evidence was available" };
  }
  if (finding.markdown.trim().length === 0) {
    return { ok: false, reason: "empty finding" };
  }

  const evidenceText = bundle.items
    .map((i) => `${i.headline} ${i.detail ?? ""} ${i.fitNote ?? ""} ${i.sourcePublisher ?? ""} ${i.sourceDate ?? ""}`)
    .join(" ");
  const evidenceTokens = extractNumericTokens(evidenceText);
  const proseTokens = extractNumericTokens(finding.markdown);
  const unsupported = proseTokens.filter((t) => !numericTokenGrounded(t, evidenceTokens));
  if (unsupported.length > 0) {
    return { ok: false, reason: `prose states figure(s) not present in the evidence bundle: ${unsupported.map((t) => t.raw).join(", ")}` };
  }

  // Structural honesty check: the required format mandates a final Confidence
  // line (see SYSTEM_PROMPT). This confirms the DISCLOSURE SECTION EXISTS — it
  // cannot verify the disclosure is itself truthful (that remains a matter of
  // prompt compliance), but a missing section is a real, checkable defect.
  if (!/confidence:/i.test(finding.markdown)) {
    return { ok: false, reason: "finding is missing the required Confidence disclosure line" };
  }

  return { ok: true };
}

export interface SynthesisResult {
  finding: Finding;
  usage: LLMUsage;
  source: LLMResult<unknown>["source"];
  validation: FindingValidation;
}

/** One synthesis attempt. `strictnessSuffix` lets the caller re-run with a
 *  harder instruction after a citation-guard rejection. */
async function synthesizeOnce(bundle: EvidenceBundle, strictnessSuffix = ""): Promise<SynthesisResult> {
  const allowlist = bundleAllowlist(bundle);
  let rawCaptured: unknown = null;
  const result = await extractStructured<Finding>({
    systemPrompt: SYSTEM_PROMPT + strictnessSuffix,
    userPrompt: renderBundleForPrompt(bundle),
    schema: SCHEMA,
    parse: (raw) => {
      rawCaptured = raw;
      return parseFinding(raw, allowlist);
    },
    maxTokens: 1200,
    // Reasoning tier — the paid, high-value synthesis. The only reasoning-tier
    // call in the product. Env-overridable.
    model: process.env.ANTHROPIC_SYNTHESIS_MODEL ?? "claude-opus-4-8",
    fallback: () => ({
      markdown: "",
      citedSourceUrls: [],
    }),
  });
  return {
    finding: result.data,
    usage: result.usage,
    source: result.source,
    validation: validateFinding(rawCaptured, result.data, bundle),
  };
}

/**
 * Synthesize the finding, with ONE strict retry on a citation-guard rejection.
 * Returns the attempts so the caller can attribute the cost of BOTH calls (a
 * failed call still burned tokens → still counted) and decide session status.
 * If the second attempt still fails validation, the caller surfaces
 * synthesis_failed rather than ship an ungrounded finding.
 *
 * A stub result (no ANTHROPIC_API_KEY — dev/CI without a key) is NOT given a
 * free pass: its empty markdown fails validateFinding's "empty finding" check
 * like any other attempt, so the caller correctly reports an honest failure
 * instead of persisting an empty finding as "complete".
 */
export async function synthesizeFinding(bundle: EvidenceBundle): Promise<SynthesisResult[]> {
  const first = await synthesizeOnce(bundle);
  if (first.validation.ok) return [first];
  const second = await synthesizeOnce(
    bundle,
    "\n\nSTRICT RETRY: your previous answer cited a source not in the bundle or made an unbacked claim. Cite ONLY sourceUrls that appear verbatim in the evidence, and state plainly anything the evidence does not cover.",
  );
  return [first, second];
}
