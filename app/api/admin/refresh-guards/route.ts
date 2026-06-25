// Admin control for the shared-refresh cost guardrails.
// ──────────────────────────────────────────────────────
//   GET  → current kill-switch state + today's spend vs caps.
//   POST → toggle the runtime (DB) kill switch: { active: boolean, reason?: string }.
//
// Admin/cron-gated like the rest of /api/admin/*. The env kill switch
// (REFRESH_KILL_SWITCH=1) is operator-owned and cannot be cleared here — it
// always wins, by design.

import { isCronOrAdminRequest, cronUnauthorized } from "../../../../lib/cron/auth";
import { getKillSwitchState, setKillSwitch } from "../../../../lib/system/refresh-killswitch";
import { getSpendCaps, getDaySpendUsd } from "../../../../lib/system/spend-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function snapshot() {
  const [kill, todayUsd] = await Promise.all([getKillSwitchState(), getDaySpendUsd()]);
  const caps = getSpendCaps();
  return {
    killSwitch: kill,
    spend: {
      caps,
      todayUsd: Math.round(todayUsd * 1e4) / 1e4,
      dayRemainingUsd: Math.max(0, Math.round((caps.dayUsd - todayUsd) * 1e4) / 1e4),
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  return Response.json(await snapshot());
}

export async function POST(request: Request): Promise<Response> {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();

  let body: { active?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return Response.json({ error: "body.active (boolean) is required" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const ok = await setKillSwitch(body.active, { reason, setBy: "admin" });
  if (!ok) {
    return Response.json(
      { error: "could not set kill switch (no database configured?)" },
      { status: 503 },
    );
  }
  return Response.json({ ok: true, ...(await snapshot()) });
}
