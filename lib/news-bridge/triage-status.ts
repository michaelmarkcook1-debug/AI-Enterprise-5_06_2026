// Triage-queue status behind the "pending re-assessment" badge.
// ───────────────────────────────────────────────────────────────────────────
// The badge is honest — it refuses to claim a score movement until the evidence
// pipeline actually re-scores. But it never resolved and never aged, so a reader
// couldn't tell whether "pending" meant "tomorrow" or "never". A permanent
// placeholder stops being information.
//
// This reports the real depth and age of the pre-approval queue (EvidenceProposal
// rows still `pending`), so the badge can say how far back the backlog goes.
// Counts only — no score, no delta, no estimate of when.

import { getPrisma, hasDatabase } from "../prisma";

export interface TriageStatus {
  /** Proposals awaiting analyst review. */
  pending: number;
  /** Age in days of the OLDEST pending proposal (null when the queue is empty). */
  oldestDays: number | null;
}

/** Null when there's no DB — the caller then renders the badge unchanged. */
export async function getTriageStatus(now: Date = new Date()): Promise<TriageStatus | null> {
  if (!hasDatabase()) return null;
  try {
    const db = getPrisma();
    const [pending, oldest] = await Promise.all([
      db.evidenceProposal.count({ where: { status: "pending" } }),
      db.evidenceProposal.findFirst({
        where: { status: "pending" },
        orderBy: { capturedAt: "asc" },
        select: { capturedAt: true },
      }),
    ]);
    if (pending === 0) return { pending: 0, oldestDays: null };
    const oldestDays = oldest?.capturedAt
      ? Math.max(0, Math.floor((now.getTime() - oldest.capturedAt.getTime()) / 86_400_000))
      : null;
    return { pending, oldestDays };
  } catch (err) {
    // Log it: a failed query and an empty queue both render no suffix, so
    // without this a broken lookup would be indistinguishable from "nothing
    // pending" — the exact permanent-placeholder problem this set out to fix.
    console.error(`[triage-status] queue lookup failed: ${(err as Error).message}`);
    return null; // never block a page on queue telemetry
  }
}

/** Short suffix for the badge, e.g. "· 12 in queue, oldest 6d". Empty when we
 *  have nothing real to say — we never invent a turnaround time. */
export function triageSuffix(status: TriageStatus | null): string {
  if (!status || status.pending === 0) return "";
  const age = status.oldestDays === null ? "" : `, oldest ${status.oldestDays}d`;
  return `· ${status.pending} in queue${age}`;
}
