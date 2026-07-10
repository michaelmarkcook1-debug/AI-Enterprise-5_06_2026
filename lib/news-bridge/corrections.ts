// News→Assessment bridge (C12) — classification correction store.
// ─────────────────────────────────────────────────────────────────────────────
// The C12 spec requires the news→vendor mapping be "shown AND correctable, never
// a hidden judgement". A visitor can suggest a correction to which vendor(s) a
// news item is about. STRICTLY a MODERATED SUGGESTION:
//  • It is written to a pending queue and NEVER auto-applies to the news item or
//    to any score — an admin reviews it. The bridge JOIN stays deterministic.
//  • Public write path → the route enforces same-origin (CSRF) + a per-IP rate
//    limit; this module bounds + validates the payload and stores an IP-derived
//    hash only (no raw IP, no PII).
// Self-migrating raw-SQL table (no Prisma migration), created once per process —
// same pattern as lib/interrogation/session-store.ts.

import { getPrisma, hasDatabase } from "../prisma";

export type CorrectionKind = "wrong_vendor" | "missing_vendor" | "other";
export const CORRECTION_KINDS: readonly CorrectionKind[] = ["wrong_vendor", "missing_vendor", "other"];

export interface CorrectionInput {
  newsItemId: string;
  kind: CorrectionKind;
  /** For wrong_vendor: the vendor the item is wrongly tagged with. For
   *  missing_vendor: the vendor that should be added. Optional for "other". */
  vendorSlug?: string | null;
  note?: string | null;
}

const MAX_ID = 200;
const MAX_SLUG = 80;
const MAX_NOTE = 500;

export type ValidationResult =
  | { ok: true; value: Required<Pick<CorrectionInput, "newsItemId" | "kind">> & { vendorSlug: string | null; note: string | null } }
  | { ok: false; error: string };

/** Pure — bound + validate a raw payload. Unit-tested; the route calls this
 *  before touching the DB. Rejects anything malformed rather than storing junk. */
export function validateCorrection(raw: unknown): ValidationResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const newsItemId = typeof r.newsItemId === "string" ? r.newsItemId.trim() : "";
  if (!newsItemId || newsItemId.length > MAX_ID) return { ok: false, error: "invalid newsItemId" };

  const kind = r.kind as CorrectionKind;
  if (!CORRECTION_KINDS.includes(kind)) return { ok: false, error: "invalid kind" };

  let vendorSlug: string | null = null;
  if (typeof r.vendorSlug === "string" && r.vendorSlug.trim()) {
    const s = r.vendorSlug.trim();
    if (s.length > MAX_SLUG || !/^[a-z0-9][a-z0-9_-]*$/i.test(s)) return { ok: false, error: "invalid vendorSlug" };
    vendorSlug = s;
  }

  const note = typeof r.note === "string" ? r.note.trim().slice(0, MAX_NOTE) : null;

  // A vendor-mapping correction needs a vendor to be actionable; "other" needs a note.
  if ((kind === "wrong_vendor" || kind === "missing_vendor") && !vendorSlug) {
    return { ok: false, error: "vendorSlug required for a vendor correction" };
  }
  if (kind === "other" && !note) return { ok: false, error: "note required for 'other'" };

  return { ok: true, value: { newsItemId, kind, vendorSlug, note: note || null } };
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "news_classification_correction" (
  "id" TEXT PRIMARY KEY,
  "newsItemId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "vendorSlug" TEXT,
  "note" TEXT,
  "anonHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "news_correction_status_idx" ON "news_classification_correction" ("status", "createdAt");
`;

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tablesEnsured = true;
}

function correctionId(anonHash: string): string {
  // Stable-ish unique id without Date.now()/random (unavailable in some contexts):
  // the DB default createdAt orders rows; the id just needs uniqueness per insert.
  return `nc_${anonHash.slice(0, 10)}_${Math.abs(hashStr(anonHash + performanceKey())).toString(36)}`;
}
// Cheap string hash (djb2) — for id uniqueness only, not security.
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h | 0;
}
// A per-call salt from the process hrtime — avoids Date.now()/Math.random().
function performanceKey(): string {
  try {
    return process.hrtime.bigint().toString(36);
  } catch {
    return "k";
  }
}

export type ValidatedCorrection = { newsItemId: string; kind: CorrectionKind; vendorSlug: string | null; note: string | null };

/** Persist a MODERATED correction suggestion. Returns false when there's no DB.
 *  Never touches the news item or any score — pending review only. */
export async function createCorrection(value: ValidatedCorrection, anonHash: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await ensureTables();
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO "news_classification_correction" ("id","newsItemId","kind","vendorSlug","note","anonHash") VALUES ($1,$2,$3,$4,$5,$6)`,
      correctionId(anonHash),
      value.newsItemId,
      value.kind,
      value.vendorSlug,
      value.note,
      anonHash,
    );
    return true;
  } catch {
    return false;
  }
}

export interface PendingCorrection {
  id: string;
  newsItemId: string;
  kind: CorrectionKind;
  vendorSlug: string | null;
  note: string | null;
  createdAt: string;
}

/** Admin read — the pending queue, newest first. */
export async function listPendingCorrections(limit = 100): Promise<PendingCorrection[]> {
  if (!hasDatabase()) return [];
  try {
    await ensureTables();
    const rows = (await getPrisma().$queryRawUnsafe(
      `SELECT "id","newsItemId","kind","vendorSlug","note","createdAt" FROM "news_classification_correction" WHERE "status" = 'pending' ORDER BY "createdAt" DESC LIMIT $1`,
      limit,
    )) as Array<{ id: string; newsItemId: string; kind: string; vendorSlug: string | null; note: string | null; createdAt: Date | string }>;
    return rows.map((r) => ({
      id: r.id,
      newsItemId: r.newsItemId,
      kind: r.kind as CorrectionKind,
      vendorSlug: r.vendorSlug,
      note: r.note,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  } catch {
    return [];
  }
}
