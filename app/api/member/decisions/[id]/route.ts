// /api/member/decisions/[id] — read (GET) + update (PUT) + delete (DELETE)
// ONE decision, ownership enforced server-side. A non-owned or nonexistent id
// returns 404 either way (see lib/member/decisions.ts) — never confirms
// another member's id is real.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getMemberDecision, updateMemberDecision, deleteMemberDecision } from "@/lib/member/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}

export async function GET(_request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  const id = getId(await ctx.params);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const decision = await getMemberDecision(member.subscriberId, id);
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ decision });
}

export async function PUT(request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = getId(await ctx.params);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const result = await updateMemberDecision(member.subscriberId, id, body);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ decision: result.data });
}

export async function DELETE(request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = getId(await ctx.params);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const deleted = await deleteMemberDecision(member.subscriberId, id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
