import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/app-shell";
import { Confidence, EvidenceBadge, Metric, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { getIpoForecastRow, ipoForecastWarning, postIpoModelDisabledReason } from "@/lib/investing/intelligence";
import type { PostIPOFluctuationBand } from "@/lib/investing/types";
import { WarningStrip, label } from "@/components/investor-tools-ui";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function IpoForecastProviderPage({ params }: { params: Promise<{ providerSlug: string }> }) {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const { providerSlug } = await params;
  const row = getIpoForecastRow(providerSlug);
  if (!row) notFound();

  const { provider, forecast, evidenceQuality, bands, missingData } = row;
  const disabledReason = postIpoModelDisabledReason(forecast);

  return (
    <PageFrame
      title={`${provider.name} IPO forecast`}
      kicker={`${label(forecast.forecastStatus)} | ${label(forecast.rumourQuality)} | ${label(forecast.behaviourForecast)}`}
      description="Modelled IPO timing and post-listing movement bands. This is not a factual listing date, offer-price forecast, or investment recommendation."
    >
      <WarningStrip />
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
        {ipoForecastWarning()}
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Estimated IPO month" value={forecast.estimatedIpoMonth ?? "Disabled"} note={forecast.forecastDisabledReason ?? "Modelled estimate only"} />
        <Metric label="Credible window" value={formatWindow(forecast.credibleWindowStart, forecast.credibleWindowEnd)} note="Not a company disclosure" />
        <Metric label="Confidence" value={forecast.confidence.replace(/_/g, " ")} note={`${forecast.confidenceScore}/100`} />
        <Metric label="Offer price" value={forecast.hasVerifiedOfferPrice ? "Verified" : "Unknown"} note="No dollar path without verified offer price" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Post-IPO fluctuation band"
          action={<span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100/60 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200" title="Bands are relative to IPO offer price, not dollar prices.">{bands.length === 10 ? "Percentage bands" : "Disabled"}</span>}
        >
          {disabledReason || bands.length !== 10 ? (
            <DisabledForecast reason={disabledReason ?? "Post-IPO fluctuation model disabled until IPO signal quality improves."} />
          ) : (
            <BandChart providerName={provider.name} bands={bands} />
          )}
        </Panel>

        <Panel title="Evidence panel" action={<EvidenceBadge grade={evidenceQuality?.evidenceGrade ?? forecast.evidenceGrade} />}>
          <div className="space-y-3 text-sm leading-6">
            <div className="flex flex-wrap gap-2">
              <Confidence value={forecast.confidenceScore} />
              <SeedDataBadge label="Modelled estimate" />
              <SeedDataBadge label={forecast.sourceRequired ? "Source refresh required" : "Source backed"} provenance={forecast.sourceRequired ? "seed" : "live"} />
            </div>
            <p className="text-[#54647a] dark:text-[#a7bacd]">{forecast.notes}</p>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[#5d6b80]">Filing status</dt>
                <dd className="font-mono">{label(evidenceQuality?.filingStatus ?? "unknown")}</dd>
              </div>
              <div>
                <dt className="text-[#5d6b80]">Confirmed S-1/F-1</dt>
                <dd className="font-mono">{evidenceQuality?.hasConfirmedS1 ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-[#5d6b80]">Price range</dt>
                <dd className="font-mono">{evidenceQuality?.hasConfirmedPriceRange ? "Confirmed" : "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-[#5d6b80]">Lock-up terms</dt>
                <dd className="font-mono">{evidenceQuality?.hasConfirmedLockup ? "Confirmed" : "Unknown"}</dd>
              </div>
            </dl>
            <div className="rounded-md border border-[#e3e8dc] bg-[#f8faf5] p-3 text-xs text-[#54647a] dark:border-[#1d3a57] dark:bg-[#081c30] dark:text-[#a7bacd]">
              Source: {forecast.sourceNames.join(", ")}. Source URL: {forecast.sourceUrls.length ? forecast.sourceUrls.join(", ") : "Not available in seed data; requires validation."}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Missing data checklist">
          <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
            {missingData.map((item) => (
              <div key={`${item.providerId}-${item.missingItem}`} className="grid gap-2 py-3 text-sm md:grid-cols-[180px_1fr_160px]">
                <span className="font-medium">{item.missingItem}</span>
                <span className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{item.howItChangesForecast}</span>
                <span className="font-mono text-[11px] text-rose-700 dark:text-rose-400">{label(item.blockingStatus)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Truthfulness guardrails">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#54647a] dark:text-[#a7bacd]">
            <li>No dollar share-price path is shown because no verified offer price is available.</li>
            <li>All post-IPO bands are percentages relative to the IPO offer price.</li>
            <li>Forecasts are disabled when evidence quality is insufficient or standalone IPO modelling is not credible.</li>
            <li>Seed records must be replaced with filing, banker, roadshow, price-range, float, lock-up, and audited-financial evidence before production use.</li>
          </ul>
          <div className="mt-4">
            <Link href="/investor-tools/ipo-watch" className="text-sm font-medium underline">
              Back to IPO watch
            </Link>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function DisabledForecast({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
      <strong>Forecast disabled.</strong> {reason}
    </div>
  );
}

function BandChart({ providerName, bands }: { providerName: string; bands: PostIPOFluctuationBand[] }) {
  const width = 760;
  const height = 260;
  const minValue = Math.min(0, ...bands.map((band) => band.lowPct));
  const maxValue = Math.max(0, ...bands.map((band) => band.highPct));
  const padding = Math.max(10, (maxValue - minValue) * 0.12);
  const yMin = minValue - padding;
  const yMax = maxValue + padding;
  const xFor = (month: number) => 52 + ((month - 1) / 9) * 656;
  const yFor = (value: number) => 220 - ((value - yMin) / (yMax - yMin || 1)) * 170;
  const highPath = bands.map((band, index) => `${index === 0 ? "M" : "L"} ${xFor(band.monthNumber)} ${yFor(band.highPct)}`).join(" ");
  const lowPath = [...bands].reverse().map((band) => `L ${xFor(band.monthNumber)} ${yFor(band.lowPct)}`).join(" ");
  const areaPath = `${highPath} ${lowPath} Z`;
  const zeroY = yFor(0);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`${providerName} modelled post-IPO percentage band`}>
        <rect x="0" y="0" width={width} height={height} rx="10" className="fill-[#faf6ec] dark:fill-[#081c30]" />
        <rect x={xFor(5) - 20} y="38" width={xFor(7) - xFor(5) + 40} height="190" className="fill-amber-200/40 dark:fill-amber-900/30" />
        <line x1="36" x2="724" y1={zeroY} y2={zeroY} stroke="#7b8576" strokeDasharray="4 5" />
        {[0, 1, 2, 3].map((tick) => {
          const y = 50 + tick * 45;
          return <line key={tick} x1="36" x2="724" y1={y} y2={y} stroke="#e6dcc3" strokeDasharray="4 6" />;
        })}
        <path d={areaPath} fill="#b08d2f" fillOpacity="0.18" stroke="#b08d2f" strokeWidth="2" />
        {bands.map((band) => (
          <g key={band.monthNumber}>
            <title>{`${providerName} M${band.monthNumber}: ${signedPct(band.lowPct)} to ${signedPct(band.highPct)} | ${band.confidence.replace(/_/g, " ")} confidence | ${band.uncertaintyNote}`}</title>
            <line x1={xFor(band.monthNumber)} x2={xFor(band.monthNumber)} y1={yFor(band.lowPct)} y2={yFor(band.highPct)} stroke="#b08d2f" strokeWidth="3" />
            <circle cx={xFor(band.monthNumber)} cy={yFor(band.highPct)} r="4" fill="#0f8b66" />
            <circle cx={xFor(band.monthNumber)} cy={yFor(band.lowPct)} r="4" fill="#c23b2a" />
            <text x={xFor(band.monthNumber)} y="244" textAnchor="middle" className="fill-current text-[11px]">M{band.monthNumber}</text>
          </g>
        ))}
        <text x="52" y="26" className="fill-current text-[11px] font-semibold">Percentage movement vs IPO offer price</text>
        <text x={xFor(6)} y="52" textAnchor="middle" className="fill-amber-800 text-[10px] font-semibold dark:fill-amber-300">M5-M7 lock-up risk zone</text>
      </svg>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
        {bands.map((band) => (
          <div key={band.monthNumber} className="rounded-md border border-[#e3e8dc] p-2 dark:border-[#1d3a57]">
            <div className="font-semibold">M{band.monthNumber}</div>
            <div className="font-mono">{signedPct(band.lowPct)} to {signedPct(band.highPct)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWindow(start: string | null, end: string | null) {
  if (!start || !end) return "No reliable window";
  if (start === end) return start;
  return `${start} to ${end}`;
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}
