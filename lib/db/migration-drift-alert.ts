// Active alert for schema drift — turn the silent guard into a smoke alarm
// with someone home.
// ─────────────────────────────────────────────────────────────────────────
// lib/db/migration-drift.ts detects when the live DB is behind the code's
// migrations and the daily-refresh marks the run red — but a red admin panel
// nobody opens is how June-21 went unnoticed for days. This sends ONE active
// email when drift is detected, de-duped to once per UTC day per missing-set so
// a persistent drift doesn't spam on every trigger.
//
// IMPORTANT — which environment this protects: Vercel cron jobs run on the
// PRODUCTION deployment, i.e. the `main` branch. While this code lives on
// `v2-new-shape` (preview), the scheduled cron still runs the old production
// build and will NOT fire this alert. It only begins protecting production once
// v2-new-shape is merged to `main` and deployed. (On preview it fires for manual
// /admin/ingestion triggers, labelled environment=preview.)
//
// Dedup state uses the same self-migrating raw-SQL pattern as
// lib/system/refresh-killswitch.ts (CREATE TABLE IF NOT EXISTS) — deliberately
// NOT a Prisma migration, so the drift guard never depends on the very thing it
// is meant to police.

import { getPrisma, hasDatabase } from "../prisma";
import { emailConfigured, sendEmail } from "../email/mailer";
import type { MigrationDriftResult } from "./migration-drift";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "migration_drift_alerts" (
  "id"             TEXT PRIMARY KEY,
  "last_alert_date" TEXT,
  "last_signature"  TEXT,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
const ROW_ID = "global";

let tableEnsured = false;
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

/** Stable signature for a drift state — the sorted set of missing migrations. */
export function migrationAlertSignature(pending: readonly string[]): string {
  return [...pending].sort().join(",");
}

/**
 * Pure dedup decision: alert when we've never alerted, when the day rolled over,
 * or when the missing-migration set changed. No I/O — unit-testable.
 */
export function shouldSendAlert(
  prev: { date: string | null; signature: string | null } | null,
  todayUtc: string,
  signature: string,
): boolean {
  if (!prev || !prev.date) return true;
  if (prev.date !== todayUtc) return true;
  return prev.signature !== signature;
}

/** Pure email builder — subject + html naming the missing migrations + env. */
export function buildDriftAlertEmail(
  drift: MigrationDriftResult,
  env: { environment: string; branch: string; panelUrl: string },
): { subject: string; html: string } {
  const list = drift.pending.map((m) => `<li><code>${m}</code></li>`).join("");
  const subject = `🔴 DB schema drift — ${drift.pending.length} migration(s) behind on ${env.environment}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2 style="color:#b91c1c;margin:0 0 8px">Database schema drift detected</h2>
      <p>The live database is <strong>${drift.pending.length} migration(s) behind</strong> the deployed code
      (${drift.appliedCount}/${drift.expectedCount} applied).</p>
      <p><strong>Environment:</strong> ${env.environment}${env.branch ? ` · branch <code>${env.branch}</code>` : ""}</p>
      <p><strong>Missing migrations:</strong></p>
      <ul>${list}</ul>
      <p>Features that read or write these tables/columns will fail silently until the production branch is
      deployed (or <code>prisma migrate deploy</code> is run) against this database.</p>
      <p><a href="${env.panelUrl}">Open pipeline health →</a></p>
    </div>`.trim();
  return { subject, html };
}

export interface DriftAlertResult {
  alerted: boolean;
  skipped?: string;
  recipient?: string;
  channel?: "email";
  environment?: string;
  pendingCount?: number;
}

/**
 * Send ONE active alert when the DB is behind the code, de-duped to once per UTC
 * day per missing-migration set. Best-effort + non-fatal — never throws into the
 * pipeline. Recipient comes from DRIFT_ALERT_EMAIL; with no recipient or no
 * mailer the FAIL + console.error remain the signal.
 */
export async function notifyMigrationDriftIfNeeded(
  drift: MigrationDriftResult,
  opts: { now?: Date } = {},
): Promise<DriftAlertResult> {
  if (drift.status !== "behind" || drift.pending.length === 0) {
    return { alerted: false, skipped: "not_behind" };
  }
  const recipient = process.env.DRIFT_ALERT_EMAIL?.trim();
  if (!recipient) return { alerted: false, skipped: "no_recipient_env" };
  if (!emailConfigured()) return { alerted: false, skipped: "no_mailer", recipient };

  const now = opts.now ?? new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const signature = migrationAlertSignature(drift.pending);
  const environment = process.env.VERCEL_ENV ?? "local";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";

  try {
    let prev: { date: string | null; signature: string | null } | null = null;
    if (hasDatabase()) {
      await ensureTable();
      const rows = await getPrisma().$queryRaw<Array<{ last_alert_date: string | null; last_signature: string | null }>>`
        SELECT "last_alert_date", "last_signature" FROM "migration_drift_alerts" WHERE "id" = ${ROW_ID} LIMIT 1`;
      prev = rows[0] ? { date: rows[0].last_alert_date, signature: rows[0].last_signature } : null;
    }

    if (!shouldSendAlert(prev, todayUtc, signature)) {
      return { alerted: false, skipped: "already_alerted_today", recipient, environment, pendingCount: drift.pending.length };
    }

    const panelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ranking-engine-red.vercel.app"}/admin/pipeline-health`;
    const { subject, html } = buildDriftAlertEmail(drift, { environment, branch, panelUrl });
    const res = await sendEmail({ to: recipient, subject, html });
    if (!res.sent) {
      return { alerted: false, skipped: res.skipped ?? res.error ?? "send_failed", recipient, environment };
    }

    // Record the dedup stamp only after a successful send.
    if (hasDatabase()) {
      await getPrisma().$executeRaw`
        INSERT INTO "migration_drift_alerts" ("id", "last_alert_date", "last_signature", "updated_at")
        VALUES (${ROW_ID}, ${todayUtc}, ${signature}, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO UPDATE
          SET "last_alert_date" = ${todayUtc}, "last_signature" = ${signature}, "updated_at" = CURRENT_TIMESTAMP`;
    }
    return { alerted: true, recipient, channel: "email", environment, pendingCount: drift.pending.length };
  } catch (err) {
    return { alerted: false, skipped: `error:${(err as Error).message}` };
  }
}
