// Phase 3b — email dispatcher for shortlist competitive overlaps.
// ───────────────────────────────────────────────────────────────
// For each watchlist with an email + vendors, treat its vendors as the buyer's
// shortlist and check for new-capability entrants that now overlap them
// (lib/services/shortlist-alerts). When overlaps exist, email a digest via
// Resend. Reuses the existing watchlist email channel + the daily cron — no new
// cron, and no anonymous-user problem (user_state shortlists carry no email).
// Skips the send gracefully when RESEND_API_KEY is absent, still returning the
// "would have sent" counts so the pipeline log is honest.

import { getPrisma, hasDatabase } from "../prisma";
import { getShortlistCompetitiveAlerts, type ShortlistCompetitiveAlert } from "../services/shortlist-alerts";

export interface OverlapNotifyResult {
  skipped: boolean;
  reason?: string;
  watchlistsChecked: number;
  watchlistsWithOverlaps: number;
  emailsSent: number;
  notes: string[];
}

interface ResendLike {
  emails: { send: (args: Record<string, unknown>) => Promise<unknown> };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmailHtml(alerts: ShortlistCompetitiveAlert[]): string {
  const rows = alerts
    .map((a) => {
      const c = a.comparison;
      const cmp = c
        ? ` Re-scored in your context: ${esc(c.incumbent.name)} ${c.incumbent.finalScore} vs ${esc(c.challenger.name)} ${c.challenger.finalScore} (${c.delta > 0 ? "+" : ""}${c.delta} pts). ${esc(c.verdict)}`
        : "";
      return `<li style="margin-bottom:10px"><strong>${esc(a.challengerName)}</strong> now offers <strong>${esc(a.capabilityName)}</strong>, overlapping your shortlisted <strong>${esc(a.shortlistedName)}</strong>.${cmp}</li>`;
    })
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2 style="font-size:16px">New competitive overlaps on your shortlist</h2>
    <p style="font-size:13px;color:#475569">A vendor has newly gained a capability that overlaps a vendor you're tracking — it now competes for that slot.</p>
    <ul style="font-size:13px;color:#0f172a;padding-left:18px">${rows}</ul>
    <p style="font-size:12px;color:#64748b">Open the Demonstrate tab to re-run your selection.</p>
  </div>`;
}

async function run(): Promise<OverlapNotifyResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", watchlistsChecked: 0, watchlistsWithOverlaps: 0, emailsSent: 0, notes: [] };
  }
  const prisma = getPrisma();
  const notes: string[] = [];

  const watchlists = (await prisma.watchlist.findMany({ where: { email: { not: null } } })).filter(
    (w) => (w.vendors?.length ?? 0) > 0 && w.email,
  );
  if (watchlists.length === 0) {
    return { skipped: false, watchlistsChecked: 0, watchlistsWithOverlaps: 0, emailsSent: 0, notes: [] };
  }

  // Initialise Resend (skip gracefully if the key is absent — same posture as the
  // existing watchlist alert sender).
  let resend: ResendLike | null = null;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      resend = new Resend(apiKey) as unknown as ResendLike;
    } catch (err) {
      notes.push(`resend_init_failed: ${(err as Error).message}`);
    }
  }

  let withOverlaps = 0;
  let emailsSent = 0;
  for (const wl of watchlists) {
    const alerts = await getShortlistCompetitiveAlerts(wl.vendors, { limit: 8 }).catch(() => [] as ShortlistCompetitiveAlert[]);
    if (alerts.length === 0) continue;
    withOverlaps += 1;
    if (!resend) {
      notes.push(`WOULD SEND to ${wl.email}: ${alerts.length} overlap(s)`);
      continue;
    }
    try {
      await resend.emails.send({
        from: "AI Enterprise <alerts@ranking-engine-red.vercel.app>",
        to: [wl.email as string],
        subject: `New competitive overlaps on your shortlist (${alerts.length})`,
        html: buildEmailHtml(alerts),
      });
      emailsSent += 1;
    } catch (err) {
      notes.push(`send_failed ${wl.email}: ${(err as Error).message}`);
    }
  }
  return { skipped: false, watchlistsChecked: watchlists.length, watchlistsWithOverlaps: withOverlaps, emailsSent, notes };
}

/** Public entry point — wrapped so an email/DB problem is recorded, never
 *  crashes the daily-refresh pipeline (this channel is non-critical). */
export async function checkAndSendCompetitiveOverlapAlerts(): Promise<OverlapNotifyResult> {
  try {
    return await run();
  } catch (err) {
    return { skipped: true, reason: (err as Error).message, watchlistsChecked: 0, watchlistsWithOverlaps: 0, emailsSent: 0, notes: [] };
  }
}
