import { getMarketDashboard, getIntelligenceVendor, listNewsItems, listVendorMomentum } from "./repository";

/** Lower-case the first letter so a field can be spliced mid-sentence —
 *  but preserve leading acronyms ("AI infrastructure", "GPU vendor"). */
function lowerFirst(s: string): string {
  if (!s) return s;
  // If the 2nd char is also uppercase, the first word is an acronym → leave it.
  if (s.length > 1 && s[1] !== s[1].toLowerCase() && s[1] === s[1].toUpperCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
function stripPeriod(s: string): string {
  return s ? s.replace(/\.\s*$/, "") : s;
}

/**
 * Build an analytical "why" line for the highest-scoring vendor. The earlier
 * version asserted "X remains the highest-scoring platform" with no reasoning;
 * this composes the rationale from the vendor's real category, description and
 * analyst interpretation so the statement explains *why* it leads.
 */
function leadWhy(top: Awaited<ReturnType<typeof getMarketDashboard>>["topVendors"][number] | undefined): string {
  if (!top) return "The leading group holds the top scores in the current AI Enterprise model.";
  const role = top.category ? `the leading ${lowerFirst(top.category)}` : "the highest-scoring platform";
  const basis = top.description ? ` — its lead rests on ${lowerFirst(stripPeriod(top.description))}` : "";
  const read = top.analystInterpretation ? ` Analyst read: ${top.analystInterpretation}` : "";
  return `${top.name} is the highest-scoring platform at ${top.overallScore}/100, ${role}${basis}.${read}`;
}

export async function generateWeeklyBriefing() {
  const dashboard = await getMarketDashboard();
  const top = dashboard.topVendors[0];
  const runnerUp = dashboard.topVendors[1];
  const agentic = dashboard.agenticMomentum.slice(0, 3);
  const agenticLead = agentic[0]?.vendor;

  const executiveSummary = [
    // 1. The "why" behind the #1 score — grounded in real vendor data.
    leadWhy(top),
    // 2. The closest challenger and what differentiates it.
    runnerUp
      ? `Closest challenger: ${runnerUp.name} at ${runnerUp.overallScore}/100 — ${lowerFirst(stripPeriod(runnerUp.description ?? runnerUp.category))}${runnerUp.marketPosition ? ` (positioned as a ${runnerUp.marketPosition})` : ""}.`
      : "",
    // 3. Agentic momentum, with the capability that earns it rather than a bare list.
    agentic.length > 0
      ? `Agentic momentum concentrates around ${agentic.map((a) => a.vendor.name).join(", ")}${agenticLead?.agenticCapability ? ` — e.g. ${agenticLead.name}: ${lowerFirst(stripPeriod(agenticLead.agenticCapability))}` : ""}.`
      : "",
    // 4–6. Durable analyst context (structural reads that don't move week to week).
    "The frontier-model ecosystem is now genuinely global: Meta (Llama), DeepSeek, Alibaba (Qwen), Moonshot (Kimi), Z.ai (GLM), and MiniMax sit alongside the US-frontier set, and open-weights options shape buying decisions where access compliance allows.",
    "Microsoft's distribution strength via Copilot, GitHub, and Azure is product-layer reach, not first-party model origination — separate the two when reading category share.",
    "Anthropic is the structural winner of developer-coding workloads in 2026: Claude Sonnet is the default in Cursor, Aider, and GitHub Copilot Workspace, and Claude Code ships as first-party CLI. Microsoft retains the distribution layer; Anthropic owns the model.",
    "Enterprise control, evidence quality, and cost governance are the main swing factors for high-risk buyers.",
  ].filter(Boolean);

  return {
    title: "Weekly Enterprise AI Market Brief",
    generatedAt: dashboard.generatedAt,
    confidenceNote: "MVP briefing generated from seeded market intelligence. Treat market share and momentum as directional estimates, not audited fact.",
    executiveSummary,
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
