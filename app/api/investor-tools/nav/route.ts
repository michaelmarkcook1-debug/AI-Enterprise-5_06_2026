import { INVESTOR_TOOLS_NAV } from "@/lib/investor-tools/nav";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    nav: INVESTOR_TOOLS_NAV,
    dataStatus: "documented",
  });
}
