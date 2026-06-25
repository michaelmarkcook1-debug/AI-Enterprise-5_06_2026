// GET /api/subscribe/confirm?token=… — double opt-in confirmation link target.
// Confirms the subscriber, then redirects to a human-friendly status page.

import { confirmSubscriber } from "@/lib/subscribers/service";
import { absoluteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ok = await confirmSubscriber(token);
  return Response.redirect(absoluteUrl(`/subscribe/done?state=${ok ? "confirmed" : "invalid"}`), 302);
}
