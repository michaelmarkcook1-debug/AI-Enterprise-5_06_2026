import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/app-shell";
import { Confidence, EvidenceBadge, Metric, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { productScopesForVendor } from "@/lib/investor-tools/product-scope";
import {
  calculateAiProviderQualityScore,
  calculateConsumerInvestmentPotential,
  calculateHypePenalty,
  calculateInvestmentAttractivenessScore,
  calculatePrivateIpoInvestmentPotential,
  calculateRetailAccessPenalty,
  doNotRankReason,
  getInvestmentProvider,
  isWatchlistOnly,
  listFinancialMetrics,
  listIndirectExposureScores,
  listValuationMetricsLive,
} from "@/lib/investing/intelligence";
import { IPO_PROFILES } from "@/lib/investing/seed";
import { WarningStrip, label } from "../../investing-ui";
import { WatchlistToggle } from "@/components/investor-tools/WatchlistToggle";

export const dynamic = "force-dynamic";

export default async function ProviderInvestmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = getInvestmentProvider(slug);
  if (!provider) notFound();

  const ipo = IPO_PROFILES.find((p) => p.providerId === provider.providerId || p.providerId === provider.id);
  const indirect = listIndirectExposureScores().filter((e) => e.privateProviderId === provider.providerId || e.privateProviderId === provider.id);
  const financials = listFinancialMetrics().filter((m) => m.providerId === provider.providerId || m.providerId === provider.id);
  const valuation = (await listValuationMetricsLive()).find((v) => v.providerId === provider.providerId || v.providerId === provider.id);
  const dnr = doNotRankReason(provider);
  const watchlist = isWatchlistOnly(provider);
  const consumer = calculateConsumerInvestmentPotential(provider);
  const privateIpo = calculatePrivateIpoInvestmentPotential(provider);
  const productScopes = productScopesForVendor(provider.id);

  return (
    <PageFrame
      title={provider.name}
      kicker={`${label(provider.exposureClass)} | ${label(provider.investabilityStatus)}${provider.ticker ? ` | ${provider.ticker}` : ""}`}
      description={provider.keyThesis}
    >
      <WarningStrip />

      <div className="flex items-center justify-end -mt-2">
        <WatchlistToggle providerId={provider.id} providerName={provider.name} />
      </div>

      {(dnr || watchlist) && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <strong>{dnr ? "Do not rank as investable" : "Watchlist only"}.</strong>{" "}
          {dnr ?? "Consumer access is not legitimate, evidence is too thin, or only indirect exposure exists."}
        </div>
      )}

      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Consumer potential" value={consumer.toFixed(0)} note="Quality x attractiveness x horizon" />
        <Metric label="Private/IPO potential" value={privateIpo.toFixed(0)} note="Speculative blend" />
        <Metric label="Retail access penalty" value={calculateRetailAccessPenalty(provider).toFixed(1)} note="Higher = harder to access" />
        <Metric label="Hype penalty" value={calculateHypePenalty(provider).toFixed(1)} note="Valuation x hype minus proof" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="AI provider quality" action={<EvidenceBadge grade={provider.evidenceGrade} />}>
          <div className="mb-3 text-xs text-[#5d6b80]">{calculateAiProviderQualityScore(provider).toFixed(0)}/100 | separates AI relevance from investment attractiveness.</div>
          <div className="space-y-3">
            <ScoreBar label="AI revenue exposure" value={provider.aiRevenueExposureScore} />
            <ScoreBar label="Long-term hold" value={provider.longTermHoldScore} />
            <ScoreBar label="Capital efficiency" value={provider.aiCapitalEfficiencyScore} />
            <ScoreBar label="Regulatory resilience" value={100 - provider.regulatoryRiskScore} />
            <ScoreBar label="Infrastructure independence" value={100 - provider.infrastructureDependencyScore} />
          </div>
        </Panel>

        <Panel title="Investment attractiveness" action={<Confidence value={provider.evidenceConfidence} />}>
          <div className="mb-3 text-xs text-[#5d6b80]">{calculateInvestmentAttractivenessScore(provider).toFixed(0)}/100 | valuation, liquidity, catalyst, retail access.</div>
          <div className="space-y-3">
            <ScoreBar label="Short-term catalyst" value={provider.shortTermCatalystScore} />
            <ScoreBar label="Speculative upside" value={provider.speculativeUpsideScore} />
            <ScoreBar label="Retail access" value={provider.retailAccessScore} />
            <ScoreBar label="Valuation discipline" value={100 - provider.valuationRiskScore} />
            <ScoreBar label="Liquidity discipline" value={100 - provider.liquidityRiskScore} />
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Financial quality">
          {financials.length === 0 ? (
            <p className="text-xs text-[#5d6b80]">No structured financial metrics seeded yet.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {financials.map((m, i) => (
                  <tr key={`${m.metricName}-${i}`} className="border-b border-[#efe9d9] dark:border-[#0a1f38]">
                    <td className="py-1.5 pr-2">{m.metricName}</td>
                    <td className="py-1.5 pr-2 font-mono">{m.value}</td>
                    <td className="py-1.5 pr-2 text-[#5d6b80]">{m.period}</td>
                    <td className="py-1.5 pr-2 text-[#5d6b80]" title={`${m.sourceName}`}>{m.sourceType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Valuation snapshot">
          {!valuation ? (
            <p className="text-xs text-[#5d6b80]">No public valuation metrics for this provider.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                ["Market cap", valuation.marketCap],
                ["EV", valuation.enterpriseValue],
                ["EV/Revenue", valuation.evRevenue],
                ["EV/Gross profit", valuation.evGrossProfit],
                ["EV/FCF", valuation.evFcf],
                ["P/E", valuation.peRatio],
                ["PEG", valuation.pegRatio],
                ["CapEx/Rev %", valuation.capexRevenue],
                ["SBC/Rev %", valuation.sbcRevenue],
                ["RPO growth %", valuation.rpoGrowth],
                ["FCF margin %", valuation.fcfMargin],
              ].filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-[#5d6b80]">{k}</dt>
                  <dd className="font-mono">{typeof v === "number" ? v.toFixed(2) : String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>

      {ipo && (
        <Panel title="IPO watch">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div><div className="text-[#5d6b80]">Stage</div><div className="font-mono">{ipo.rumourStage}</div></div>
            <div><div className="text-[#5d6b80]">Rumour quality</div><div className="font-mono">{ipo.rumourQualityScore}/100</div></div>
            <div><div className="text-[#5d6b80]">Readiness</div><div className="font-mono">{ipo.readinessScore}/100</div></div>
            <div><div className="text-[#5d6b80]">Pricing risk</div><div className="font-mono text-rose-700 dark:text-rose-400">{ipo.pricingRiskScore}/100</div></div>
            <div><div className="text-[#5d6b80]">Lock-up risk</div><div className="font-mono">{ipo.lockupRisk}/100</div></div>
            <div><div className="text-[#5d6b80]">Float</div><div className="font-mono">{ipo.expectedFloat}%</div></div>
            <div><div className="text-[#5d6b80]">Forecast</div><div>{ipo.postIpoForecast.replace(/_/g, " ")}</div></div>
            <div><div className="text-[#5d6b80]">Next watch</div><div>{ipo.nextWatchEvent}</div></div>
          </div>
          {ipo.missingEvidence.length > 0 && (
            <p className="mt-3 text-[11px] text-[#5d6b80]">Missing: {ipo.missingEvidence.join(" | ")}</p>
          )}
        </Panel>
      )}

      {indirect.length > 0 && (
        <Panel title="Indirect exposure routes">
          <ul className="space-y-2 text-xs">
            {indirect.map((e) => (
              <li key={e.publicTicker} className="flex items-center justify-between gap-3 rounded border border-[#efe9d9] px-3 py-2 dark:border-[#1d3a57]">
                <span><span className="font-mono">{e.publicTicker}</span> | {e.exposureType}</span>
                <span className="font-mono">score {(e.indirectExposureScore ?? 0).toFixed(0)} | confidence {e.confidence.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[#5d6b80]">Indirect exposure is not the same as direct ownership of the private AI provider.</p>
        </Panel>
      )}

      <Panel title="Product scope and evidence">
        <div className="grid gap-3 md:grid-cols-2">
          {productScopes.map((scope) => (
            <div key={scope.id} className="rounded-md border border-[#efe9d9] p-3 text-xs dark:border-[#1d3a57]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{scope.productName}</div>
                  <div className="mt-1 text-[#5d6b80] dark:text-[#8fa5bb]">{label(scope.productCategory)} | {scope.productType}</div>
                </div>
                <SeedDataBadge label={label(scope.evidenceStatus)} provenance={scope.evidenceStatus === "verified" || scope.evidenceStatus === "documented" ? "live" : "seed"} />
              </div>
              <p className="mt-2 leading-5 text-[#54647a] dark:text-[#a7bacd]">{scope.uncertaintyNote}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Confidence value={scope.confidenceScore} />
                <span className="rounded border border-[#e0d6ba] px-1.5 py-0.5 text-[11px] text-[#5b6b7f] dark:border-[#2a4a6b] dark:text-[#a7bacd]">
                  Sources: {scope.sourceIds.join(", ")}
                </span>
              </div>
            </div>
          ))}
          {productScopes.length === 0 && (
            <p className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">No ProductScope record. This provider should remain hidden from scoped analysis until inventory is added.</p>
          )}
        </div>
      </Panel>

      <Panel title="What would change the score">
        <ul className="list-disc pl-5 text-xs space-y-1 text-[#54647a] dark:text-[#a7bacd]">
          <li>Verified financial filings (10-K / 10-Q / S-1) raising evidence grade beyond E2.</li>
          <li>Disclosure of AI revenue contribution moving aiRevenueExposureScore.</li>
          <li>Material change in valuation multiples vs revenue growth durability.</li>
          <li>Concrete IPO milestone (S-1 filed, lock-up expiry, first earnings) advancing rumour stage.</li>
          <li>New indirect exposure route or change in cloud / model partner concentration.</li>
        </ul>
      </Panel>

      <div className="mt-6">
        <Link href="/investor-tools" className="text-xs text-[#b08d2f] hover:underline">Back to Investment Intelligence</Link>
      </div>
    </PageFrame>
  );
}
