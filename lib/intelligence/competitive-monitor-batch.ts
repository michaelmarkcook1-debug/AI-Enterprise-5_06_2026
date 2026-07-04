// Two-phase Batch API path for the competitive-intel monitor.
// ───────────────────────────────────────────────────────────
// The Message Batches API is ~50% cheaper than real-time but async (up to a 24h
// SLA), so it can't complete inside one cron run. This module batches the
// PRICIEST tier — Stage 3, the Opus analyst commentary — across two cron cycles,
// WITHOUT touching the synchronous pipeline in competitive-monitor.ts:
//
//   submitIntelAnalystBatch()    — cron run N: run Stage 1 (Haiku web search) +
//                                  Stage 2 (Sonnet classify) synchronously for
//                                  every vendor, then submit ONE batch of Stage-3
//                                  (Opus) analyst requests and record the batch
//                                  id + per-vendor Stage-1/2 output.
//   collectIntelAnalystBatches() — cron run N+1: for each ended batch, fetch
//                                  results, assemble whyItMatters into findings,
//                                  and upsert IntelligenceNewsItem exactly as the
//                                  synchronous monitor does.
//
// Stage 1 stays synchronous because it drives the web_search server tool (with a
// pause_turn continuation loop that a single batch request can't resume) and its
// dominant cost is the flat per-search fee, which the batch discount doesn't
// touch. Stage 3 is pure inference with the priciest per-token rate, so it is
// where the batch discount pays off.
//
// Gated entirely behind INTEL_BATCH_MODE=1 (see lib/system/daily-refresh.ts).
// Default OFF → the proven synchronous monitor is unchanged. buildAnalystParams /
// parseAnalyst / assembleFindings / upsertVendorFindings are imported from
// competitive-monitor.ts so the two paths can never drift.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { getPrisma, hasDatabase } from "../prisma";
import { PRICES, BATCH_DISCOUNT } from "../ingestion/cost-model";
import {
  monitorVendor,
  buildAnalystParams,
  parseAnalyst,
  assembleFindings,
  upsertVendorFindings,
  resolveCompetitiveTargets,
} from "./competitive-monitor";
import type { CompetitiveTarget } from "./competitive-targets";
import {
  recordSubmittedIntelBatch,
  listPendingIntelBatches,
  markIntelBatchCollected,
  markIntelBatchFailed,
  type IntelBatchVendorContext,
} from "./intel-batch-store";

const HAIKU_IN = PRICES.haiku.inputPerMTok / 1_000_000;
const HAIKU_OUT = PRICES.haiku.outputPerMTok / 1_000_000;
const SONNET_IN = PRICES.sonnet.inputPerMTok / 1_000_000;
const SONNET_OUT = PRICES.sonnet.outputPerMTok / 1_000_000;
const OPUS_IN = PRICES.opus.inputPerMTok / 1_000_000;
const OPUS_OUT = PRICES.opus.outputPerMTok / 1_000_000;
const WEB_SEARCH_PRICE = 0.01;
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

export interface IntelBatchSubmitResult {
  ok: boolean;
  batchId: string | null;
  /** Vendors run through Stage 1/2 this cycle. */
  vendorsScanned: number;
  /** Vendors that produced classified findings and went into the analyst batch. */
  vendorsBatched: number;
  /** Full-price cost of the synchronous Stage-1/2 work + web-search fees. */
  stage12CostUsd: number;
  errors: string[];
  skipped?: string;
}

/**
 * Phase 1 — run Stage 1/2 synchronously for every target and submit ONE Stage-3
 * (Opus analyst) batch. No persistence of findings here; that's phase 2.
 */
export async function submitIntelAnalystBatch(
  opts: { now?: Date; targets?: CompetitiveTarget[]; runId?: string } = {},
): Promise<IntelBatchSubmitResult> {
  const client = getClient();
  const base: IntelBatchSubmitResult = {
    ok: false, batchId: null, vendorsScanned: 0, vendorsBatched: 0, stage12CostUsd: 0, errors: [],
  };
  if (!client) return { ...base, skipped: "no_llm" };
  if (!hasDatabase()) return { ...base, skipped: "no_database" };

  const now = opts.now ?? new Date();
  const runId = opts.runId ?? `isub_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const targets = opts.targets ?? (await resolveCompetitiveTargets());

  // Stage 1 + Stage 2 for every vendor, synchronously (deferAnalyst stops before
  // the Opus call and hands back the classified findings). Same fan-out shape as
  // the synchronous monitor's Promise.all over targets.
  const scanned = await Promise.all(
    targets.map(async (t) => {
      try {
        return { target: t, result: await monitorVendor(t, now, { deferAnalyst: true }) };
      } catch (err) {
        base.errors.push(`${t.vendorId}: ${(err as Error).message.slice(0, 160)}`);
        return { target: t, result: null };
      }
    }),
  );

  // Full-price cost of the Stage-1/2 work that just ran, plus the flat web-search
  // fee (not batch-discountable). This is what the batch path still pays up front.
  let s12CostUsd = 0;
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
  const requestMap: Record<string, IntelBatchVendorContext> = {};

  for (const { target, result } of scanned) {
    if (!result) continue;
    const st = result.stageTokens;
    s12CostUsd +=
      st.haiku.in * HAIKU_IN + st.haiku.out * HAIKU_OUT +
      st.sonnet.in * SONNET_IN + st.sonnet.out * SONNET_OUT +
      result.searchesUsed * WEB_SEARCH_PRICE;

    const classified = result.deferredClassified ?? [];
    const rawItems = result.deferredRawItems ?? [];
    if (classified.length === 0 || rawItems.length === 0) continue;

    requests.push({
      custom_id: target.vendorId,
      params: buildAnalystParams(target, classified, rawItems),
    } as Anthropic.Messages.Batches.BatchCreateParams.Request);
    requestMap[target.vendorId] = { vendorName: target.name, classified, rawItems };
  }

  base.vendorsScanned = scanned.length;
  base.stage12CostUsd = parseFloat(s12CostUsd.toFixed(4));

  if (requests.length === 0) {
    return { ...base, skipped: "no_classified_findings" };
  }

  const batch = await client.messages.batches.create({ requests });
  await recordSubmittedIntelBatch({
    batchId: batch.id,
    runId,
    vendorCount: requests.length,
    requestMap,
  });

  return { ...base, ok: true, batchId: batch.id, vendorsBatched: requests.length };
}

export interface IntelBatchCollectResult {
  batchesChecked: number;
  batchesCollected: number;
  stillPending: number;
  /** Analyst requests that came back errored/expired/canceled (still billed; no
   *  token data is exposed for them, so estimatedCostUsd is a lower bound). */
  failedAnalyses: number;
  itemsUpserted: number;
  tokensIn: number;
  tokensOut: number;
  /** Stage-3 (Opus) cost AFTER the 50% batch discount. */
  estimatedCostUsd: number;
  errors: string[];
}

/**
 * Phase 2 — collect any ended analyst batches, assemble findings and upsert them
 * exactly as the synchronous monitor does. Batches still processing are left for
 * a later run; batches stuck past the SLA are marked failed.
 */
export async function collectIntelAnalystBatches(): Promise<IntelBatchCollectResult> {
  const client = getClient();
  const result: IntelBatchCollectResult = {
    batchesChecked: 0,
    batchesCollected: 0,
    stillPending: 0,
    failedAnalyses: 0,
    itemsUpserted: 0,
    tokensIn: 0,
    tokensOut: 0,
    estimatedCostUsd: 0,
    errors: [],
  };
  if (!client || !hasDatabase()) return result;

  const pending = await listPendingIntelBatches();
  const prisma = getPrisma();
  let opusTokensIn = 0;
  let opusTokensOut = 0;
  // upsertVendorFindings reports per-row failures as {vendorId,error}; fold them
  // into result.errors (string[]) after collection.
  const upsertErrors: { vendorId: string; error: string }[] = [];

  for (const job of pending) {
    result.batchesChecked += 1;
    let bOpusIn = 0, bOpusOut = 0, bFailed = 0;
    try {
      const batch = await client.messages.batches.retrieve(job.batchId);
      if (batch.processing_status !== "ended") {
        const ageHours = (Date.now() - new Date(job.submittedAt).getTime()) / 3_600_000;
        if (ageHours > MAX_BATCH_AGE_HOURS) {
          await markIntelBatchFailed(job.id, `stuck in '${batch.processing_status}' for ${ageHours.toFixed(0)}h (>${MAX_BATCH_AGE_HOURS}h SLA)`);
          result.errors.push(`${job.batchId}: stuck ${ageHours.toFixed(0)}h — marked failed`);
        } else {
          result.stillPending += 1;
        }
        continue;
      }

      const stream = await client.messages.batches.results(job.batchId);
      for await (const entry of stream) {
        if (entry.result.type !== "succeeded") {
          // errored / expired / canceled — still billed, but no token usage is
          // exposed, so cost below is a lower bound. Count + log rather than drop.
          bFailed += 1;
          console.warn(`[competitive-monitor-batch] batch ${job.batchId} request ${entry.custom_id}: ${entry.result.type}`);
          continue;
        }
        const msg = entry.result.message;
        bOpusIn += msg.usage.input_tokens ?? 0;
        bOpusOut += msg.usage.output_tokens ?? 0;

        const ctx = job.requestMap[entry.custom_id];
        if (!ctx) continue;

        const whyMap = parseAnalyst(msg.content);
        const findings = assembleFindings(ctx.vendorName, ctx.classified, ctx.rawItems, whyMap);
        // entry.custom_id is the vendorId (see submitIntelAnalystBatch).
        result.itemsUpserted += await upsertVendorFindings(prisma, entry.custom_id, findings, upsertErrors);
      }

      const batchCost = (bOpusIn * OPUS_IN + bOpusOut * OPUS_OUT) * BATCH_DISCOUNT;
      await markIntelBatchCollected(job.id, parseFloat(batchCost.toFixed(4)));
      opusTokensIn += bOpusIn;
      opusTokensOut += bOpusOut;
      result.failedAnalyses += bFailed;
      result.batchesCollected += 1;
    } catch (err) {
      const message = (err as Error).message;
      result.errors.push(`${job.batchId}: ${message.slice(0, 200)}`);
      await markIntelBatchFailed(job.id, message);
    }
  }

  for (const e of upsertErrors) result.errors.push(`${e.vendorId}: ${e.error}`);
  result.tokensIn = opusTokensIn;
  result.tokensOut = opusTokensOut;
  result.estimatedCostUsd = parseFloat(
    ((opusTokensIn * OPUS_IN + opusTokensOut * OPUS_OUT) * BATCH_DISCOUNT).toFixed(4),
  );
  return result;
}
