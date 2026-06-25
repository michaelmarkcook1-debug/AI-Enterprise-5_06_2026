// GET /api/subscribe/unsubscribe?token=… — one-click unsubscribe link target.

import { unsubscribeByToken } from "@/lib/subscribers/service";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await unsubscribeByToken(token);
  return Response.redirect(absoluteUrl(`/subscribe/done?state=${ok ? "unsubscribed" : "invalid"}`), 302);
}
