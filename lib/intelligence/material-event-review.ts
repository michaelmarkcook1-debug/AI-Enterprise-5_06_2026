// Review state for flagged material events (acquisitions & investments).
// ─────────────────────────────────────────────────────────────────────────────
// Owner 2026-08-02: "the system doesn't allow a user to verify these news
// articles." Correct. /admin/material-events told the reader "nothing here has
// moved a score, and nothing will until evidence is reviewed" — and then offered
// no way to review anything. The source links work (137 of 138 deep-link to the
// article), so you could read the piece and form a judgement; there was simply
// nowhere to put it. Every visit re-presented the same 138 rows in the same
// order, so the queue could never shrink and two people could never divide it.
//
// This records the outcome. Deliberately narrow:
//
//   • It NEVER touches a score, a pillar or an evidence row. A flagged event is
//     a pattern match on a headline; confirming that the headline is real says
//     nothing about a vendor's capability. Promotion to evidence remains a
//     separate, explicit act through the existing triage queue.
//
//   • It does NOT claim analyst verification. /admin is open (owner instruction
//     2026-07-10) and there is no sign-in, so the app cannot know who pressed
//     the button. The stored fact is "someone reviewed this in the back office
//     at this time", and the UI says exactly that. Labelling it "analyst-
//     verified" would repeat the bulk-approved-vs-verified conflation that
//     already muddied the evidence table.
//
// Storage follows the market-edge / spend-ledger / routine-inbox convention: a
// self-migrating table created on first use, so this ships without a migration.

import { getPrisma, hasDatabase } from "../prisma";

/** What a reviewer concluded about a flagged headline. */
export type MaterialEventVerdict =
  /** The deal is real and the headline describes it accurately. */
  | "confirmed"
  /** Pattern matched, but this is not actually a deal (false positive). */
  | "not_a_deal"
  /** Real, but already captured elsewhere — don't surface it again. */
  | "duplicate";

export const VERDICTS: readonly MaterialEventVerdict[] = ["confirmed", "not_a_deal", "duplicate"];

export function isVerdict(v: unknown): v is MaterialEventVerdict {
  return typeof v === "string" && (VERDICTS as readonly string[]).includes(v);
}

export interface MaterialEventReview {
  newsItemId: string;
  verdict: MaterialEventVerdict;
  note: string | null;
  reviewedAt: string;
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "material_event_review" (
  "newsItemId" TEXT PRIMARY KEY,
  "verdict"    TEXT NOT NULL,
  "note"       TEXT,
  "reviewedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "material_event_review_verdict_idx" ON "material_event_review" ("verdict");
`;

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

const MAX_NOTE = 400;

/**
 * Record (or change) a verdict. Idempotent per news item — re-reviewing
 * overwrites, because the last human judgement is the one that counts.
 */
export async function recordMaterialEventReview(
  newsItemId: string,
  verdict: MaterialEventVerdict,
  note?: string | null,
): Promise<boolean> {
  if (!hasDatabase() || !newsItemId || !isVerdict(verdict)) return false;
  const trimmed = (note ?? "").trim().slice(0, MAX_NOTE) || null;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`
      INSERT INTO "material_event_review" ("newsItemId", "verdict", "note", "reviewedAt")
      VALUES (${newsItemId}, ${verdict}, ${trimmed}, now())
      ON CONFLICT ("newsItemId") DO UPDATE
        SET "verdict" = ${verdict}, "note" = ${trimmed}, "reviewedAt" = now()
    `;
    return true;
  } catch (err) {
    console.error("[material-event-review] record failed", err);
    return false;
  }
}

/** Undo a review, returning the item to the open queue. */
export async function clearMaterialEventReview(newsItemId: string): Promise<boolean> {
  if (!hasDatabase() || !newsItemId) return false;
  try {
    await ensureTable();
    await getPrisma().$executeRaw`DELETE FROM "material_event_review" WHERE "newsItemId" = ${newsItemId}`;
    return true;
  } catch (err) {
    console.error("[material-event-review] clear failed", err);
    return false;
  }
}

/**
 * All recorded reviews, keyed by news-item id.
 *
 * Returns an EMPTY map when there is no database or the read fails — never a
 * partial one. A half-read map would silently re-open reviewed items, which
 * reads as "your review was lost" and is worse than showing the full queue.
 */
export async function listMaterialEventReviews(): Promise<Map<string, MaterialEventReview>> {
  const out = new Map<string, MaterialEventReview>();
  if (!hasDatabase()) return out;
  try {
    await ensureTable();
    const rows = (await getPrisma().$queryRaw`
      SELECT "newsItemId", "verdict", "note", "reviewedAt" FROM "material_event_review"
    `) as Array<{ newsItemId: string; verdict: string; note: string | null; reviewedAt: Date }>;
    for (const r of rows) {
      if (!isVerdict(r.verdict)) continue; // ignore anything written by a future version
      out.set(r.newsItemId, {
        newsItemId: r.newsItemId,
        verdict: r.verdict,
        note: r.note,
        reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : String(r.reviewedAt),
      });
    }
  } catch (err) {
    console.error("[material-event-review] list failed", err);
    return new Map();
  }
  return out;
}
