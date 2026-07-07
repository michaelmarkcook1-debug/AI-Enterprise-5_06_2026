// GET /api/export/procurement-pack?category=<id>&format=pdf|csv
//  or  /api/export/procurement-pack?vendor=<slug>&format=pdf|csv
// Procurement pack from the LIVE public view — no auth (mirrors the public
// category/vendor pages this reads from), so it's rate-limited like every
// other public route. Category mode uses that category's live default
// weighting (same as the static ranking); vendor mode uses the framework
// default (no category context). Same source-of-truth functions as the
// member-decision export route — never a parallel calculation.

import { NextResponse } from "next/server";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { getCategoryCompositeWithMeta } from "@/lib/ranking/category-composite";
import { getVendorScorecard } from "@/lib/assessment/domain-scores";
import { ENTITIES } from "@/lib/intelligence/entities";
import { DEFAULT_DOMAIN_WEIGHTS } from "@/lib/assessment/composite";
import { assembleProcurementPack, safeFilename, type ProcurementPackData } from "@/lib/export/procurement-pack";
import { renderProcurementPackPdf } from "@/lib/export/procurement-pack-pdf";
import { procurementPackToCsv } from "@/lib/export/procurement-pack-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  const rl = rateLimit(`export-pack:${anonSessionHash(request)}`, { limit: 20, windowMs: HOUR });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
  const categoryId = url.searchParams.get("category");
  const vendorSlug = url.searchParams.get("vendor");

  let pack: ProcurementPackData;

  if (categoryId) {
    const { composite, asOf } = await getCategoryCompositeWithMeta(categoryId);
    if (!composite) {
      return NextResponse.json(
        { error: "insufficient_evidence", detail: "No live ranking is currently available for this category." },
        { status: 503 },
      );
    }
    const vendorRefs = [...composite.ranked, ...composite.incomplete].map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      vendorSlug: v.vendorSlug,
    }));
    pack = await assembleProcurementPack({
      kind: "category",
      title: composite.category.name,
      categoryId,
      categoryName: composite.category.name,
      asOfDate: asOf ? asOf.toISOString().slice(0, 10) : null,
      generatedAt: new Date().toISOString(),
      weights: composite.resolvedDomainWeights,
      weightingLabel: `${composite.category.name} default weighting`,
      vendorRefs,
    });
  } else if (vendorSlug) {
    const entity = ENTITIES.find((e) => e.slug === vendorSlug);
    if (!entity) return NextResponse.json({ error: "vendor_not_found" }, { status: 404 });
    const scorecard = await getVendorScorecard(entity.id);
    pack = await assembleProcurementPack(
      {
        kind: "vendor",
        title: entity.name,
        categoryId: null,
        categoryName: null,
        asOfDate: null,
        generatedAt: new Date().toISOString(),
        weights: DEFAULT_DOMAIN_WEIGHTS,
        weightingLabel: "Framework default weighting",
        vendorRefs: [{ vendorId: entity.id, vendorName: entity.name, vendorSlug: entity.slug }],
      },
      async () => new Map([[entity.id, scorecard]]),
    );
  } else {
    return NextResponse.json({ error: "missing_category_or_vendor" }, { status: 400 });
  }

  const filename = safeFilename(pack.title);

  if (format === "csv") {
    return new Response(procurementPackToCsv(pack), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}-procurement-pack.csv"`,
        ...rateLimitHeaders(rl),
      },
    });
  }

  const pdf = await renderProcurementPackPdf(pack);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}-procurement-pack.pdf"`,
      ...rateLimitHeaders(rl),
    },
  });
}
