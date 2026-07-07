// DELETE /api/member/decisions/[id]/shares/[shareId] — revoke ONE share link.
// Ownership enforced in revokeShare's WHERE clause (id + decisionId +
// subscriberId all matching) — a non-owned decision or share id updates zero
// rows, returned as 404, never a distinguishing error.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { revokeShare } from "@/lib/member/decision-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIds(params: unknown): { decisionId: string; shareId: string } | null {
  if (typeof params !== "object" || params === null) return null;
  const p = params as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.shareId === "string" ? { decisionId: p.id, shareId: p.shareId } : null;
}

export async function DELETE(request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ids = getIds(await ctx.params);
  if (!ids) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const revoked = await revokeShare(member.subscriberId, ids.decisionId, ids.shareId);
  if (!revoked) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
