// POST /api/member/track — add/remove ONE item from the caller's watchlist.
// The inline "Track" toggle. Authz on the route (getMember), origin-checked,
// scoped strictly to the caller's subscriberId.

import { NextResponse } from "next/server";
import { getMember } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { toggleTrack } from "@/lib/member/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as { item?: unknown; action?: unknown };
  const action = b.action === "remove" ? "remove" : "add";
  const result = await toggleTrack(member.subscriberId, b.item, action);
  if (!result) return NextResponse.json({ error: "invalid_item" }, { status: 422 });
  return NextResponse.json(result);
}
