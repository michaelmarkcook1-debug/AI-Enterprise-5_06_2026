// Two-phase Batch API sourcing.
// ─────────────────────────────
// Anthropic's Message Batches API is ~50% cheaper than real-time but async (up
// to a 24h SLA), so it can't complete inside one 600s cron run. This module
// splits sourcing across two cron cycles, WITHOUT touching the synchronous path
// in runner.ts:
//
//   submitExtractionBatch()    — cron run N: fetch source URLs (HTTP, no LLM),
//                                submit ONE batch of extraction requests, record
//                                the batch id + per-request context.
//   collectExtractionBatches() — cron run N+1: for each ended batch, fetch
//                                results, classify (cheap, synchronous) + persist
//                                proposals exactly as the sync path does.
//
// Gated entirely behind SOURCING_BATCH_MODE=1 (see lib/system/daily-refresh.ts).
// Default OFF → the proven synchronous runner is unchanged. The extraction
// prompt/schema are imported from evidence-extractor.ts so the two paths can
// never drift on what the model is asked to do.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { SOURCE_MANIFEST, manifestForVendor, type SourceManifestEntry } from "./manifest";
import { fetchSource } from "../ingestion/fetcher";
import {
  EXTRACTOR_SYSTEM_PROMPT,
  EXTRACTOR_TOOL_SCHEMA,
  EXTRACTOR_MAX_TOKENS,
  buildExtractorUserPrompt,
  parseExtraction,
} from "../agents/evidence-extractor";
import { classifyEvidence } from "../agents/evidence-classifier";
import { categoriseClassifyFailure, type ClassifyFailure } from "./runner";
import { getPrisma, hasDatabase } from "../prisma";
import { PRICES, BATCH_DISCOUNT } from "../ingestion/cost-model";
import {
  recordSubmittedBatch,
  listPendingBatches,
  markBatchCollected,
  markBatchFailed,
  type BatchRequestContext,
} from "./batch-store";

const EXTRACT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-haiku-4-5";
const HAIKU_IN = PRICES.haiku.inputPerMTok / 1_000_000;
const HAIKU_OUT = PRICES.haiku.outputPerMTok / 1_000_000;
// Reap batches that never finish: the Batches API SLA is 24h, so anything still
// unfinished past this is treated as failed rather than re-checked forever.
const MAX_BATCH_AGE_HOURS = 25;

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/** Build the exact Messages-API params for one extraction, as a batch request
 * item. Mirrors lib/agents/llm-client.ts extractStructured (forced tool, cached
 * system prompt) so the batch path produces identical extractions. */
export function buildExtractionRequest(
  customId: string,
  entry: SourceManifestEntry,
  rawContent: string,
): Anthropic.Messages.Batches.BatchCreateParams.Request {
  return {
    custom_id: customId,
    params: {
      model: EXTRACT_MODEL,
      max_tokens: EXTRACTOR_MAX_TOKENS,
      system: [{ type: "text", text: EXTRACTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [
        {
          name: EXTRACTOR_TOOL_SCHEMA.name,
          description: EXTRACTOR_TOOL_SCHEMA.description,
          input_schema: EXTRACTOR_TOOL_SCHEMA.jsonSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: EXTRACTOR_TOOL_SCHEMA.name },
      messages: [
        {
          role: "user",
          content: buildExtractorUserPrompt({
            vendorName: entry.vendorId,
            vendorCategory: entry.category,
            sourceCategory: entry.category,
            sourceUrl: entry.url,
            rawContent,
          }),
        },
      ],
    },
  };
}

export interface BatchSubmitResult {
  ok: boolean;
  batchId: string | null;
  submitted: number;
  fetchFailed: number;
  skipped?: string;
}

/**
 * Phase 1 — fetch source content and submit ONE extraction batch.
 * No classification, no persistence here; that's phase 2.
 */
export async function submitExtractionBatch(
  opts: { runId?: string; vendorId?: string; allVendors?: boolean } = {},
): Promise<BatchSubmitResult> {
  const client = getClient();
  if (!client) return { ok: false, batchId: null, submitted: 0, fetchFailed: 0, skipped: "no_llm" };
  if (!hasDatabase()) return { ok: false, batchId: null, submitted: 0, fetchFailed: 0, skipped: "no_database" };

  const runId = opts.runId ?? `bsub_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

  // Entry selection mirrors runSourcing: one vendor, all vendors, or today's rotation.
  let entries: SourceManifestEntry[];
  if (opts.vendorId) {
    entries = manifestForVendor(opts.vendorId);
  } else if (opts.allVendors) {
    entries = SOURCE_MANIFEST;
  } else {
    const vendorIds = [...new Set(SOURCE_MANIFEST.map((e) => e.vendorId))].sort();
    const rotation = vendorIds[Math.floor(Date.now() / 86_400_000) % vendorIds.length];
    entries = manifestForVendor(rotation);
  }

  // Fetch all source content with bounded concurrency (HTTP only, no LLM cost).
  const CONCURRENCY = Math.max(1, Number(process.env.SOURCE_CONCURRENCY) || 5);
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
  const requestMap: Record<string, BatchRequestContext> = {};
  let fetchFailed = 0;
  let cursor = 0;
  async function worker() {
    let i: number;
    while ((i = cursor++) < entries.length) {
      const entry = entries[i];
      try {
        const fetched = await fetchSource(entry.url);
        const customId = `s${i}`;
        requests.push(buildExtractionRequest(customId, entry, fetched.rawText));
        requestMap[customId] = { vendorId: entry.vendorId, category: entry.category, sourceUrl: entry.url };
      } catch {
        fetchFailed += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, () => worker()));

  if (requests.length === 0) {
    return { ok: false, batchId: null, submitted: 0, fetchFailed, skipped: "no_fetchable_sources" };
  }

  const batch = await client.messages.batches.create({ requests });
  await recordSubmittedBatch({
    batchId: batch.id,
    runId,
    sourceCount: requests.length,
    requestMap,
  });

  return { ok: true, batchId: batch.id, submitted: requests.length, fetchFailed };
}

export interface BatchCollectResult {
  batchesChecked: number;
  batchesCollected: number;
  stillPending: number;
  /** Requests that came back errored/expired/canceled (still billed; no token
   * data is exposed for them, so estimatedCostUsd is a lower bound when > 0). */
  failedExtractions: number;
  proposalsPersisted: number;
  tokensIn: number;
  tokensOut: number;
  /** Extraction cost AFTER the batch discount + synchronous classify cost. */
  estimatedCostUsd: number;
  errors: string[];
}

/**
 * Phase 2 — collect any ended batches, classify each extracted proposal
 * (synchronous, cheap) and persist exactly as the synchronous runner does.
 * Batches still processing are left for a later run.
 */
export async function collectExtractionBatches(): Promise<BatchCollectResult> {
  const client = getClient();
  const result: BatchCollectResult = {
    batchesChecked: 0,
    batchesCollected: 0,
    stillPending: 0,
    failedExtractions: 0,
    proposalsPersisted: 0,
    tokensIn: 0,
    tokensOut: 0,
    estimatedCostUsd: 0,
    errors: [],
  };
  if (!client || !hasDatabase()) return result;

  const pending = await listPendingBatches();
  const prisma = getPrisma();
  let extractTokensIn = 0;
  let extractTokensOut = 0;
  let classifyTokensIn = 0;
  let classifyTokensOut = 0;

  for (const job of pending) {
    result.batchesChecked += 1;
    // Per-batch token tallies so multiple pending batches don't cross-charge.
    let bExtractIn = 0, bExtractOut = 0, bClassifyIn = 0, bClassifyOut = 0, bFailed = 0;
    try {
      const batch = await client.messages.batches.retrieve(job.batchId);
      if (batch.processing_status !== "ended") {
        // Reap batches stuck past the 24h SLA so they don't accumulate as
        // orphaned rows re-checked every cycle forever.
        const ageHours = (Date.now() - new Date(job.submittedAt).getTime()) / 3_600_000;
        if (ageHours > MAX_BATCH_AGE_HOURS) {
          await markBatchFailed(job.id, `stuck in '${batch.processing_status}' for ${ageHours.toFixed(0)}h (>${MAX_BATCH_AGE_HOURS}h SLA)`);
          result.errors.push(`${job.batchId}: stuck ${ageHours.toFixed(0)}h — marked failed`);
        } else {
          result.stillPending += 1;
        }
        continue;
      }

      const stream = await client.messages.batches.results(job.batchId);
      for await (const entry of stream) {
        if (entry.result.type !== "succeeded") {
          // errored / expired / canceled — still billed, but the API exposes no
          // token usage for these, so cost below is a lower bound. Count + log so
          // failures are visible rather than silently dropped.
          bFailed += 1;
          console.warn(`[batch-runner] batch ${job.batchId} request ${entry.custom_id}: ${entry.result.type}`);
          continue;
        }
        const msg = entry.result.message;
        bExtractIn += msg.usage.input_tokens ?? 0;
        bExtractOut += msg.usage.output_tokens ?? 0;

        const toolUse = msg.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );
        if (!toolUse) continue;

        let proposals;
        try {
          proposals = parseExtraction(toolUse.input).proposals;
        } catch {
          continue; // malformed extraction — skip this source
        }
        const ctx = job.requestMap[entry.custom_id];
        if (!ctx || proposals.length === 0) continue;

        // Classify each proposal synchronously (cheap, 600-token calls).
        const classifications = await Promise.all(
          proposals.map(async (proposal) => {
            try {
              const c = await classifyEvidence({
                vendorName: ctx.vendorId,
                sourceCategory: ctx.category,
                sourceUrl: ctx.sourceUrl,
                proposal,
              });
              bClassifyIn += c.usage.inputTokens;
              bClassifyOut += c.usage.outputTokens;
              return { proposal, classification: c.data, failure: null as ClassifyFailure | null };
            } catch (err) {
              return { proposal, classification: null, failure: categoriseClassifyFailure((err as Error).message) };
            }
          }),
        );

        const ingestionJob = await prisma.ingestionJob.create({
          data: { vendorId: ctx.vendorId, status: "ready_for_review" },
        });
        const now = new Date();
        const data = classifications.map(({ proposal, classification, failure }) => ({
          jobId: ingestionJob.id,
          vendorId: ctx.vendorId,
          domain: proposal.domain,
          subfactor: proposal.subfactor,
          excerpt: proposal.excerpt,
          proposedGrade: classification?.finalGrade ?? proposal.proposedGrade,
          proposedRawScore: classification?.finalRawScore ?? proposal.proposedRawScore,
          sourceUrl: ctx.sourceUrl,
          capturedAt: now,
          classifierConfidence: classification?.confidence ?? 0,
          classifierRationale: classification?.rationale ?? null,
          classificationFailed: classification === null,
          classificationFailureCode: failure?.code ?? null,
          classificationFailureReason: failure?.reason ?? null,
          confidenceIsFallback: classification === null,
          status: "pending" as const,
        }));
        const created = await prisma.evidenceProposal.createMany({ data });
        result.proposalsPersisted += created.count;
      }

      // Per-batch cost: THIS batch's extraction (discounted) + its classify at
      // standard rate. Computed from this batch's tokens only.
      const batchCost = (bExtractIn * HAIKU_IN + bExtractOut * HAIKU_OUT) * BATCH_DISCOUNT;
      const classifyCost = bClassifyIn * HAIKU_IN + bClassifyOut * HAIKU_OUT;
      await markBatchCollected(job.id, parseFloat((batchCost + classifyCost).toFixed(4)));
      extractTokensIn += bExtractIn;
      extractTokensOut += bExtractOut;
      classifyTokensIn += bClassifyIn;
      classifyTokensOut += bClassifyOut;
      result.failedExtractions += bFailed;
      result.batchesCollected += 1;
    } catch (err) {
      const message = (err as Error).message;
      result.errors.push(`${job.batchId}: ${message.slice(0, 200)}`);
      await markBatchFailed(job.id, message);
    }
  }

  result.tokensIn = extractTokensIn + classifyTokensIn;
  result.tokensOut = extractTokensOut + classifyTokensOut;
  result.estimatedCostUsd = parseFloat(
    (
      (extractTokensIn * HAIKU_IN + extractTokensOut * HAIKU_OUT) * BATCH_DISCOUNT +
      (classifyTokensIn * HAIKU_IN + classifyTokensOut * HAIKU_OUT)
    ).toFixed(4),
  );
  return result;
}
