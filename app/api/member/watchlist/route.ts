// /api/member/watchlist — read (GET) + save (PUT) the CALLER'S OWN watchlist.
// Authz on the route (not just the page): every request resolves getMember() and
// scopes to that subscriberId — a member can never touch another's list.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getMemberWatchlist, saveMemberWatchlist } from "@/lib/member/watchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const watchlist = await getMemberWatchlist(member.subscriberId);
  return NextResponse.json({ watchlist });
}

export async function PUT(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const watchlist = await saveMemberWatchlist(member.subscriberId, body);
  return NextResponse.json({ watchlist });
}
