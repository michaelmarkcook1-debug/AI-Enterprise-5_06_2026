// GET /api/member/decisions/[id]/export?format=pdf|csv — procurement pack for
// ONE saved decision. Ownership-scoped exactly like every other decision read
// (getMemberDecision already returns null for a non-owned id — indistinguishable
// from "doesn't exist"). Re-applies the decision's saved weights to CURRENT
// live scores, same recipe as the decision detail page — never a frozen
// snapshot, never a parallel calculation.

import { NextResponse } from "next/server";
import { getMemberOrTest } from "@/lib/member/auth";
import { getMemberDecision } from "@/lib/member/decisions";
import { getCategoryCompositeWithMeta } from "@/lib/ranking/category-composite";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import { ENTITIES } from "@/lib/intelligence/entities";
import { assembleProcurementPack, safeFilename } from "@/lib/export/procurement-pack";
import { renderProcurementPackPdf } from "@/lib/export/procurement-pack-pdf";
import { procurementPackToCsv } from "@/lib/export/procurement-pack-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}

export async function GET(request: Request, ctx: { params: Promise<unknown> }): Promise<Response> {
  const id = getId(await ctx.params);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const member = await getMemberOrTest();
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const decision = await getMemberDecision(member.subscriberId, id);
  if (!decision) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "pdf";

  const { composite, asOf } = await getCategoryCompositeWithMeta(decision.category);
  if (!composite) {
    return NextResponse.json(
      { error: "insufficient_evidence", detail: "No live ranking is currently available for this decision's category." },
      { status: 503 },
    );
  }

  const entityById = new Map(ENTITIES.map((e) => [e.id, e]));
  const vendorRefs = decision.shortlist
    .filter((s) => entityById.has(s.vendorId))
    .map((s) => {
      const e = entityById.get(s.vendorId)!;
      return { vendorId: e.id, vendorName: e.name, vendorSlug: e.slug, note: s.note ?? null };
    });

  const categoryName = MARKET_CATEGORIES.find((c) => c.id === decision.category)?.name ?? decision.category;

  const pack = await assembleProcurementPack({
    kind: "decision",
    title: decision.name,
    categoryId: decision.category,
    categoryName,
    asOfDate: asOf ? asOf.toISOString().slice(0, 10) : decision.asOfDate,
    generatedAt: new Date().toISOString(),
    weights: decision.weights,
    // decision.weights can never carry model_quality/dev_sentiment
    // (sanitizeDecision only persists the 12 framework domains) — pass the
    // category's live resolved weights as the separate "which extra domains
    // does this category activate" signal, same as the decision detail page's
    // own effectiveDomains() call, so the pack never silently drops a domain
    // the live page shows.
    activationWeights: composite.resolvedDomainWeights,
    weightingLabel: `Saved decision weighting — "${decision.name}"`,
    vendorRefs,
  });

  const filename = safeFilename(decision.name);

  if (format === "csv") {
    return new Response(procurementPackToCsv(pack), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}-procurement-pack.csv"`,
      },
    });
  }

  const pdf = await renderProcurementPackPdf(pack);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}-procurement-pack.pdf"`,
    },
  });
}
