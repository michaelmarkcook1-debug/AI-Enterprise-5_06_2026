import { listInvestmentProviders } from "@/lib/investing/simulator";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    providers: listInvestmentProviders(),
    dataStatus: "seed",
  });
}
