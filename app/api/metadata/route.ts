import { INDUSTRIES } from "@/lib/industries";
import { USE_CASES, PRIMARY_OBJECTIVES, ECOSYSTEMS } from "@/lib/use-cases";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import { PILLARS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const vendors = await listVendorProfiles();

  return Response.json({
    industries: Object.values(INDUSTRIES).map((i) => ({ id: i.id, name: i.name })),
    useCases: USE_CASES,
    objectives: PRIMARY_OBJECTIVES,
    ecosystems: ECOSYSTEMS,
    pillars: PILLARS,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      summary: v.summary,
    })),
  });
}
