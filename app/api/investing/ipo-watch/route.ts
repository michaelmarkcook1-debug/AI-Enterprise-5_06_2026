import { getInvestmentDashboard, ipoForecastWarning, listIpoForecastRows } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = getInvestmentDashboard();
  return Response.json({
    ipoWatch: dashboard.ipoRumourMonitor,
    ipoForecasts: listIpoForecastRows(),
    warning: dashboard.warning,
    ipoForecastWarning: ipoForecastWarning(),
    dataStatus: "estimated",
  });
}
