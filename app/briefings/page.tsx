import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import { generateWeeklyBriefing } from "@/lib/intelligence/briefings";

export const dynamic = "force-dynamic";

export default async function BriefingsPage() {
  const brief = await generateWeeklyBriefing();

  return (
    <PageFrame title="Executive briefing generator" kicker="Board-ready synthesis" description="MVP briefings are generated from stored mock vendor, market, and news intelligence. Live ingestion and LLM summarisation plug in later.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <Panel title={brief.title}>
          <div className="space-y-4">
            {brief.executiveSummary.map((item) => <p key={item} className="text-sm leading-6 text-[#475a72]">{item}</p>)}
            <div className="rounded-md bg-[#f3ead2] p-3 text-sm font-medium text-[#13294b]">{brief.boardTakeaway}</div>
          </div>
        </Panel>
        <Panel title="Confidence note">
          <p className="text-sm leading-6 text-[#475a72]">{brief.confidenceNote}</p>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Who is winning">
          <ul className="space-y-2 text-sm leading-6 text-[#475a72]">{brief.whoIsWinning.map((item) => <li key={item}>{item}</li>)}</ul>
        </Panel>
        <Panel title="Who is losing">
          <ul className="space-y-2 text-sm leading-6 text-[#475a72]">{brief.whoIsLosing.map((item) => <li key={item}>{item}</li>)}</ul>
        </Panel>
        <Panel title="Watchlist summary">
          <ul className="space-y-2 text-sm leading-6 text-[#475a72]">{brief.riskWatch.map((item) => <li key={item}>{item}</li>)}</ul>
        </Panel>
      </div>
    </PageFrame>
  );
}
