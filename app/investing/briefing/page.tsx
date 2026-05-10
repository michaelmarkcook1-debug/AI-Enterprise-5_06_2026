import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import { getInvestmentBriefing } from "@/lib/investing/intelligence";
import { WarningStrip } from "../investing-ui";

export const dynamic = "force-dynamic";

export default function InvestmentBriefingPage() {
  const brief = getInvestmentBriefing();

  return (
    <PageFrame
      title="AI investment briefing"
      kicker={brief.type}
      description="Watch-list framing, not buy/sell instructions. Confidence-labelled, evidence-tagged, valuation-disciplined."
    >
      <WarningStrip />
      <div className="text-xs text-[#66705f]">Generated {new Date(brief.generatedAt).toLocaleString()}</div>

      <Panel title="Executive summary">
        <ul className="list-disc pl-5 text-sm space-y-1 leading-6 text-[#18201b] dark:text-zinc-100">
          {brief.executiveSummary.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Who is gaining">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">{brief.whoIsGaining.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Panel>
        <Panel title="Who is weakening">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">{brief.whoIsWeakening.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Panel>
        <Panel title="Major catalysts">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">{brief.majorCatalysts.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Panel>
        <Panel title="Valuation warnings">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">
            {brief.valuationWarnings.length === 0
              ? <li className="text-[#66705f]">No vendors trip the valuation-risk threshold this period.</li>
              : brief.valuationWarnings.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </Panel>
        <Panel title="IPO watch changes">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">{brief.ipoWatchChanges.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Panel>
        <Panel title="Suggested monitoring actions">
          <ul className="list-disc pl-5 text-xs space-y-1 leading-5">{brief.suggestedMonitoringActions.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </Panel>
      </div>

      <Panel title="Confidence + access notes">
        <ul className="list-disc pl-5 text-xs space-y-1 leading-5 text-[#596151] dark:text-zinc-400">
          {brief.confidenceNotes.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Panel>
    </PageFrame>
  );
}
