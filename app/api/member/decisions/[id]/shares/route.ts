// /api/member/decisions/[id]/shares — list (GET) + create (POST) share links
// for ONE of the CALLER's OWN decisions. Ownership is enforced inside
// createShare/listShares (lib/member/decision-shares.ts) by re-checking
// getMemberDecision — a decisionId the caller doesn't own returns 404, same
// as every other decision route; it never confirms whether that id is real.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getMemberDecision } from "@/lib/member/decisions";
import { listShares, createShare } from "@/lib/member/decision-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}

export async function GET(_request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  const decisionId = getId(await ctx.params);
  if (!decisionId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const decision = await getMemberDecision(member.subscriberId, decisionId);
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const shares = await listShares(member.subscriberId, decisionId);
  return NextResponse.json({ shares });
}

export async function POST(request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const decisionId = getId(await ctx.params);
  if (!decisionId) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await createShare(member.subscriberId, decisionId, body);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ share: result.data }, { status: 201 });
}
