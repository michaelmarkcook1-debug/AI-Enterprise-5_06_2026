// Vendor Evidence Extractor agent (spec §15).
// Input:  vendor metadata + raw fetched content (HTML/text from a source URL).
// Output: structured EvidenceProposal[] tagged by domain/subfactor with excerpt + URL + grade.
// Guardrails (spec §15): must include source URL/date and direct excerpt; no unsupported claims.

import { z } from "zod";
import { extractStructured } from "./llm-client";
import type { DomainId, EvidenceGrade } from "../types";

export const EvidenceProposalSchema = z.object({
  domain: z.enum([
    "strategic_value",
    "data_security_privacy",
    "identity_access",
    "model_reliability",
    "governance_compliance",
    "security_threat",
    "integration_architecture",
    "agentic_autonomy",
    "cost_finops",
    "workforce_adoption",
    "vendor_maturity_lockin",
    "capital_resilience",
    "market_position",
    "sovereignty_residency",
  ]),
  subfactor: z.string().min(2).max(80),
  excerpt: z.string().min(20).max(800),
  proposedGrade: z.enum(["E0", "E1", "E2", "E3", "E4", "E5"]),
  proposedRawScore: z.number().min(0).max(100),
  rationale: z.string().min(10).max(400),
});

export const ExtractionResponseSchema = z.object({
  proposals: z.array(EvidenceProposalSchema).max(20),
});

export type ExtractedProposal = z.infer<typeof EvidenceProposalSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export const EXTRACTOR_SYSTEM_PROMPT = `You are the Vendor Evidence Extractor for an enterprise AI platform ranking engine.

Your job is to read raw vendor source content (docs, trust centre, pricing, status page, changelog, filings, jobs, reviews, etc.) and emit STRUCTURED EVIDENCE ITEMS — one per discrete capability claim or proof point — that map to the v2.0 framework's 12 backend domains.

Hard rules:
1. Only emit a proposal if you can quote a SHORT direct EXCERPT (<= 600 chars) from the supplied content. Never invent.
2. Pick the SINGLE best domain per proposal. Do not duplicate across domains.
3. Grade conservatively per the E0–E5 scale:
   - E0 = no evidence
   - E1 = vendor marketing claim only ("we offer..." with no proof)
   - E2 = public documentation / trust centre listing
   - E3 = sandbox/API/public test confirms behaviour, OR a status page shows it working
   - E4 = production customer reference / case study with named customer
   - E5 = independent audit, certified benchmark, regulator finding, third-party validation
   Vendor marketing pages are NEVER above E2. Press releases are E1–E2.
4. proposedRawScore is your 0–100 capability assertion implied by the excerpt — independent of grade. A glowing claim is still a claim.
5. Limit to 8 high-signal proposals per pass. Skip filler.
6. Use snake_case domain ids exactly.

Domain quick-reference:
- strategic_value: use-case fit, sector fit, workflow depth
- data_security_privacy: training data policy, residency, retention, subprocessors, DLP
- identity_access: SSO/SCIM/RBAC, source-permission inheritance
- model_reliability: factuality, citations, hallucination, refusal of unsupported answers
- governance_compliance: audit logs, EU AI Act, decision reconstructability
- security_threat: prompt injection, exfiltration controls, pen-tests
- integration_architecture: connectors, APIs, model portability
- agentic_autonomy: approval gates, tool scoping, kill switch, simulation mode
- cost_finops: pricing transparency, usage volatility, caps, chargeback
- workforce_adoption: training, change-mgmt, friction
- vendor_maturity_lockin: platform depth, exportability, deprecation
- capital_resilience: runway proxy, infra dependency, ownership
- market_position: category share, sector adoption, momentum`;

export const EXTRACTOR_TOOL_SCHEMA = {
  name: "emit_evidence_proposals",
  description: "Emit structured evidence proposals extracted from vendor source content.",
  jsonSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          required: ["domain", "subfactor", "excerpt", "proposedGrade", "proposedRawScore", "rationale"],
          properties: {
            domain: { type: "string", enum: [
              "strategic_value", "data_security_privacy", "identity_access", "model_reliability",
              "governance_compliance", "security_threat", "integration_architecture",
              "agentic_autonomy", "cost_finops", "workforce_adoption", "vendor_maturity_lockin",
              "capital_resilience", "market_position",
            ] },
            subfactor: { type: "string", minLength: 2, maxLength: 80 },
            excerpt: { type: "string", minLength: 20, maxLength: 800 },
            proposedGrade: { type: "string", enum: ["E0", "E1", "E2", "E3", "E4", "E5"] },
            proposedRawScore: { type: "number", minimum: 0, maximum: 100 },
            rationale: { type: "string", minLength: 10, maxLength: 400 },
          },
        },
      },
    },
    required: ["proposals"],
    additionalProperties: false,
  },
};

export interface ExtractInput {
  vendorName: string;
  vendorCategory: string;
  sourceCategory: string;
  sourceUrl: string;
  rawContent: string;
}

/** The user-prompt for one source. Shared verbatim by the synchronous path
 * (extractEvidence) and the Batch API path (lib/sourcing/batch-runner.ts) so the
 * two NEVER drift on what the model is asked to do. */
export function buildExtractorUserPrompt(input: ExtractInput): string {
  return `VENDOR: ${input.vendorName} (${input.vendorCategory})
SOURCE CATEGORY: ${input.sourceCategory}
SOURCE URL: ${input.sourceUrl}

RAW CONTENT (truncate-safe):
"""
${input.rawContent.slice(0, 28_000)}
"""

Extract the highest-signal evidence proposals. Skip navigation, footers, cookie banners, generic marketing fluff.`;
}

/** Max output tokens for one extraction — shared by both paths. */
export const EXTRACTOR_MAX_TOKENS = 6000;

/** Validate a raw tool-input payload into the typed extraction response.
 * Used by the Batch API collector to parse each result the same way the
 * synchronous path does. */
export function parseExtraction(raw: unknown): ExtractionResponse {
  return ExtractionResponseSchema.parse(raw);
}

export async function extractEvidence(input: ExtractInput) {
  return extractStructured({
    systemPrompt: EXTRACTOR_SYSTEM_PROMPT,
    userPrompt: buildExtractorUserPrompt(input),
    schema: EXTRACTOR_TOOL_SCHEMA,
    parse: parseExtraction,
    maxTokens: EXTRACTOR_MAX_TOKENS,
    fallback: () => stubExtraction(input),
  });
}

// Deterministic stub — used when ANTHROPIC_API_KEY is unset. Returns one
// representative proposal per source category so the pipeline is testable.
function stubExtraction(input: ExtractInput): ExtractionResponse {
  const sample: Partial<Record<string, ExtractedProposal>> = {
    trust_center: {
      domain: "data_security_privacy",
      subfactor: "Trust centre disclosures",
      excerpt: input.rawContent.slice(0, 240) || "Trust centre lists certifications and subprocessors.",
      proposedGrade: "E2",
      proposedRawScore: 70,
      rationale: "Public trust centre confirms documentation; treat as E2 absent independent audit.",
    },
    pricing_page: {
      domain: "cost_finops",
      subfactor: "Public pricing transparency",
      excerpt: input.rawContent.slice(0, 240) || "Pricing page lists per-seat tiers.",
      proposedGrade: "E2",
      proposedRawScore: 65,
      rationale: "Public pricing supports cost-finops scoring.",
    },
    status_page: {
      domain: "integration_architecture",
      subfactor: "Public availability history",
      excerpt: input.rawContent.slice(0, 240) || "Status page shows historical incidents and uptime.",
      proposedGrade: "E3",
      proposedRawScore: 75,
      rationale: "Live status page constitutes a public test of platform operations.",
    },
    changelog: {
      domain: "market_position",
      subfactor: "Roadmap delivery cadence",
      excerpt: input.rawContent.slice(0, 240) || "Changelog shows recent release activity.",
      proposedGrade: "E3",
      proposedRawScore: 78,
      rationale: "Frequent releases verified via public changelog support delivery credibility.",
    },
    public_filing: {
      domain: "capital_resilience",
      subfactor: "Public filing financial health",
      excerpt: input.rawContent.slice(0, 240) || "Filing confirms revenue and runway.",
      proposedGrade: "E5",
      proposedRawScore: 88,
      rationale: "Filed financials constitute independently-attested evidence.",
    },
  };
  const fallback: ExtractedProposal = {
    domain: "strategic_value",
    subfactor: "General source signal",
    excerpt: input.rawContent.slice(0, 240) || `Stub extraction for ${input.vendorName}.`,
    proposedGrade: "E1",
    proposedRawScore: 55,
    rationale: "Stub extractor; replace with live LLM by setting ANTHROPIC_API_KEY.",
  };
  return { proposals: [sample[input.sourceCategory] ?? fallback] };
}

export function asEvidenceCoreFields(p: ExtractedProposal): {
  domain: DomainId; grade: EvidenceGrade; rawScore: number; subfactor: string; excerpt: string;
} {
  return {
    domain: p.domain as DomainId,
    grade: p.proposedGrade as EvidenceGrade,
    rawScore: p.proposedRawScore,
    subfactor: p.subfactor,
    excerpt: p.excerpt,
  };
}
