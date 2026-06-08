// Sourcing runner — combines manifest + fetcher + extractor + classifier
// + logger into one observable pipeline.
//
// Honest gate behaviour:
//   - DATABASE_URL unset  → `sourcing.gate.skipped` with reason="no_database",
//                           proposals are extracted but not persisted.
//   - ANTHROPIC_API_KEY unset → `sourcing.extract.ok` carries
//                               source="stub", classifier.source="stub" so the
//                               operator can clearly see this run was not LLM-backed.
//
// The runner returns a structured `SourcingRunResult` so callers (CLI / API /
// admin UI) can render a deterministic outcome regardless of the gate state.

import { randomUUID } from "node:crypto";
import { fetchSource } from "../ingestion/fetcher";
import { extractEvidence } from "../agents/evidence-extractor";
import { classifyEvidence } from "../agents/evidence-classifier";
import { hasLLM } from "../agents/llm-client";
import { findReplacementUrl } from "../agents/url-finder";
import { VENDORS as INTELLIGENCE_VENDORS } from "../intelligence/seed-vendors-intel";
import { hasDatabase, getPrisma } from "../prisma";
import { logEvent } from "./logger";
import {
  SOURCE_MANIFEST,
  manifestForVendor,
  type SourceManifestEntry,
} from "./manifest";

// Vendor-id → display-name lookup for the URL-repair agent (matches the
// intelligence seed which uses `vendor_*` IDs).
const VENDOR_NAMES: Record<string, string> = Object.fromEntries(
  INTELLIGENCE_VENDORS.map((v) => [v.id, v.name]),
);

// ─── Classifier failure categorisation ─────────────────────────────────
// The classifier can fail for several distinct reasons. Each category maps
// to a different remediation: a schema mismatch needs a code fix, a credit
// outage needs operator action, a rate limit needs throttling, etc.
// The sourcing runner persists these codes onto EvidenceProposal so the
// reclassification script and admin reports can summarise by cause.

export type ClassifyFailureCode =
  | "schema_validation"          // zod parse failed (e.g. rationale too long)
  | "credit_balance"             // Anthropic billing exhausted
  | "rate_limit"                 // 429 from Anthropic
  | "auth"                       // 401 / missing key
  | "model_not_found"            // bad ANTHROPIC_MODEL
  | "timeout"                    // request timed out
  | "no_tool_use"                // LLM didn't return a tool_use block
  | "network"                    // connect/DNS/TLS failure
  | "unknown";

export interface ClassifyFailure {
  code: ClassifyFailureCode;
  reason: string;
}

export function categoriseClassifyFailure(message: string): ClassifyFailure {
  const m = message ?? "";
  const low = m.toLowerCase();
  // Zod errors are emitted as a JSON-array string. The cheapest detector is
  // the literal "code" key + a known zod issue code.
  if (m.startsWith("[") && /"code"\s*:\s*"(too_big|too_small|invalid_type|invalid_enum|invalid_format)"/.test(m)) {
    return { code: "schema_validation", reason: m.slice(0, 1500) };
  }
  if (/credit balance|insufficient_credit|insufficient credit/i.test(m)) {
    return { code: "credit_balance", reason: m.slice(0, 1500) };
  }
  if (/\b429\b|rate ?limit|too many requests/i.test(m)) {
    return { code: "rate_limit", reason: m.slice(0, 1500) };
  }
  if (/\b401\b|unauthor|invalid api key|missing.*key/i.test(low)) {
    return { code: "auth", reason: m.slice(0, 1500) };
  }
  if (/model.*not.*found|invalid model|unknown model/i.test(low)) {
    return { code: "model_not_found", reason: m.slice(0, 1500) };
  }
  if (/timeout|timed out|etimedout|esockettimedout/i.test(low)) {
    return { code: "timeout", reason: m.slice(0, 1500) };
  }
  if (/tool_use/.test(m)) {
    return { code: "no_tool_use", reason: m.slice(0, 1500) };
  }
  if (/econnreset|enotfound|eai_again|getaddrinfo|certificate|tls/i.test(low)) {
    return { code: "network", reason: m.slice(0, 1500) };
  }
  return { code: "unknown", reason: m.slice(0, 1500) };
}

// Confidence above which a freshly-found replacement URL is auto-retried in
// the same run. Below this we still persist the patch for review but don't
// burn another fetch + LLM call on it.
const AUTO_RETRY_CONFIDENCE = 75;

// HTTP error pattern → numeric status. The fetcher throws strings like
// "HTTP 404 Not Found for ...". Anything 4xx is a candidate for repair.
function extractHttpStatus(message: string): number | null {
  const match = message.match(/HTTP (\d{3})/);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
}

export interface SourceRunOutcome {
  vendorId: string;
  category: string;
  url: string;
  status: "ok" | "fetch_failed" | "extract_failed" | "skipped";
  proposalsExtracted: number;
  proposalsPersisted: number;
  llmSource: "anthropic" | "stub";
  bytes?: number;
  contentHash?: string;
  tokensIn?: number;
  tokensOut?: number;
  durationMs: number;
  error?: string;
}

export interface SourcingRunResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totals: {
    sources: number;
    ok: number;
    failed: number;
    skipped: number;
    proposalsExtracted: number;
    proposalsPersisted: number;
    tokensIn: number;
    tokensOut: number;
    estimatedCostUsd: number;
  };
  llmSource: "anthropic" | "stub";
  databaseConfigured: boolean;
  outcomes: SourceRunOutcome[];
}

export interface RunnerOptions {
  vendorId?: string;            // restrict to one vendor
  sourceUrl?: string;           // restrict to one URL
  // When true, persist proposals to DB if available; when false, dry-run only.
  persist?: boolean;
}

export async function runSourcing(options: RunnerOptions = {}): Promise<SourcingRunResult> {
  const runId = `srun_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const startedAt = new Date();

  const llmSource: "anthropic" | "stub" = hasLLM() ? "anthropic" : "stub";
  const databaseConfigured = hasDatabase();
  const persist = options.persist !== false; // default true

  let entries: SourceManifestEntry[] = options.vendorId
    ? manifestForVendor(options.vendorId)
    : SOURCE_MANIFEST;
  if (options.sourceUrl) {
    entries = entries.filter((e) => e.url === options.sourceUrl);
  }

  await logEvent({
    ts: startedAt.toISOString(),
    runId,
    event: "sourcing.run.start",
    data: {
      vendorId: options.vendorId,
      sourceUrl: options.sourceUrl,
      sources: entries.length,
      llmSource,
      databaseConfigured,
      persist,
    },
  });

  if (!databaseConfigured && persist) {
    await logEvent({
      ts: new Date().toISOString(),
      runId,
      event: "sourcing.gate.skipped",
      data: { reason: "no_database", message: "DATABASE_URL unset; proposals will be extracted but not persisted." },
    });
  }
  if (!hasLLM()) {
    await logEvent({
      ts: new Date().toISOString(),
      runId,
      event: "sourcing.gate.skipped",
      data: { reason: "no_llm", message: "ANTHROPIC_API_KEY unset; the extractor + classifier are running in deterministic STUB mode. Grades are placeholders, not real classifications." },
    });
  }

  const outcomes: SourceRunOutcome[] = [];
  for (const entry of entries) {
    outcomes.push(await runOneSource(runId, entry, persist && databaseConfigured));
  }

  const finishedAt = new Date();
  const totalTokensIn  = outcomes.reduce((s, o) => s + (o.tokensIn  ?? 0), 0);
  const totalTokensOut = outcomes.reduce((s, o) => s + (o.tokensOut ?? 0), 0);
  // Haiku pricing (sourcing always uses Haiku via llm-client.ts)
  const HAIKU_IN = 0.80 / 1_000_000;
  const HAIKU_OUT = 4.00 / 1_000_000;
  const totals = {
    sources: outcomes.length,
    ok: outcomes.filter((o) => o.status === "ok").length,
    failed: outcomes.filter((o) => o.status !== "ok" && o.status !== "skipped").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    proposalsExtracted: outcomes.reduce((s, o) => s + o.proposalsExtracted, 0),
    proposalsPersisted: outcomes.reduce((s, o) => s + o.proposalsPersisted, 0),
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    estimatedCostUsd: parseFloat(((totalTokensIn * HAIKU_IN) + (totalTokensOut * HAIKU_OUT)).toFixed(4)),
  };

  await logEvent({
    ts: finishedAt.toISOString(),
    runId,
    event: "sourcing.run.summary",
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    data: { totals, llmSource, databaseConfigured },
  });

  return {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totals,
    llmSource,
    databaseConfigured,
    outcomes,
  };
}

async function runOneSource(
  runId: string,
  entry: SourceManifestEntry,
  shouldPersist: boolean,
): Promise<SourceRunOutcome> {
  const sourceStart = Date.now();
  const base = { runId, vendorId: entry.vendorId, sourceUrl: entry.url, category: entry.category };

  // ── 1) Fetch ────────────────────────────────────────────────────────────
  const fetchStartTs = new Date().toISOString();
  await logEvent({ ts: fetchStartTs, ...base, event: "sourcing.fetch.start", data: { label: entry.label, expectedDomains: entry.expectedDomains } });

  let fetched;
  try {
    const t0 = Date.now();
    fetched = await fetchSource(entry.url);
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "sourcing.fetch.ok",
      durationMs: Date.now() - t0,
      data: {
        bytes: fetched.byteLength,
        contentType: fetched.contentType,
        contentHash: fetched.contentHash.slice(0, 16),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.fetch.fail", durationMs: Date.now() - sourceStart, error: message });

    // ── 1a) URL repair attempt on 4xx ─────────────────────────────────────
    // The dead URL might just be that the vendor moved their page. Ask the
    // url-finder agent (Claude + web-search) for a current replacement, persist
    // any candidate as a ManifestPatch for operator review, and — if the
    // candidate is high-confidence and on-domain — retry the fetch once.
    const httpStatus = extractHttpStatus(message);
    if (httpStatus && httpStatus >= 400 && httpStatus < 500 && hasLLM()) {
      const repairOutcome = await attemptUrlRepair(entry, httpStatus, { runId, base });
      if (repairOutcome) {
        // Successful retry — return the OK outcome from the recursion.
        return repairOutcome;
      }
    }

    return {
      vendorId: entry.vendorId, category: entry.category, url: entry.url,
      status: "fetch_failed", proposalsExtracted: 0, proposalsPersisted: 0,
      llmSource: hasLLM() ? "anthropic" : "stub",
      durationMs: Date.now() - sourceStart,
      error: message,
    };
  }

  // ── 2) Extract ──────────────────────────────────────────────────────────
  const extractTs = new Date().toISOString();
  await logEvent({ ts: extractTs, ...base, event: "sourcing.extract.start" });

  let extraction;
  try {
    const t0 = Date.now();
    extraction = await extractEvidence({
      vendorName: entry.vendorId,
      vendorCategory: entry.category,
      sourceCategory: entry.category,
      sourceUrl: entry.url,
      rawContent: fetched.rawText,
    });
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "sourcing.extract.ok",
      durationMs: Date.now() - t0,
      data: {
        source: extraction.source,
        proposalsCount: extraction.data.proposals.length,
        usage: extraction.usage,
        proposals: extraction.data.proposals.map((p) => ({
          domain: p.domain, subfactor: p.subfactor, grade: p.proposedGrade,
          rawScore: p.proposedRawScore, excerptLen: p.excerpt.length,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.extract.fail", durationMs: Date.now() - sourceStart, error: message });
    return {
      vendorId: entry.vendorId, category: entry.category, url: entry.url,
      status: "extract_failed", proposalsExtracted: 0, proposalsPersisted: 0,
      llmSource: hasLLM() ? "anthropic" : "stub",
      bytes: fetched.byteLength, contentHash: fetched.contentHash,
      durationMs: Date.now() - sourceStart,
      error: message,
    };
  }

  // ── 3) Classify each proposal ───────────────────────────────────────────
  const classifications = await Promise.all(extraction.data.proposals.map(async (proposal, idx) => {
    try {
      const t0 = Date.now();
      const result = await classifyEvidence({
        vendorName: entry.vendorId,
        sourceCategory: entry.category,
        sourceUrl: entry.url,
        proposal,
      });
      await logEvent({
        ts: new Date().toISOString(), ...base,
        event: "sourcing.classify.ok",
        durationMs: Date.now() - t0,
        data: {
          idx, source: result.source,
          domain: proposal.domain,
          extractorGrade: proposal.proposedGrade,
          classifierGrade: result.data.finalGrade,
          classifierConfidence: result.data.confidence,
          rationale: result.data.rationale.slice(0, 200),
          suggestedRiskFlag: result.data.suggestedRiskFlag,
        },
      });
      return { proposal, classification: result.data, failure: null as ClassifyFailure | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = categoriseClassifyFailure(message);
      await logEvent({
        ts: new Date().toISOString(), ...base,
        event: "sourcing.classify.fail",
        error: message,
        data: { idx, domain: proposal.domain, failureCode: failure.code },
      });
      return { proposal, classification: null, failure };
    }
  }));

  // ── 4) Persist (gated on DB availability + persist flag) ────────────────
  let persistedCount = 0;
  if (shouldPersist) {
    try {
      const t0 = Date.now();
      const client = getPrisma();
      const job = await client.ingestionJob.create({
        data: { vendorId: entry.vendorId, status: "ready_for_review" },
      });
      const now = new Date();
      const data = classifications.map(({ proposal, classification, failure }) => ({
        jobId: job.id,
        vendorId: entry.vendorId,
        domain: proposal.domain,
        subfactor: proposal.subfactor,
        excerpt: proposal.excerpt,
        proposedGrade: classification?.finalGrade ?? proposal.proposedGrade,
        proposedRawScore: classification?.finalRawScore ?? proposal.proposedRawScore,
        sourceUrl: entry.url,
        capturedAt: now,
        // Confidence is 0 (not 0.5) on failure — paired with
        // confidence_is_fallback=true so the triage policy never confuses
        // a real low-confidence call with a missing classification.
        classifierConfidence: classification?.confidence ?? 0,
        classifierRationale: classification?.rationale ?? null,
        classificationFailed: classification === null,
        classificationFailureCode: failure?.code ?? null,
        classificationFailureReason: failure?.reason ?? null,
        confidenceIsFallback: classification === null,
        status: "pending" as const,
      }));
      const created = await client.evidenceProposal.createMany({ data });
      persistedCount = created.count;
      await client.ingestionJob.update({
        where: { id: job.id },
        data: {
          rawContent: fetched.rawText.slice(0, 200_000),
          rawContentHash: fetched.contentHash,
          proposalsCount: persistedCount,
          finishedAt: new Date(),
        },
      });
      await logEvent({
        ts: new Date().toISOString(), ...base,
        event: "sourcing.persist.ok",
        durationMs: Date.now() - t0,
        data: { jobId: job.id, persistedCount },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.persist.fail", error: message });
    }
  }

  return {
    vendorId: entry.vendorId, category: entry.category, url: entry.url,
    status: "ok",
    proposalsExtracted: extraction.data.proposals.length,
    proposalsPersisted: persistedCount,
    llmSource: extraction.source,
    bytes: fetched.byteLength,
    contentHash: fetched.contentHash,
    tokensIn:  extraction.usage.inputTokens,
    tokensOut: extraction.usage.outputTokens,
    durationMs: Date.now() - sourceStart,
  };
}

/**
 * Run the URL-repair agent on a dead manifest entry, persist the proposed
 * replacement as a ManifestPatch, and (if confidence is high enough AND the
 * candidate is on the vendor's apex domain) retry the fetch once with the new
 * URL — recursing into runSourceEntry with a synthesised manifest entry.
 *
 * Returns:
 *   - SourceRunOutcome (status="ok"): the retry succeeded; caller should
 *     return this directly so the final summary counts it as ok.
 *   - null: the repair attempt did not produce a usable URL or the retry
 *     failed; caller should fall through to the normal fetch_failed outcome.
 */
async function attemptUrlRepair(
  entry: SourceManifestEntry,
  httpStatus: number,
  ctx: { runId: string; base: { runId: string; vendorId: string; sourceUrl: string; category: string } },
): Promise<SourceRunOutcome | null> {
  const { runId, base } = ctx;
  const repairTs = new Date().toISOString();
  await logEvent({ ts: repairTs, ...base, event: "sourcing.repair.start" });

  const vendorName = VENDOR_NAMES[entry.vendorId] ?? entry.vendorId.replace(/^vendor_/, "");
  let repair;
  try {
    repair = await findReplacementUrl({
      vendorId: entry.vendorId,
      vendorName,
      category: String(entry.category),
      deadUrl: entry.url,
      httpStatus,
    });
  } catch (err) {
    await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.repair.error", error: err instanceof Error ? err.message : String(err) });
    return null;
  }

  if (!repair.candidate) {
    await logEvent({
      ts: new Date().toISOString(), ...base,
      event: "sourcing.repair.no_candidate",
      data: { rejectedReason: repair.rejectedReason ?? "no_candidate", searchesUsed: repair.searchesUsed },
    });
    return null;
  }

  // Persist the patch (best-effort — DB might be unavailable).
  if (hasDatabase()) {
    try {
      await getPrisma().manifestPatch.upsert({
        where: { vendorId_deadUrl_status: { vendorId: entry.vendorId, deadUrl: entry.url, status: "pending" } },
        update: {
          candidateUrl: repair.candidate.candidateUrl,
          candidateTitle: repair.candidate.title,
          confidenceScore: repair.candidate.confidenceScore,
          rationale: repair.candidate.rationale,
          citations: repair.candidate.citations,
          httpStatus,
          searchesUsed: repair.searchesUsed,
        },
        create: {
          vendorId: entry.vendorId,
          vendorName,
          category: String(entry.category),
          deadUrl: entry.url,
          httpStatus,
          candidateUrl: repair.candidate.candidateUrl,
          candidateTitle: repair.candidate.title,
          confidenceScore: repair.candidate.confidenceScore,
          rationale: repair.candidate.rationale,
          citations: repair.candidate.citations,
          llmSource: repair.llmSource,
          searchesUsed: repair.searchesUsed,
          status: "pending",
          retryAttempted: false,
        },
      });
    } catch (err) {
      await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.repair.persist_failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  await logEvent({
    ts: new Date().toISOString(), ...base,
    event: "sourcing.repair.candidate",
    data: {
      candidateUrl: repair.candidate.candidateUrl,
      confidenceScore: repair.candidate.confidenceScore,
      searchesUsed: repair.searchesUsed,
    },
  });

  // High-confidence + on-domain → try the new URL once. Lower-confidence
  // candidates are persisted but not auto-applied; operator approves at
  // /admin/ingestion before they go live.
  if (repair.candidate.confidenceScore < AUTO_RETRY_CONFIDENCE) {
    return null;
  }

  const synthesizedEntry: SourceManifestEntry = { ...entry, url: repair.candidate.candidateUrl };
  const retried = await runOneSource(runId, synthesizedEntry, hasDatabase());

  // Mark the patch retry result on the persisted record.
  if (hasDatabase()) {
    try {
      await getPrisma().manifestPatch.updateMany({
        where: { vendorId: entry.vendorId, deadUrl: entry.url, status: "pending" },
        data: { retryAttempted: true, retryOk: retried.status === "ok" },
      });
    } catch {
      // non-fatal
    }
  }

  if (retried.status === "ok") {
    await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.repair.retry_ok", data: { newUrl: repair.candidate.candidateUrl, proposalsPersisted: retried.proposalsPersisted } });
    return retried;
  }

  await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.repair.retry_failed", error: retried.error ?? "unknown" });
  return null;
}
