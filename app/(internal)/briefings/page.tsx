import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import { generateWeeklyBriefing } from "@/lib/intelligence/briefings";

export const dynamic = "force-dynamic";

export default async function BriefingsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const brief = await generateWeeklyBriefing();

  return (
    <PageFrame title="Executive briefing generator" kicker="Board-ready synthesis" description="MVP briefings are generated from stored mock vendor, market, and news intelligence. Live ingestion and LLM summarisation plug in later.">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <Panel title="Market overview">
          <div className="space-y-4">
            <ul className="space-y-3 pl-1">
              {brief.executiveSummary.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-6 font-semibold text-[#15263c] dark:text-[#eef3f8]">
                  <span className="mt-1 shrink-0 text-[#a07f1f] dark:text-[#d4af37]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-md border-l-4 border-[#a07f1f] bg-[#f3ead2] p-3 text-sm font-semibold text-[#13294b] dark:border-[#d4af37] dark:bg-[#1a2e14]/40 dark:text-[#eef3f8]">
              {brief.boardTakeaway}
            </div>
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
