// Watchlist alert checker and email sender.
// ──────────────────────────────────────────
// Called by the daily-refresh pipeline (step: watchlist_alerts).
// For each watchlist with at least 1 vendor and a non-null email, compares
// the latest ranking snapshot against the one from 7 days ago and sends one
// batched email per watchlist when any vendor crosses a configured threshold.
//
// If RESEND_API_KEY is absent the email step is skipped gracefully; the
// function still returns the "would have sent" counts so the pipeline log
// remains useful in local dev.

import { getPrisma, hasDatabase } from "@/lib/prisma";
import { ENTITIES } from "@/lib/intelligence/entities";
import type { AlertRules } from "./types";

export interface WatchlistAlertResult {
  sent: number;
  checked: number;
  errors: string[];
}

interface VendorAlert {
  vendorId: string;
  vendorName: string;
  prevRank: number;
  newRank: number;
  rankDelta: number;
  prevScore: number;
  newScore: number;
  scoreDelta: number;
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://ranking-engine-red.vercel.app";

/** Build the name lookup map from the static entity list. */
const ENTITY_NAME: Map<string, string> = new Map(
  ENTITIES.map((e) => [e.id, e.name]),
);

function vendorName(vendorId: string): string {
  return ENTITY_NAME.get(vendorId) ?? vendorId;
}

function buildEmailHtml(alerts: VendorAlert[]): string {
  const rows = alerts
    .map(
      (a) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #1d3444;font-weight:600;color:#e2e8f0;">${a.vendorName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #1d3444;color:#94a3b8;text-align:center;">
        #${a.prevRank} → #${a.newRank}
        <span style="color:${a.rankDelta < 0 ? "#6EE7B7" : a.rankDelta > 0 ? "#f87171" : "#94a3b8"};">
          (${a.rankDelta < 0 ? "+" + Math.abs(a.rankDelta) : a.rankDelta > 0 ? "-" + a.rankDelta : "—"})
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #1d3444;text-align:center;color:${a.scoreDelta >= 0 ? "#6EE7B7" : "#f87171"};">
        ${a.scoreDelta >= 0 ? "+" : ""}${a.scoreDelta.toFixed(1)}
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#071827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#071827;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0d2236;border-radius:12px;border:1px solid #1d3444;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#071827;padding:28px 32px;border-bottom:1px solid #1d3444;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;font-weight:800;color:#6EE7B7;letter-spacing:-0.5px;">AI Enterprise</span>
                <span style="font-size:14px;color:#94a3b8;padding-left:12px;border-left:1px solid #1d3444;">Watchlist Alert</span>
              </div>
              <p style="margin:8px 0 0;font-size:13px;color:#64748b;">
                One or more vendors on your watchlist moved beyond your configured thresholds.
              </p>
            </td>
          </tr>

          <!-- Table -->
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr>
                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:1px solid #1d3444;">Vendor</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:1px solid #1d3444;">Rank change</th>
                    <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;border-bottom:1px solid #1d3444;">Score Δ</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Gold divider note -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#0a1e30;border:1px solid #1d3444;border-left:3px solid #F5C451;border-radius:6px;padding:12px 16px;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                  Rank and score data are captured daily. Deltas compare today's snapshot to the nearest snapshot from 7 days ago.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#071827;padding:20px 32px;border-top:1px solid #1d3444;text-align:center;">
              <a href="${APP_URL}/query-v2" style="display:inline-block;background:#6EE7B7;color:#071827;font-weight:700;font-size:13px;text-decoration:none;padding:10px 24px;border-radius:6px;">
                Manage your watchlist
              </a>
              <p style="margin:16px 0 0;font-size:11px;color:#64748b;">
                You're receiving this because you subscribed to watchlist alerts on AI Enterprise.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function checkAndSendWatchlistAlerts(
  now: Date,
): Promise<WatchlistAlertResult> {
  const result: WatchlistAlertResult = { sent: 0, checked: 0, errors: [] };

  if (!hasDatabase()) return result;

  const prisma = getPrisma();

  // 1. Find all watchlists with at least 1 vendor and a non-null email.
  const watchlists = await prisma.watchlist.findMany({
    where: {
      email: { not: null },
    },
  });

  const eligible = watchlists.filter(
    (wl) => wl.vendors.length > 0 && wl.email,
  );
  result.checked = eligible.length;

  if (eligible.length === 0) return result;

  // 2. Determine date boundary: 7 days ago
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  // Collect all vendor IDs we need to check across all watchlists
  const allVendorIds = Array.from(
    new Set(eligible.flatMap((wl) => wl.vendors)),
  );

  if (allVendorIds.length === 0) return result;

  // 3. Fetch the latest snapshot for each vendor
  const latestSnapshots = await prisma.vendorRankingSnapshot.findMany({
    where: { vendorId: { in: allVendorIds } },
    orderBy: { snapshotDate: "desc" },
    distinct: ["vendorId"],
  });

  // 4. Fetch comparison snapshots (nearest to 7 days ago, or oldest available)
  // For each vendor, find the snapshot closest to (but not after) 7 days ago.
  const oldSnapshots = await prisma.vendorRankingSnapshot.findMany({
    where: {
      vendorId: { in: allVendorIds },
      snapshotDate: { lte: sevenDaysAgo },
    },
    orderBy: { snapshotDate: "desc" },
    distinct: ["vendorId"],
  });

  // If no snapshot exists before 7 days ago, fall back to the oldest available
  const vendorsWithoutOld = allVendorIds.filter(
    (id) => !oldSnapshots.some((s) => s.vendorId === id),
  );
  let fallbackOldSnapshots: typeof oldSnapshots = [];
  if (vendorsWithoutOld.length > 0) {
    fallbackOldSnapshots = await prisma.vendorRankingSnapshot.findMany({
      where: { vendorId: { in: vendorsWithoutOld } },
      orderBy: { snapshotDate: "asc" },
      distinct: ["vendorId"],
    });
  }

  const oldSnapshotMap = new Map(
    [...oldSnapshots, ...fallbackOldSnapshots].map((s) => [s.vendorId, s]),
  );
  const latestSnapshotMap = new Map(
    latestSnapshots.map((s) => [s.vendorId, s]),
  );

  // 5. Try to initialise Resend (skip gracefully if key absent)
  const apiKey = process.env.RESEND_API_KEY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resend: any = null;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      resend = new Resend(apiKey);
    } catch (err) {
      result.errors.push(
        `resend_init_failed: ${(err as Error).message}`,
      );
    }
  }

  // 6. Process each watchlist
  for (const wl of eligible) {
    try {
      const rules = wl.alertRules as AlertRules;
      const triggered: VendorAlert[] = [];

      for (const vendorId of wl.vendors) {
        const latest = latestSnapshotMap.get(vendorId);
        const old = oldSnapshotMap.get(vendorId);

        if (!latest || !old) continue;
        // Skip if they are the same snapshot (no history yet)
        if (latest.id === old.id) continue;

        const rankDelta = latest.rank - old.rank; // positive = fell, negative = rose
        const scoreDelta = latest.overallScore - old.overallScore;

        if (
          Math.abs(rankDelta) >= rules.rankChangeThreshold ||
          Math.abs(scoreDelta) >= rules.scoreChangeThreshold
        ) {
          triggered.push({
            vendorId,
            vendorName: vendorName(vendorId),
            prevRank: old.rank,
            newRank: latest.rank,
            rankDelta,
            prevScore: old.overallScore,
            newScore: latest.overallScore,
            scoreDelta,
          });
        }
      }

      if (triggered.length === 0) continue;

      const html = buildEmailHtml(triggered);
      const subject = `AI Enterprise: ${triggered.length} watchlist vendor${triggered.length !== 1 ? "s" : ""} moved`;

      if (!resend) {
        // Log what would have been sent (no key or init failed)
        console.log(
          `[watchlist_alerts] WOULD SEND to ${wl.email}: ${subject} — ${triggered.map((v) => v.vendorName).join(", ")}`,
        );
        result.sent += 1;
        continue;
      }

      try {
        await resend.emails.send({
          from: "AI Enterprise <alerts@ranking-engine-red.vercel.app>",
          to: [wl.email as string],
          subject,
          html,
        });
        result.sent += 1;
      } catch (sendErr) {
        result.errors.push(
          `send_failed(${wl.id}): ${(sendErr as Error).message}`,
        );
      }
    } catch (wlErr) {
      result.errors.push(`watchlist(${wl.id}): ${(wlErr as Error).message}`);
    }
  }

  return result;
}
