// /api/member/decisions — list (GET) + create (POST) the CALLER'S OWN
// decisions. Same authz shape as /api/member/watchlist: resolve getMemberOrTest()
// first, 401 if absent, then scope everything to that subscriberId.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { listMemberDecisions, createMemberDecision } from "@/lib/member/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const decisions = await listMemberDecisions(member.subscriberId);
  return NextResponse.json({ decisions });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = await createMemberDecision(member.subscriberId, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ decision: result.data }, { status: 201 });
}
