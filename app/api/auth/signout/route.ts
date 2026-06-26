// POST /api/auth/signout — revoke the session + clear the cookie. Origin-checked.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSessionByToken, MEMBER_COOKIE, memberCookieOptions } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const jar = await cookies();
  const raw = jar.get(MEMBER_COOKIE)?.value;
  if (raw) await revokeSessionByToken(raw);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MEMBER_COOKIE, "", memberCookieOptions(0));
  return res;
}
