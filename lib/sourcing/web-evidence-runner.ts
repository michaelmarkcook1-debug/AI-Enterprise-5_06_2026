// Roster-driven, web_search-based EVIDENCE sourcing.
// ───────────────────────────────────────────────────
// The curated manifest only covers vendors we have hand-authored source URLs
// for, so vendors without manifest entries never accrue pillar evidence and
// their scores float at un-audited seed baselines. This runner closes that gap
// FACTUALLY: for ANY vendor (driven by the live roster, so new vendors are
// covered automatically), it uses web_search to DISCOVER real, citeable sources
// across the pillar domains, then runs every finding through the SAME
// conservative classifier + triage + projection path the manifest sourcing
// uses. Each proposal carries the exact https:// URL web_search fetched — no
// fabricated URLs, no synthesized scores, no inventing evidence that isn't there.
//
// web_search call shape mirrors the proven competitive-monitor Stage 1
// (allowed_callers: ["direct"] + pause-continuation loop) to avoid the documented
// 400 / silent-zero-findings failure modes.

import Anthropic from "@anthropic-ai/sdk";
import { getPrisma, hasDatabase } from "../prisma";
import { classifyEvidence } from "../agents/evidence-classifier";
import type { ExtractedProposal } from "../agents/evidence-extractor";

const HAIKU_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-haiku-4-5";
const WEB_SEARCH_TOOL_TYPE = "web_search_20260209" as const;
const MAX_SEARCHES_PER_VENDOR = 5;
const MAX_PAUSE_CONTINUATIONS = 3;
const MAX_FINDINGS = 12;

// The 13 backend domains (lib/types.ts DomainId). Every finding must map to one.
const DOMAIN_IDS = [
  "strategic_value", "data_security_privacy", "identity_access", "model_reliability",
  "governance_compliance", "security_threat", "integration_architecture", "agentic_autonomy",
  "cost_finops", "workforce_adoption", "vendor_maturity_lockin", "capital_resilience", "market_position",
] as const;
type DomainEnum = (typeof DOMAIN_IDS)[number];

const FINDINGS_SCHEMA = {
  name: "report_evidence_findings",
  description: "Report evidence proposals discovered via web search, each with the exact source URL fetched.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            domain: { type: "string", enum: [...DOMAIN_IDS] },
            subfactor: { type: "string", description: "Short label for what the evidence concerns." },
            excerpt: { type: "string", description: "Verbatim quote copied from the source page." },
            proposedGrade: { type: "string", enum: ["E0", "E1", "E2", "E3", "E4", "E5"] },
            proposedRawScore: { type: "number", minimum: 0, maximum: 100 },
            rationale: { type: "string", minLength: 10, maxLength: 400 },
            sourceUrl: { type: "string", description: "Exact https:// URL fetched for this finding." },
          },
          required: ["domain", "subfactor", "excerpt", "proposedGrade", "proposedRawScore", "rationale", "sourceUrl"],
          additionalProperties: false,
        },
      },
    },
    required: ["findings"],
    additionalProperties: false,
  },
};

interface WebFinding extends ExtractedProposal {
  sourceUrl: string;
}

export interface WebEvidenceResult {
  vendorId: string;
  findings: number;
  persisted: number;
  searchesUsed: number;
  source: "anthropic" | "stub";
  error?: string;
  noFindingsReason?: string;
}

const SYSTEM = `You are an enterprise-AI evidence researcher for an analyst platform whose scores drive REAL corporate buying decisions. Use web_search to find real, citeable evidence about the vendor across the enterprise dimensions below, then call report_evidence_findings.

DIMENSIONS (return the domain id):
- data_security_privacy / governance_compliance / identity_access — certifications (SOC 2, ISO 27001/42001, HIPAA, FedRAMP), DPAs, data residency, SSO/SCIM, audit logging.
- model_reliability / security_threat — published evals & benchmarks, safety frameworks, incident & uptime history, red-teaming, disclosed CVEs.
- integration_architecture / agentic_autonomy / cost_finops — APIs/SDKs, deployment options, agent/tool support, pricing transparency & cost controls.
- vendor_maturity_lockin / capital_resilience — company maturity, funding/financials, ownership, viability, portability/exit.
- strategic_value / workforce_adoption / market_position — enterprise use cases, customer references/case studies, market traction.

RULES (non-negotiable — this is a factual product):
- Cite the EXACT https:// URL you fetched in sourceUrl, and include a VERBATIM excerpt copied from that page.
- Grade by source type: E5 = independent audit / certification / third-party benchmark; E4 = first-party authoritative doc (trust center, official docs/changelog); E3 = reputable third-party reporting; E2 = vendor claim with specifics; E1 = marketing language; E0 = rumor/unverified.
- proposedRawScore (0-100) reflects ONLY how strongly the cited source supports the vendor on that dimension. Do NOT infer beyond what the source states.
- If you cannot find real evidence for a dimension, OMIT it. NEVER invent a source, URL, excerpt, or score. Returning fewer findings is correct when evidence is thin.`;

/**
 * Discover + persist real web-sourced evidence for one vendor. Idempotent at the
 * proposal layer (each run creates a fresh ingestion job + pending proposals;
 * downstream triage/projection are idempotent upserts). Returns a stub result
 * (no error thrown) when the API key is missing so the caller degrades cleanly.
 */
export async function runWebEvidenceSourcing(
  vendorId: string,
  vendorName: string,
  opts: { persist?: boolean } = {},
): Promise<WebEvidenceResult> {
  const persist = opts.persist ?? true;
  const stub: WebEvidenceResult = { vendorId, findings: 0, persisted: 0, searchesUsed: 0, source: "stub" };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ...stub, error: "ANTHROPIC_API_KEY not configured" };
  const client = new Anthropic({ apiKey: key });

  const tools = [
    { type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: MAX_SEARCHES_PER_VENDOR, allowed_callers: ["direct"] } as unknown as Anthropic.Tool,
    FINDINGS_SCHEMA as unknown as Anthropic.Tool,
  ];
  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `Vendor: ${vendorName}.
Use up to ${MAX_SEARCHES_PER_VENDOR} web_search calls to find real enterprise-AI evidence across the listed dimensions — prefer first-party docs / trust centers and reputable third-party sources. Then call report_evidence_findings with up to ${MAX_FINDINGS} items. Set sourceUrl to the exact https:// URL you fetched for each.`,
  }];

  let searchesUsed = 0;
  let stopReason = "";
  const blocks: Anthropic.ToolUseBlock[] = [];
  try {
    for (let attempt = 0; attempt <= MAX_PAUSE_CONTINUATIONS; attempt++) {
      const r = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        tools,
        messages,
      } as unknown as Anthropic.MessageCreateParamsNonStreaming);
      searchesUsed += (r.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
      stopReason = r.stop_reason ?? "";
      for (const b of r.content) {
        if (b.type === "tool_use" && b.name === "report_evidence_findings") blocks.push(b as Anthropic.ToolUseBlock);
      }
      if (r.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: r.content });
    }
  } catch (err) {
    return { ...stub, source: "anthropic", searchesUsed, error: err instanceof Error ? err.message : String(err) };
  }

  const findings: WebFinding[] = blocks
    .flatMap((b) => ((b.input as { findings?: WebFinding[] })?.findings ?? []))
    .filter((f) =>
      f && typeof f.sourceUrl === "string" && f.sourceUrl.startsWith("https://")
      && typeof f.excerpt === "string" && f.excerpt.trim().length > 0
      && DOMAIN_IDS.includes(f.domain as DomainEnum))
    .slice(0, MAX_FINDINGS);

  if (findings.length === 0) {
    const reason = stopReason === "pause_turn"
      ? `web_search paused after ${MAX_PAUSE_CONTINUATIONS} continuations`
      : searchesUsed === 0
        ? "no web_search performed — web search may be disabled/ungated on this key or plan"
        : "web_search ran but returned no citeable evidence";
    return { ...stub, source: "anthropic", searchesUsed, noFindingsReason: reason };
  }

  if (!persist || !hasDatabase()) {
    return { vendorId, findings: findings.length, persisted: 0, searchesUsed, source: "anthropic" };
  }

  // Calibrate each finding through the SAME conservative classifier the manifest
  // path uses, then persist as pending proposals. The existing safe-linkage +
  // triage steps promote E2+ to analyst_verified EvidenceRecord rows, which the
  // projector folds into pillar scores — so web-sourced evidence moves the
  // ranking exactly like manifest-sourced evidence.
  const prisma = getPrisma();
  const job = await prisma.ingestionJob.create({ data: { vendorId, status: "ready_for_review" } });
  const now = new Date();

  const rows = [];
  for (const f of findings) {
    const proposal: ExtractedProposal = {
      domain: f.domain,
      subfactor: f.subfactor,
      excerpt: f.excerpt.slice(0, 2000),
      proposedGrade: f.proposedGrade,
      proposedRawScore: f.proposedRawScore,
      rationale: f.rationale,
    };
    let cls: Awaited<ReturnType<typeof classifyEvidence>>["data"] | null = null;
    try {
      cls = (await classifyEvidence({ vendorName, sourceCategory: "analyst_report", sourceUrl: f.sourceUrl, proposal })).data;
    } catch {
      cls = null;
    }
    rows.push({
      jobId: job.id,
      vendorId,
      domain: proposal.domain,
      subfactor: proposal.subfactor,
      excerpt: proposal.excerpt,
      proposedGrade: cls?.finalGrade ?? proposal.proposedGrade,
      proposedRawScore: cls?.finalRawScore ?? proposal.proposedRawScore,
      sourceUrl: f.sourceUrl,
      capturedAt: now,
      classifierConfidence: cls?.confidence ?? 0,
      classifierRationale: cls?.rationale ?? null,
      classificationFailed: cls === null,
      classificationFailureCode: null,
      classificationFailureReason: null,
      confidenceIsFallback: cls === null,
      status: "pending" as const,
    });
  }

  const created = await prisma.evidenceProposal.createMany({ data: rows });
  await prisma.ingestionJob.update({
    where: { id: job.id },
    data: { proposalsCount: created.count, finishedAt: new Date() },
  });

  return { vendorId, findings: findings.length, persisted: created.count, searchesUsed, source: "anthropic" };
}

export interface WebEvidenceSweepResult {
  vendorsAttempted: number;
  vendorsWithFindings: number;
  proposalsPersisted: number;
  totalSearches: number;
  errors: { vendorId: string; error: string }[];
}

/**
 * Run web evidence sourcing across a set of vendors with bounded concurrency
 * (keeps total runtime well under the function timeout and avoids hammering the
 * API). Vendors are supplied by the caller (roster-driven), so coverage follows
 * the live universe with no hand-maintained list.
 */
export async function runWebEvidenceSweep(
  vendors: { id: string; name: string }[],
  opts: {
    concurrency?: number;
    /** Called after each vendor finishes — used as a background-job heartbeat
     *  + progress snapshot so a long sweep isn't mistaken for crashed. */
    onProgress?: (done: number, total: number, vendor: string) => void | Promise<void>;
  } = {},
): Promise<WebEvidenceSweepResult> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const results: WebEvidenceResult[] = [];
  const total = vendors.length;
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < vendors.length) {
      const v = vendors[cursor++];
      const r = await runWebEvidenceSourcing(v.id, v.name);
      results.push(r);
      done += 1;
      if (opts.onProgress) await opts.onProgress(done, total, v.name);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, vendors.length) }, worker));

  return {
    vendorsAttempted: results.length,
    vendorsWithFindings: results.filter((r) => r.findings > 0).length,
    proposalsPersisted: results.reduce((s, r) => s + r.persisted, 0),
    totalSearches: results.reduce((s, r) => s + r.searchesUsed, 0),
    errors: results.flatMap((r) => (r.error ? [{ vendorId: r.vendorId, error: r.error }] : [])),
  };
}
