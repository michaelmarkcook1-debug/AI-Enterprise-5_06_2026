// /api/member/monitor/remove-vendor — drop ONE vendor from the shortlist monitor.
// ─────────────────────────────────────────────────────────────────────────────
// The monitor curates the REAL underlying stores (single source of truth), but
// updateMemberDecision needs the whole decision and saveMemberWatchlist the whole
// watchlist — neither of which the client holds. So the server does the partial
// edit: load the owned record, drop the one vendor, save the rest back through the
// existing sanitizers. Scope is decided by decisionId:
//   • decisionId present → remove `vendorId` (an ENTITY id) from that decision's shortlist
//   • decisionId absent  → remove `slug` (a vendor SLUG) from the watchlist
// Ownership + validation ride entirely on the existing member helpers; a foreign
// or missing id 404s exactly as the decision routes do.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { isSameOrigin } from "@/lib/http/same-origin";
import { getMemberDecision, updateMemberDecision } from "@/lib/member/decisions";
import { getMemberWatchlist, saveMemberWatchlist } from "@/lib/member/watchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { decisionId?: string | null; vendorId?: string; slug?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Watchlist scope: remove a slug from the flat vendor set.
  if (!body.decisionId) {
    const slug = typeof body.slug === "string" ? body.slug : "";
    if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 });
    const wl = await getMemberWatchlist(member.subscriberId);
    const next = await saveMemberWatchlist(member.subscriberId, {
      ...wl,
      vendors: wl.vendors.filter((v) => v !== slug),
    });
    return NextResponse.json({ ok: true, watchlist: next });
  }

  // Decision scope: remove an entity id from that decision's shortlist, then save
  // the whole (still-valid) decision back through the sanitizer.
  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
  if (!vendorId) return NextResponse.json({ error: "vendorId_required" }, { status: 400 });
  const decision = await getMemberDecision(member.subscriberId, body.decisionId);
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await updateMemberDecision(member.subscriberId, body.decisionId, {
    name: decision.name,
    category: decision.category,
    weights: decision.weights,
    shortlist: decision.shortlist.filter((s) => s.vendorId !== vendorId),
    asOfDate: decision.asOfDate,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, decision: result.data });
}
