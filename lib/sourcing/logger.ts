// Structured sourcing logger.
//
// Every step of the ingestion pipeline emits one event:
//   sourcing.run.start    — operator triggered a run
//   sourcing.fetch.start  — about to GET a URL
//   sourcing.fetch.ok     — bytes, content-type, hash
//   sourcing.fetch.fail   — error
//   sourcing.extract.start
//   sourcing.extract.ok   — n proposals, llm.source (anthropic|stub), tokens
//   sourcing.extract.fail
//   sourcing.classify.ok  — per-proposal final grade + classifier confidence
//   sourcing.persist.ok   — proposals written to DB
//   sourcing.run.summary  — totals
//
// Events go to:
//   - console.info (dev visibility)
//   - logs/sourcing/{YYYY-MM-DD}.ndjson (file tail for forensics)
//   - in-memory ring buffer (admin /api/admin/sourcing/logs reads from this)
//
// Why NDJSON: one event per line, easy to grep + tail + ship to a SIEM.

import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export type SourcingEventName =
  | "sourcing.run.start"
  | "sourcing.fetch.start"
  | "sourcing.fetch.ok"
  | "sourcing.fetch.fail"
  | "sourcing.extract.start"
  | "sourcing.extract.ok"
  | "sourcing.extract.fail"
  | "sourcing.classify.ok"
  | "sourcing.classify.fail"
  | "sourcing.persist.ok"
  | "sourcing.persist.fail"
  | "sourcing.run.summary"
  | "sourcing.gate.skipped"
  // URL-repair agent events
  | "sourcing.repair.start"
  | "sourcing.repair.candidate"
  | "sourcing.repair.no_candidate"
  | "sourcing.repair.error"
  | "sourcing.repair.persist_failed"
  | "sourcing.repair.retry_ok"
  | "sourcing.repair.retry_failed"
  // News / press-release pipeline events
  | "news.run.start"
  | "news.run.summary"
  | "news.listing.fetch.start"
  | "news.listing.fetch.ok"
  | "news.listing.fetch.fail"
  | "news.discovery.skipped"
  | "news.discovery.ok"
  | "news.dedup.ok"
  | "news.article.fetch.start"
  | "news.article.fetch.ok"
  | "news.article.fetch.fail"
  | "news.article.extract.ok"
  | "news.article.extract.fail"
  | "news.article.persist.ok"
  | "news.article.persist.fail";

export interface SourcingEvent {
  ts: string;             // ISO timestamp
  runId: string;
  event: SourcingEventName;
  vendorId?: string;
  sourceUrl?: string;
  listingUrl?: string;    // news pipeline: the listing page URL
  articleUrl?: string;    // news pipeline: individual article URL
  category?: string;
  // Free-form, JSON-serialisable fields per event type.
  data?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
}

const RING_SIZE = 500;
const ring: SourcingEvent[] = [];

const LOG_DIR = process.env.SOURCING_LOG_DIR
  ?? join(process.cwd(), "logs", "sourcing");

let logDirReady = false;

async function ensureLogDir() {
  if (logDirReady) return;
  try {
    await mkdir(LOG_DIR, { recursive: true });
    logDirReady = true;
  } catch (err) {
    // Don't crash the run if the FS is read-only (e.g. Vercel runtime).
    console.warn("[sourcing] could not create log dir", err);
  }
}

function dailyLogPath(): string {
  const day = new Date().toISOString().slice(0, 10);
  return join(LOG_DIR, `${day}.ndjson`);
}

export async function logEvent(event: SourcingEvent): Promise<void> {
  // Console — green for ok, red for fail, gray for start, white for summary.
  const tag = event.event.replace("sourcing.", "");
  const dur = event.durationMs ? ` ${event.durationMs}ms` : "";
  const ven = event.vendorId ? ` [${event.vendorId}]` : "";
  const url = event.sourceUrl ? ` ${event.sourceUrl}` : "";
  const err = event.error ? ` ERROR: ${event.error}` : "";
  // eslint-disable-next-line no-console
  console.info(`[sourcing ${event.runId}] ${tag}${ven}${url}${dur}${err}`);

  // Ring buffer
  ring.push(event);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);

  // NDJSON file tail
  await ensureLogDir();
  if (logDirReady) {
    try {
      await appendFile(dailyLogPath(), JSON.stringify(event) + "\n", "utf-8");
    } catch (writeErr) {
      // Best-effort; fall through to in-memory log.
      console.warn("[sourcing] log write failed", writeErr);
    }
  }
}

export function tailEvents(limit = 100, filter?: { runId?: string; vendorId?: string }): SourcingEvent[] {
  const filtered = filter
    ? ring.filter((e) =>
        (!filter.runId || e.runId === filter.runId)
        && (!filter.vendorId || e.vendorId === filter.vendorId))
    : ring;
  return filtered.slice(-limit);
}

export function logDirPath(): string {
  return LOG_DIR;
}

export async function ensureLogDirReady(): Promise<void> {
  // Eager call useful for early validation in CLI scripts.
  await ensureLogDir();
}
