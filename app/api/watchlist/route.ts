// Watchlist API
// ─────────────
// GET  /api/watchlist        → returns { watchlist: Watchlist | null } for current user
// POST /api/watchlist        → body { action: "watch"|"unwatch", vendorId: string }
//                              upserts watchlist, returns updated watchlist
// PUT  /api/watchlist/alerts → handled in app/api/watchlist/alerts/route.ts

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

/** Get or create a stable anonymous user ID from the cookie. */
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

export async function GET(): Promise<Response> {
  if (!hasDatabase()) {
    return Response.json({ watchlist: null });
  }

  const userId = await getUserId();
  const prisma = getPrisma();

  const watchlist = await prisma.watchlist.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ watchlist });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  let body: { action?: string; vendorId?: string };
  try {
    body = await request.json() as { action?: string; vendorId?: string };
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { action, vendorId } = body;
  if (!action || (action !== "watch" && action !== "unwatch")) {
    return Response.json({ error: "action must be 'watch' or 'unwatch'" }, { status: 400 });
  }
  if (!vendorId || typeof vendorId !== "string") {
    return Response.json({ error: "vendorId required" }, { status: 400 });
  }

  const userId = await getUserId();
  const prisma = getPrisma();

  // Find the user's existing watchlist (one per user)
  const existing = await prisma.watchlist.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  let updatedVendors: string[];

  if (action === "watch") {
    updatedVendors = existing
      ? Array.from(new Set([...existing.vendors, vendorId]))
      : [vendorId];
  } else {
    updatedVendors = existing
      ? existing.vendors.filter((v) => v !== vendorId)
      : [];
  }

  let watchlist;

  if (existing) {
    watchlist = await prisma.watchlist.update({
      where: { id: existing.id },
      data: { vendors: updatedVendors },
    });
  } else {
    watchlist = await prisma.watchlist.create({
      data: {
        name: "My Watchlist",
        vendors: updatedVendors,
        userId,
        alertRules: DEFAULT_ALERT_RULES,
      },
    });
  }

  return Response.json({ watchlist });
}
