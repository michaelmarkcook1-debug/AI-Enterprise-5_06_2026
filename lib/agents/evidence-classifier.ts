// Evidence Classifier (spec §15). Re-grades a candidate proposal conservatively
// against the E0–E5 rubric and outputs a confidence score + rationale. This runs
// as a second pass over extractor output and on analyst override requests.

import { z } from "zod";
import { extractStructured } from "./llm-client";
import type { ExtractedProposal } from "./evidence-extractor";

// Defensive length-handling: truncate at the OUTER preprocess layer so a
// runaway LLM output can never fail validation on a length issue. The
// schema's `.max()` checks are kept as cheap safety nets — they can only
// fire on absurd >50k-char outputs, which would themselves be a separate
// signal of trouble.
//
// History:
//   • Original ceiling: rationale max 400 → caused 304/312 silent classifier
//     failures (CLASSIFIER_FAILURE_REPORT.md).
//   • First fix: bumped to 2000, but LLM still occasionally exceeded it
//     (27/43 of the May-2026 reclassify pass).
//   • Current: preprocess truncates before validation; max checks are
//     loose backstops that only fire on pathological output.
export const RATIONALE_DISPLAY_MAX = 1500;
export const RATIONALE_HARD_MAX = 50000;
export const DESCRIPTION_DISPLAY_MAX = 240;
export const DESCRIPTION_HARD_MAX = 5000;

function truncate(s: string, max: number, marker = "…[truncated]"): string {
  if (s.length <= max) return s;
  return s.slice(0, max - marker.length) + marker;
}

const TruncatedRationale = z.preprocess(
  (v) => (typeof v === "string" ? truncate(v, RATIONALE_DISPLAY_MAX) : v),
  z.string().min(10).max(RATIONALE_HARD_MAX),
);

const TruncatedDescription = z.preprocess(
  (v) => (typeof v === "string" ? truncate(v, DESCRIPTION_DISPLAY_MAX) : v),
  z.string().max(DESCRIPTION_HARD_MAX).optional(),
);

export const ClassificationSchema = z.object({
  finalGrade: z.enum(["E0", "E1", "E2", "E3", "E4", "E5"]),
  finalRawScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  rationale: TruncatedRationale,
  suggestedRiskFlag: z.object({
    severity: z.enum(["low", "moderate", "severe", "fatal"]).optional(),
    description: TruncatedDescription,
  }).partial().optional(),
});

export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM = `You are the Evidence Classifier. Re-grade a proposed evidence item against the E0–E5 rubric strictly.

Rubric:
- E0 = no evidence
- E1 = vendor claim only (marketing language without proof)
- E2 = public documentation / trust centre / DPA
- E3 = sandbox/API/public test verification, status page proof
- E4 = production customer reference / case study with named org
- E5 = independent audit, certified benchmark, regulator finding

Hard rules:
- Marketing pages cannot exceed E2 even if confidently worded.
- "SOC 2 Type II" reference on a vendor's own page is E2 (claim of cert) unless the audit report itself is linked.
- "Used by Goldman Sachs" with public case-study URL = E4. Without URL = E1.
- Lower confidence aggressively when wording is ambiguous, dated >12 months, or scope is unclear.
- If the excerpt reveals a fatal/severe risk (e.g. unclear training-data policy on regulated data), set suggestedRiskFlag.`;

const TOOL = {
  name: "classify_evidence",
  description: "Final grade + confidence + optional risk flag for an evidence proposal.",
  jsonSchema: {
    type: "object",
    required: ["finalGrade", "finalRawScore", "confidence", "rationale"],
    properties: {
      finalGrade: { type: "string", enum: ["E0", "E1", "E2", "E3", "E4", "E5"] },
      finalRawScore: { type: "number", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rationale: { type: "string", minLength: 10, maxLength: RATIONALE_HARD_MAX },
      suggestedRiskFlag: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "moderate", "severe", "fatal"] },
          description: { type: "string", maxLength: 240 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
};

export async function classifyEvidence(input: {
  vendorName: string;
  sourceCategory: string;
  sourceUrl: string;
  proposal: ExtractedProposal;
}) {
  const userPrompt = `VENDOR: ${input.vendorName}
SOURCE: ${input.sourceCategory} — ${input.sourceUrl}

PROPOSED EVIDENCE:
- domain: ${input.proposal.domain}
- subfactor: ${input.proposal.subfactor}
- excerpt: """${input.proposal.excerpt}"""
- extractor's proposed grade: ${input.proposal.proposedGrade}
- extractor's proposed raw score: ${input.proposal.proposedRawScore}
- extractor's rationale: ${input.proposal.rationale}

Re-grade conservatively. Adjust raw score if needed. Output a confidence between 0 and 1.`;

  return extractStructured({
    systemPrompt: SYSTEM,
    userPrompt,
    schema: TOOL,
    parse: (raw) => ClassificationSchema.parse(raw),
    maxTokens: 600,
    fallback: () => stubClassify(input.proposal),
  });
}

function stubClassify(p: ExtractedProposal): Classification {
  // Stub: keep extractor's grade but cap at E2 if marketing-like.
  const isMarketing = /marketing|landing|pricing/i.test(p.subfactor);
  const grade = isMarketing && (p.proposedGrade === "E3" || p.proposedGrade === "E4") ? "E2" : p.proposedGrade;
  return {
    finalGrade: grade,
    finalRawScore: p.proposedRawScore,
    confidence: 0.6,
    rationale: "Stub classifier preserved extractor grade with marketing cap.",
  };
}
