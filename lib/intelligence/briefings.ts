import { getMarketDashboard, getIntelligenceVendor, listNewsItems, listVendorMomentum } from "./repository";

export async function generateWeeklyBriefing() {
  const dashboard = await getMarketDashboard();
  return {
    title: "Weekly Enterprise AI Market Brief",
    generatedAt: dashboard.generatedAt,
    confidenceNote: "MVP briefing generated from seeded market intelligence. Treat market share and momentum as directional estimates, not audited fact.",
    executiveSummary: [
      `${dashboard.topVendors[0]?.name ?? "The leading group"} remains the highest-scoring platform in the current AI Enterpise model.`,
      `Agentic AI momentum is concentrated around ${dashboard.agenticMomentum.slice(0, 3).map((item) => item.vendor.name).join(", ")}.`,
      "The frontier-model ecosystem is now genuinely global: Meta (Llama), DeepSeek, Alibaba (Qwen), Moonshot (Kimi), Z.ai (GLM), and MiniMax sit alongside the US-frontier set, and open-weights options shape buying decisions where access compliance allows.",
      "Microsoft's distribution strength via Copilot, GitHub, and Azure is product-layer reach, not first-party model origination — separate the two when reading category share.",
      "Anthropic is the structural winner of developer-coding workloads in 2026: Claude Sonnet is the default in Cursor, Aider, and GitHub Copilot Workspace, and Claude Code ships as first-party CLI. Microsoft retains the distribution layer; Anthropic owns the model.",
      "Enterprise control, evidence quality, and cost governance are the main swing factors for high-risk buyers.",
    ],
    whoIsWinning: dashboard.winningVendors.slice(0, 4).map((item) => `${item.vendor.name}: ${item.reason}`),
    whoIsLosing: dashboard.losingVendors.slice(0, 4).map((item) => `${item.vendor.name}: ${item.reason}`),
    riskWatch: dashboard.riskAlerts.slice(0, 5).map((item) => `${item.vendor.name}: ${item.alert} (${item.severity}, confidence ${item.confidence}/100)`),
    boardTakeaway: "Do not buy enterprise AI on market momentum alone. Use market data to shortlist, then apply enterprise-control, evidence, and validation gates before scale decisions.",
  };
}

export async function generateVendorBrief(slug: string) {
  const [vendor, news, momentum] = await Promise.all([
    getIntelligenceVendor(slug),
    listNewsItems(),
    listVendorMomentum(),
  ]);
  if (!vendor) return null;
  const vendorNews = news.filter((item) => item.vendors.includes(vendor.id)).slice(0, 5);
  const vendorMomentum = momentum.find((item) => item.vendorId === vendor.id);
  return {
    title: `${vendor.name} Executive Brief`,
    generatedAt: new Date().toISOString(),
    confidenceNote: `Confidence ${vendor.confidenceScore}/100. Evidence is mixed across categories and must be validated by workload.`,
    summary: vendor.analystInterpretation,
    strategy: vendor.strategy,
    marketPosition: vendor.marketPosition,
    momentum: vendorMomentum,
    keyNews: vendorNews,
    riskWatch: vendor.riskProfile,
    boardTakeaway: `${vendor.name} should be evaluated by category fit and enterprise controls, not generic AI mindshare.`,
  };
}
