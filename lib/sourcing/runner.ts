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
import { hasDatabase, getPrisma } from "../prisma";
import { logEvent } from "./logger";
import {
  SOURCE_MANIFEST,
  manifestForVendor,
  type SourceManifestEntry,
} from "./manifest";

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
  const totals = {
    sources: outcomes.length,
    ok: outcomes.filter((o) => o.status === "ok").length,
    failed: outcomes.filter((o) => o.status !== "ok" && o.status !== "skipped").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    proposalsExtracted: outcomes.reduce((s, o) => s + o.proposalsExtracted, 0),
    proposalsPersisted: outcomes.reduce((s, o) => s + o.proposalsPersisted, 0),
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
      return { proposal, classification: result.data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logEvent({ ts: new Date().toISOString(), ...base, event: "sourcing.classify.fail", error: message, data: { idx, domain: proposal.domain } });
      return { proposal, classification: null };
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
      const data = classifications.map(({ proposal, classification }) => ({
        jobId: job.id,
        vendorId: entry.vendorId,
        domain: proposal.domain,
        subfactor: proposal.subfactor,
        excerpt: proposal.excerpt,
        proposedGrade: classification?.finalGrade ?? proposal.proposedGrade,
        proposedRawScore: classification?.finalRawScore ?? proposal.proposedRawScore,
        sourceUrl: entry.url,
        capturedAt: now,
        classifierConfidence: classification?.confidence ?? 0.5,
        classifierRationale: classification?.rationale ?? proposal.rationale,
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
    durationMs: Date.now() - sourceStart,
  };
}
