import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, EvidenceBadge, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { ipoForecastWarning, listIpoForecastRows } from "@/lib/investing/intelligence";
import { WarningStrip, label } from "../investing-ui";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  R0: "No credible rumour",
  R1: "General speculation",
  R2: "Reputable report, vague",
  R3: "Specific timing/valuation",
  R4: "Bankers / advisers",
  R5: "S-1 / F-1 filed",
};

export default function IpoWatchPage() {
  const rows = listIpoForecastRows();

  return (
    <PageFrame
      title="IPO watch"
      kicker="Modelled IPO windows, evidence, and post-listing bands"
      description="Tracks evidence quality, modelled IPO windows, readiness, pricing risk, and 1-10 month percentage bands. Watchlist-only until access and disclosure improve."
    >
      <WarningStrip />
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
        {ipoForecastWarning()}
      </div>

      <Panel title="IPO forecast monitor" action={<SeedDataBadge label="Modelled estimate" reason="Seed forecast model. Not a factual IPO date or offer price." />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const profile = row.forecast;
            const provider = row.provider;
            const evidence = row.evidenceQuality;
            return (
              <Link key={provider.id} href={`/investor-tools/ipo-watch/${provider.slug}`}
                className="block rounded-lg border border-[#dfe4da] bg-white p-4 hover:border-[#192319] dark:border-zinc-800 dark:bg-[#071827]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{provider.name}</div>
                    <div className="text-[11px] text-[#66705f]">{label(provider.exposureClass)}</div>
                  </div>
                  <span className="rounded-full border border-[#d8ded0] px-2 py-0.5 font-mono text-[11px] dark:border-zinc-700">
                    {profile.rumourQuality}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#596151] dark:text-zinc-400">
                  {STAGE_LABEL[baseRumourStage(profile.rumourQuality)] ?? label(profile.rumourQuality)}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-[#66705f]">Forecast window</dt>
                    <dd className="font-mono">{formatWindow(profile.credibleWindowStart, profile.credibleWindowEnd)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#66705f]">Estimated month</dt>
                    <dd className="font-mono">{profile.estimatedIpoMonth ?? "No reliable estimate"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#66705f]">Forecast status</dt>
                    <dd className="font-mono text-rose-700 dark:text-rose-400">{profile.forecastStatusLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-[#66705f]">Bands</dt>
                    <dd className="font-mono">{row.bands.length === 10 ? "M1-M10" : "Disabled"}</dd>
                  </div>
                </dl>
                <div className="mt-3 text-[11px]">
                  <span className="font-semibold">{label(profile.behaviourForecast)}</span>
                  <span className="ml-2 text-[#66705f]">{profile.forecastDisabledReason ?? "Percentage bands are relative to IPO offer price."}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Confidence value={profile.confidenceScore} />
                  <EvidenceBadge grade={evidence?.evidenceGrade ?? profile.evidenceGrade} />
                  <SeedDataBadge label={profile.dataStatus === "estimated" ? "Estimated" : "Disabled"} />
                </div>
                {row.missingData.length > 0 && (
                  <p className="mt-2 text-[11px] leading-4 text-[#66705f]">
                    Missing: {row.missingData.slice(0, 3).map((item) => item.missingItem).join(" | ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </Panel>
    </PageFrame>
  );
}

function baseRumourStage(rumourQuality: string) {
  const match = rumourQuality.match(/R[0-5]/);
  return match?.[0] ?? rumourQuality;
}

function formatWindow(start: string | null, end: string | null) {
  if (!start || !end) return "No reliable window";
  if (start === end) return start;
  return `${start} to ${end}`;
}
