export const dynamic = "force-dynamic";

const TOOLTIP_TEXT: Record<string, string> = {
  startingCapital: "Sets the hypothetical starting amount. It affects portfolio values, allocation amounts, and all scenario paths, but not provider quality scores.",
  horizonYears: "Sets the model horizon and chart x-axis. Longer horizons increase compounding impact and can change scenario dispersion.",
  riskProfile: "Changes risk/return multipliers and risk radar outputs. Speculative profiles tolerate more IPO/watchlist volatility.",
  allocationStyle: "Controls whether allocation is model-guided, thesis-based, manual, or single-stock. It changes the eligible subform and allocation table.",
  investmentUniverse: "Controls eligible providers. IPO Watch contains private or pre-IPO candidates and excludes public direct holdings such as Microsoft or Amazon.",
  selectedVendors: "Controls the manual allocation rows. Selected vendors must be compatible with the chosen universe and allocation style.",
  region: "Reserved for geography filtering and regulatory context. In seed mode it is a scenario assumption, not verified investability advice.",
  includePrivateExposure: "Controls whether private exposure is blocked, indirect only, or IPO-watchlist only. It changes universe filtering and warnings.",
  rebalanceFrequency: "Controls how the hypothetical portfolio would be refreshed. In seed mode it is displayed as an assumption.",
  cashReservePct: "Cash reserve reduces invested allocation and scenario volatility. Manual holdings plus cash must total 100%.",
  shockMode: "Controls whether shocks are chosen manually or generated from a deterministic seed.",
  shockYear: "Controls when a shock enters the scenario path. Changing it must update fan chart, drawdown, waterfall, and risk radar.",
  shockType: "Defines the risk event applied to eligible providers and exposure classes.",
  shockSeverity: "Controls magnitude of risk-event penalties. Higher severity widens downside paths and raises risk alerts.",
  singleStockTicker: "Single-stock mode permits only public direct tickers. Private or IPO-watch providers are routed to IPO Watch instead.",
};

export async function GET() {
  return Response.json({
    tooltips: Object.entries(TOOLTIP_TEXT).map(([inputId, description]) => ({
      inputId,
      title: inputId.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
      description,
      affects: ["charts", "risk scores", "universe filtering"].filter((item) => description.toLowerCase().includes(item.split(" ")[0])),
      limitations: "Seed modelling only; not financial advice.",
    })),
    dataStatus: "documented",
  });
}
