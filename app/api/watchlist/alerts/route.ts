// PUT /api/watchlist/alerts
// ─────────────────────────
// Saves email + alert threshold config for the current user's watchlist.
// Creates a watchlist if none exists yet.

import { cookies } from "next/headers";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import type { AlertRules } from "@/lib/watchlist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "ai-enterprise-uid";

const DEFAULT_ALERT_RULES: AlertRules = {
  rankChangeThreshold: 3,
  scoreChangeThreshold: 5,
};

async function getUserId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const newId = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  cookieStore.set(COOKIE_NAME, newId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  });
  return newId;
}

export async function PUT(request: Request): Promise<Response> {
  if (!hasDatabase()) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: { email?: string; rankChangeThreshold?: number; scoreChangeThreshold?: number };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { email, rankChangeThreshold, scoreChangeThreshold } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: "valid email required" }, { status: 400 });
  }

  const userId = await getUserId();
  const prisma = getPrisma();

  const existing = await prisma.watchlist.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const currentRules: AlertRules = existing
    ? (existing.alertRules as unknown as AlertRules)
    : { ...DEFAULT_ALERT_RULES };

  const updatedRules: AlertRules = {
    rankChangeThreshold: rankChangeThreshold ?? currentRules.rankChangeThreshold,
    scoreChangeThreshold: scoreChangeThreshold ?? currentRules.scoreChangeThreshold,
  };

  let watchlist;

  if (existing) {
    watchlist = await prisma.watchlist.update({
      where: { id: existing.id },
      data: {
        email,
        alertRules: updatedRules,
      },
    });
  } else {
    watchlist = await prisma.watchlist.create({
      data: {
        name: "My Watchlist",
        vendors: [],
        userId,
        email,
        alertRules: updatedRules,
      },
    });
  }

  return Response.json({ watchlist });
}
