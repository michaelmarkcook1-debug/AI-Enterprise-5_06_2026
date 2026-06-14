import {
  getIntelligenceVendor,
  listEvidenceSources,
  listMarketShareEstimates,
  listNewsItems,
  listVendorCapabilities,
  listVendorPillarScores,
} from "@/lib/intelligence/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<unknown> }) {
  const id = getId(await ctx.params);
  if (!id) return Response.json({ error: "invalid_vendor_id" }, { status: 400 });

  const vendor = await getIntelligenceVendor(id);
  if (!vendor) return Response.json({ error: "not_found" }, { status: 404 });

  const [pillarScores, capabilities, news, marketShare, evidenceSources] = await Promise.all([
    listVendorPillarScores(),
    listVendorCapabilities(),
    listNewsItems(),
    listMarketShareEstimates(),
    listEvidenceSources(),
  ]);

  return Response.json({
    vendor,
    pillarScores: pillarScores.filter((score) => score.vendorId === vendor.id),
    capabilities: capabilities.filter((capability) => capability.vendorId === vendor.id),
    news: news.filter((item) => item.vendors.includes(vendor.id)),
    marketShare: marketShare.filter((estimate) => estimate.vendorId === vendor.id),
    evidenceSources: evidenceSources.filter((source) => source.entityId === vendor.id),
  });
}

function getId(params: unknown): string | null {
  return typeof params === "object" && params !== null && "id" in params && typeof params.id === "string"
    ? params.id
    : null;
}
