// Evidence-composite score history — the data behind the hover trend charts.
// ─────────────────────────────────────────────────────────────────────────────
// Records a REAL point-in-time snapshot of each vendor's within-category
// assessment composite, per-pillar scores, and rank on every refresh, so the
// ranking hover charts show how a vendor has actually moved SINCE WE STARTED
// TRACKING — not a synthetic curve.
//
// HONESTY (factual-data rule):
//   • `source = "snapshot"` rows are captured live from the same composite the
//     page shows — unimpeachable, real history that accrues forward from today.
//   • `source = "reconstructed"` rows replay the composite "as of" a past date
//     using ONLY evidence captured on or before that date. This is gated by
//     RECONSTRUCT_MIN_SPAN_DAYS: if a vendor's evidence is all clustered inside a
//     short window (e.g. a bulk import), reconstruction emits NOTHING rather than
//     a misleading before/after jump. Every reconstructed point is labelled so a
//     viewer never reads "we added evidence" as "the vendor improved".
//   • No DB / read failure ⇒ empty history (the chart shows an honest
//     "tracking since …" baseline), never a fabricated line.
//
// Self-migrating (CREATE TABLE IF NOT EXISTS), never-throw — same idiom as the
// other lib stores; no Prisma migration needed.

import { getPrisma, hasDatabase } from "../prisma";
import { scoreAllDomains, type RubricEvidenceRow } from "../assessment/domain-rubric";
import { computeWeightedComposite } from "../assessment/composite";
import { resolveDomainWeights } from "../assessment/category-weights";
import { synthesizeSiliconMarketPosition } from "../assessment/silicon-capability";
import type { CategoryComposite } from "./composite-types";
import type { DomainId, EvidenceGrade } from "../types";

/** Reconstruction only spans a real time range — below this, evidence is treated
 *  as a single point (clustered import) and NO history is reconstructed. */
const RECONSTRUCT_MIN_SPAN_DAYS = 14;

const TABLE = "vendor_score_history";
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "${TABLE}" (
  "id"              TEXT PRIMARY KEY,
  "vendor_id"       TEXT NOT NULL,
  "category_id"     TEXT NOT NULL,
  "snapshot_date"   DATE NOT NULL,
  "composite"       DOUBLE PRECISION,
  "rank"            INTEGER,
  "tracked_vendors" INTEGER,
  "pillars"         JSONB NOT NULL DEFAULT '[]',
  "source"          TEXT NOT NULL DEFAULT 'snapshot',
  "captured_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("vendor_id", "category_id", "snapshot_date")
);
CREATE INDEX IF NOT EXISTS "${TABLE}_vc_idx" ON "${TABLE}" ("vendor_id", "category_id", "snapshot_date");`;

let ensured = false;
async function ensureTable(): Promise<boolean> {
  if (!hasDatabase()) return false;
  if (ensured) return true;
  try {
    await getPrisma().$executeRawUnsafe(CREATE_SQL);
    ensured = true;
    return true;
  } catch (err) {
    console.warn(`[score-history] ensureTable failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

const isoDate = (d: Date): string =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);

export interface ScoreHistoryPoint {
  date: string; // yyyy-mm-dd
  composite: number | null; // 0–5
  rank: number | null;
  pillars: { pillar: string; score: number | null }[];
  source: "snapshot" | "reconstructed";
}

// ── Capture (forward, real) ──────────────────────────────────────────────────

/** Write today's REAL snapshot for every ranked vendor in every category. Called
 *  from the daily refresh (and can be run once now to set the baseline). Idempotent
 *  on (vendor, category, date): re-running the same day overwrites, never dupes. */
export async function captureScoreHistory(
  composites: CategoryComposite[],
  now: Date = new Date(),
): Promise<{ captured: number; snapshotDate: string }> {
  const snapshotDate = isoDate(now);
  if (!(await ensureTable())) return { captured: 0, snapshotDate };
  const prisma = getPrisma();
  let captured = 0;
  for (const cat of composites) {
    const ranked = cat.ranked.filter((v) => v.rank != null && v.assessmentComposite != null);
    const trackedVendors = ranked.length;
    for (const v of ranked) {
      const pillars = (v.rankPillars ?? []).map((p) => ({ pillar: p.pillar, score: p.score }));
      const id = `${v.vendorId}__${cat.category.id}__${snapshotDate}`;
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${TABLE}" (id, vendor_id, category_id, snapshot_date, composite, rank, tracked_vendors, pillars, source, captured_at)
           VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8::jsonb,'snapshot',now())
           ON CONFLICT (vendor_id, category_id, snapshot_date) DO UPDATE SET
             composite=EXCLUDED.composite, rank=EXCLUDED.rank, tracked_vendors=EXCLUDED.tracked_vendors,
             pillars=EXCLUDED.pillars, source='snapshot', captured_at=now()`,
          id, v.vendorId, cat.category.id, snapshotDate, v.assessmentComposite, v.rank, trackedVendors, JSON.stringify(pillars),
        );
        captured++;
      } catch {
        // per-row non-fatal — a bad row never fails the whole capture
      }
    }
  }
  return { captured, snapshotDate };
}

// ── Read ─────────────────────────────────────────────────────────────────────

/** Read a vendor's stored history for a category, oldest→newest. Real snapshots
 *  only (source='snapshot'|'reconstructed'); empty when none exist yet. */
export async function getScoreHistory(vendorId: string, categoryId: string): Promise<ScoreHistoryPoint[]> {
  if (!(await ensureTable())) return [];
  try {
    const rows = (await getPrisma().$queryRawUnsafe(
      `SELECT to_char(snapshot_date,'YYYY-MM-DD') AS date, composite, rank, pillars, source
         FROM "${TABLE}" WHERE vendor_id=$1 AND category_id=$2 ORDER BY snapshot_date ASC`,
      vendorId, categoryId,
    )) as { date: string; composite: number | null; rank: number | null; pillars: unknown; source: string }[];
    return rows.map((r) => ({
      date: r.date,
      composite: r.composite,
      rank: r.rank,
      pillars: Array.isArray(r.pillars) ? (r.pillars as { pillar: string; score: number | null }[]) : [],
      source: r.source === "reconstructed" ? "reconstructed" : "snapshot",
    }));
  } catch {
    return [];
  }
}

// ── Reconstruction (honest, span-guarded) ────────────────────────────────────

type EvRow = { domain: DomainId; evidenceGrade: EvidenceGrade; rawScore: number; confidence: number | null; capturedAt: Date };

/** Replay a vendor's composite "as of" the distinct capture dates in its evidence
 *  history — ONLY when that evidence spans ≥ RECONSTRUCT_MIN_SPAN_DAYS, so a
 *  clustered import can never manufacture a trend. Persists reconstructed points
 *  (source='reconstructed'); returns how many were written. Safe to re-run. */
export async function reconstructScoreHistory(vendorId: string, categoryId: string, now: Date = new Date()): Promise<number> {
  if (!(await ensureTable())) return 0;
  const prisma = getPrisma();
  let rows: EvRow[];
  try {
    rows = (await prisma.$queryRawUnsafe(
      `SELECT domain, evidence_grade AS "evidenceGrade", raw_score AS "rawScore", confidence, captured_at AS "capturedAt"
         FROM vendor_evidence_items WHERE vendor_id=$1 AND review_status='analyst_verified'`,
      vendorId,
    )) as EvRow[];
  } catch {
    return 0;
  }
  if (rows.length === 0) return 0;

  const times = rows.map((r) => new Date(r.capturedAt).getTime()).sort((a, b) => a - b);
  const spanDays = (times[times.length - 1] - times[0]) / 86_400_000;
  if (spanDays < RECONSTRUCT_MIN_SPAN_DAYS) return 0; // clustered → honestly no history to reconstruct

  // Distinct capture dates (weekly buckets) that PREDATE today's snapshot.
  const weights = resolveDomainWeights(categoryId);
  const mp = synthesizeSiliconMarketPosition(vendorId); // stable analyst band — carried at all dates
  const distinctDates = [...new Set(rows.map((r) => isoDate(new Date(r.capturedAt))))].filter((d) => d < isoDate(now)).sort();

  let written = 0;
  for (const asOf of distinctDates) {
    const cutoff = new Date(`${asOf}T23:59:59.999Z`).getTime();
    const asOfRows = rows.filter((r) => new Date(r.capturedAt).getTime() <= cutoff);
    const grouped = new Map<DomainId, RubricEvidenceRow[]>();
    for (const r of asOfRows) {
      const list = grouped.get(r.domain) ?? [];
      list.push({ evidenceGrade: r.evidenceGrade, rawScore: r.rawScore, confidence: r.confidence, capturedAt: new Date(r.capturedAt), sourceUrl: null });
      grouped.set(r.domain, list);
    }
    const domains = scoreAllDomains(grouped, new Date(cutoff));
    const eff = mp && (weights.market_position ?? 0) > 0 ? [...domains, mp] : domains;
    const wc = computeWeightedComposite(eff, weights);
    if (wc.composite == null || wc.scoredCount === 0) continue;
    const pillars = wc.contributions
      .filter((c) => c.state === "scored")
      .map((c) => ({ pillar: c.pillar, score: c.score }));
    const id = `${vendorId}__${categoryId}__${asOf}`;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${TABLE}" (id, vendor_id, category_id, snapshot_date, composite, rank, tracked_vendors, pillars, source, captured_at)
         VALUES ($1,$2,$3,$4::date,$5,NULL,NULL,$6::jsonb,'reconstructed',now())
         ON CONFLICT (vendor_id, category_id, snapshot_date) DO NOTHING`, // never overwrite a real snapshot
        id, vendorId, categoryId, asOf, wc.composite, JSON.stringify(pillars),
      );
      written++;
    } catch {
      /* non-fatal */
    }
  }
  return written;
}
