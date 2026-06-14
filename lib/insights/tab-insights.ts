// Tab insight generators — deterministic analyst-style paragraphs.
// ──────────────────────────────────────────────────────────────────
// Each function composes ONE paragraph (~70–110 words) strictly from the
// inputs it is given — the same data the tab renders. No external facts,
// no speculation: every clause traces to a number in the input. If the
// data is too thin to say anything defensible, the generator returns a
// shorter honest paragraph rather than padding.

export interface QueryInsightInput {
  totalEntities: number;
  platforms: number;
  models: number;
  applications: number;
  avgLeadership: number;
  evidenceConfidence: number;
  highRisk: number;
}

export function queryInsight(i: QueryInsightInput): string {
  const layers = `${i.platforms} platform, ${i.models} model and ${i.applications} application vendors`;
  return (
    `The tracked universe stands at ${i.totalEntities} entities — ${layers} — and the structure matters more than any single score. ` +
    `Average leadership of ${i.avgLeadership} masks wide variation between layers: platforms monetise other vendors' adoption, while application vendors carry the encroachment risk that platforms create. ` +
    `Evidence confidence sits at ${i.evidenceConfidence}%, so treat rankings as directional rather than settled, and read role context before comparing scores across layers. ` +
    `${i.highRisk > 0 ? `${i.highRisk} ${i.highRisk === 1 ? "entity carries" : "entities carry"} elevated risk flags — start any diligence there.` : "No elevated risk flags are currently raised."}`
  );
}

export interface UnderstandInsightInput {
  vendorCount: number;
  avgSustainability: number;
  mostDurable: { name: string; sustainability: number } | null;
  highestRisk: { name: string; encroachment: number } | null;
  spread: number; // max - min sustainability across scored vendors
}

export function understandInsight(i: UnderstandInsightInput): string {
  if (i.vendorCount === 0 || !i.mostDurable || !i.highestRisk) {
    return "Strategic scores will populate once vendors are loaded. Until then, no defensibility reading is offered — the platform does not editorialise beyond its data.";
  }
  return (
    `Across the ${i.vendorCount} scored vendors, average strategic sustainability is ${i.avgSustainability}/100 with a ${i.spread}-point spread — a market where defensibility is unevenly distributed, not commoditised. ` +
    `${i.mostDurable.name} currently shows the most durable position (${i.mostDurable.sustainability}), typically a function of distribution moat and momentum rather than model quality alone. ` +
    `${i.highestRisk.name} carries the highest platform-encroachment exposure (${i.highestRisk.encroachment}) — the structural risk that a platform vendor absorbs its category as a feature. ` +
    `These scores are estimated from seed pillar data and momentum; weight them as directional context for an assessment, not as standalone verdicts.`
  );
}

export interface DemonstrateInsightInput {
  hasShortlist: boolean;
  shortlistNames: string[];
  boardDefence: number;
  cioConfidence: number;
  recommendation: string;
  criticalRisks: number;
}

export function demonstrateInsight(i: DemonstrateInsightInput): string {
  if (!i.hasShortlist) {
    return (
      "No assessed shortlist is loaded, so this tab is showing the market-wide defence toolkit rather than a vendor-specific case. " +
      "The Executive Summary export will produce an AI-market overview; the Board, Procurement and Risk packs unlock once an assessment produces a shortlist. " +
      "Run Assess first — a defence case built without a stated decision scope is not defensible by definition."
    );
  }
  const names = i.shortlistNames.join(", ");
  return (
    `The case for ${names} currently scores ${i.boardDefence}/100 on quality-weighted board defence and ${i.cioConfidence}/100 on CIO confidence, yielding a "${i.recommendation}" posture. ` +
    `The defence score weights shortlist strength, evidence confidence, momentum, reputation coverage and context completeness — a low component, not the headline, is where a board challenge will land. ` +
    `${i.criticalRisks > 0 ? `${i.criticalRisks} critical-severity ${i.criticalRisks === 1 ? "risk remains" : "risks remain"} open in the register; pre-empt ${i.criticalRisks === 1 ? "it" : "them"} in the narrative rather than waiting for the question.` : "No critical-severity risks are open in the register."}`
  );
}

export interface MonitorInsightInput {
  activeRecommendations: number;
  reassessNow: number;
  reassessQuarter: number;
  brokenAssumptions: number;
  vendorSignals: number;
  largestDrift: { name: string; drift: number } | null;
}

export function monitorInsight(i: MonitorInsightInput): string {
  const stable = i.reassessNow === 0 && i.reassessQuarter === 0 && i.brokenAssumptions === 0;
  const driftClause = i.largestDrift
    ? `The largest movement is ${i.largestDrift.name} at ${i.largestDrift.drift > 0 ? "+" : ""}${i.largestDrift.drift} drift — ${i.largestDrift.drift >= 0 ? "conditions have moved in favour of the recommendation" : "conditions have moved against it"}. `
    : "";
  return (
    `${i.activeRecommendations} recommendations are under monitoring with ${i.vendorSignals} vendor change ${i.vendorSignals === 1 ? "signal" : "signals"} logged this period. ` +
    driftClause +
    (stable
      ? "Nothing currently meets a reassessment trigger and no tracked assumption has broken — the portfolio is holding, which is itself a finding worth reporting upward. "
      : `${i.reassessNow > 0 ? `${i.reassessNow} ${i.reassessNow === 1 ? "recommendation needs" : "recommendations need"} reassessment now. ` : ""}${i.reassessQuarter > 0 ? `${i.reassessQuarter} more ${i.reassessQuarter === 1 ? "falls" : "fall"} due this quarter. ` : ""}${i.brokenAssumptions > 0 ? `${i.brokenAssumptions} tracked ${i.brokenAssumptions === 1 ? "assumption is" : "assumptions are"} at risk — assumptions break before recommendations do, so they are the earlier signal. ` : ""}`) +
    "Drift here is computed from momentum movement against the original recommendation basis, not from re-scoring."
  );
}
