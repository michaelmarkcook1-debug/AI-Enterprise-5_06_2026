// Evidence Classifier (spec §15). Re-grades a candidate proposal conservatively
// against the E0–E5 rubric and outputs a confidence score + rationale. This runs
// as a second pass over extractor output and on analyst override requests.

import { z } from "zod";
import { extractStructured } from "./llm-client";
import type { ExtractedProposal } from "./evidence-extractor";

export const ClassificationSchema = z.object({
  finalGrade: z.enum(["E0", "E1", "E2", "E3", "E4", "E5"]),
  finalRawScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(10).max(400),
  suggestedRiskFlag: z.object({
    severity: z.enum(["low", "moderate", "severe", "fatal"]).optional(),
    description: z.string().max(240).optional(),
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
      rationale: { type: "string", minLength: 10, maxLength: 400 },
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
