// Public AI Stocks — live quotes + news overlaid on the seed ranking.
//
// Replaces the previous seed-only display with an enriched view that
// adds: live Yahoo Finance quote (price + 1-day pct change), live
// share-of-named-vendor-usage from the 2026-05 uptake research, live
// AI Atlas quadrant position, and live classified news count (latest
// headline shown on hover via the title attribute).
//
// All live fields gracefully degrade to "—" when the underlying source
// returns null (rate limit, missing ticker, vendor not on the spine).
// Seed scoring columns (Quality / Attractiveness / horizons / Valuation
// risk / Confidence / Main risk) are unchanged — they remain the
// model's primary ranking inputs; live data is overlay, not replacement.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { listInvestmentProviderScores } from "@/lib/investing/intelligence";
import { enrichInvestmentProviders } from "@/lib/investing/live-data";
import { WarningStrip, label } from "../investing-ui";

export const dynamic = "force-dynamic";

const QUADRANT_LABEL: Record<string, string> = {
  leaders: "Leaders",
  challengers: "Challengers",
  visionaries: "Visionaries",
  niche: "Niche",
};

function fmtPrice(price: number, currency: string | null): string {
  const sym = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "";
  return `${sym}${price.toFixed(2)}`;
}

function fmtPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function pctClass(pct: number | null): string {
  if (pct === null) return "text-[#5d6b80]";
  if (pct > 0.05) return "text-emerald-700 dark:text-emerald-300";
  if (pct < -0.05) return "text-rose-700 dark:text-rose-300";
  return "text-[#5d6b80] dark:text-[#a7bacd]";
}

export default async function PublicAiStocksPage() {
  const rows = listInvestmentProviderScores()
    .filter((row) =>
      row.provider.investabilityStatus === "public_direct"
      || row.provider.investabilityStatus === "public_indirect"
      || row.provider.investabilityStatus === "etf_indirect",
    )
    .sort((a, b) => b.consumerInvestmentPotential - a.consumerInvestmentPotential);

  // Enrich every provider with live data in parallel. Yahoo Finance fan-out
  // happens here; shared lookups (vendors / news / atlas / pillars) are
  // cached once inside enrichInvestmentProviders.
  const enrichedList = await enrichInvestmentProviders(rows.map((r) => r.provider));
  const enrichedById = new Map(enrichedList.map((e) => [e.provider.id, e]));

  const liveQuoteCount = enrichedList.filter((e) => e.quote !== null).length;
  const liveNewsCount = enrichedList.reduce((sum, e) => sum + e.news.filter((n) => n.isLive).length, 0);

  return (
    <PageFrame
      title="Public AI stocks"
      kicker="Live quotes + ranking + classified news"
      description="Public direct + indirect AI exposure with model-driven quality, attractiveness, horizon scores, and valuation discipline — overlaid with live Yahoo Finance quotes, share-of-named-vendor-usage (Demonstrate uptake research), AI Atlas position, and the latest classified news per name. Ranked under this model, not investment advice."
    >
      <WarningStrip />

      {/* Live-data summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tracked tickers" value={rows.length} />
        <Stat
          label="Live quotes"
          value={`${liveQuoteCount} / ${rows.length}`}
          tone={liveQuoteCount === rows.length ? "ok" : liveQuoteCount > 0 ? "warn" : "bad"}
          note="Yahoo Finance"
        />
        <Stat
          label="Live news items"
          value={liveNewsCount}
          tone={liveNewsCount > 0 ? "ok" : "warn"}
          note="competitive-intel"
        />
        <Stat label="Refreshed" value={new Date().toISOString().slice(11, 19) + " UTC"} note="page render" />
      </div>

      <Panel title="Public AI provider universe — live overlay">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#e6dcc3] dark:border-[#1d3a57] text-left uppercase tracking-wide text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">
              <tr>
                <th className="py-2 pr-2">Provider</th>
                <th className="py-2 pr-2">Ticker</th>
                <th className="py-2 pr-2 text-right">Live price</th>
                <th className="py-2 pr-2 text-right">1d %</th>
                <th className="py-2 pr-2 text-right">Uptake</th>
                <th className="py-2 pr-2">Atlas</th>
                <th className="py-2 pr-2 text-right">News</th>
                <th className="py-2 pr-2 text-right">Quality</th>
                <th className="py-2 pr-2 text-right">Attract.</th>
                <th className="py-2 pr-2 text-right">Long-term</th>
                <th className="py-2 pr-2 text-right">Speculative</th>
                <th className="py-2 pr-2 text-right">Val. risk</th>
                <th className="py-2 pr-2">Confidence</th>
                <th className="py-2 pr-2">Main risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const enriched = enrichedById.get(row.provider.id);
                const quote = enriched?.quote ?? null;
                const uptake = enriched?.uptakeShare ?? null;
                const atlas = enriched?.atlas ?? null;
                const news = enriched?.news ?? [];
                const headline = news[0]?.title ?? "No recent classified news.";
                return (
                  <tr key={row.provider.id} className="border-b border-[#efe9d9] dark:border-[#0a1f38] hover:bg-[#faf5e9] dark:hover:bg-[#0c2238]/40">
                    <td className="py-2 pr-2">
                      <Link href={`/investor-tools/provider/${row.provider.slug}`} className="font-medium hover:underline">
                        {row.provider.name}
                      </Link>
                      <div className="text-[10px] text-[#5d6b80]">{label(row.provider.exposureClass)}</div>
                    </td>
                    <td className="py-2 pr-2 font-mono">{row.provider.ticker ?? "n/a"}</td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {quote ? fmtPrice(quote.price, quote.currency) : "—"}
                    </td>
                    <td className={`py-2 pr-2 text-right font-mono ${pctClass(quote?.pctChange ?? null)}`}>
                      {fmtPct(quote?.pctChange ?? null)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {uptake !== null ? `${(uptake * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 pr-2 text-[11px]">
                      {atlas ? (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            atlas.quadrant === "leaders"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : atlas.quadrant === "challengers"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                              : atlas.quadrant === "visionaries"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                          }`}
                        >
                          {QUADRANT_LABEL[atlas.quadrant]}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right" title={headline}>
                      <span className="font-mono">{news.length}</span>
                      {news.some((n) => n.isLive) && (
                        <SeedDataBadge label="live" provenance="live" />
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">{row.aiProviderQualityScore.toFixed(0)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{row.investmentAttractivenessScore.toFixed(0)}</td>
                    <td className="py-2 pr-2 text-right font-mono">{row.provider.longTermHoldScore}</td>
                    <td className="py-2 pr-2 text-right font-mono">{row.provider.speculativeUpsideScore}</td>
                    <td className="py-2 pr-2 text-right font-mono text-rose-700 dark:text-rose-400">{row.provider.valuationRiskScore}</td>
                    <td className="py-2 pr-2"><Confidence value={row.provider.evidenceConfidence} /></td>
                    <td className="py-2 pr-2 text-[#5d6b80] max-w-[220px] truncate" title={row.provider.mainRisk}>{row.provider.mainRisk}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Per-provider news cards: latest 3 stories for the top 6 providers. */}
      <div className="mt-6">
        <Panel title="Latest classified news on the top-ranked providers">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.slice(0, 6).map((row) => {
              const enriched = enrichedById.get(row.provider.id);
              const news = enriched?.news ?? [];
              if (news.length === 0) {
                return (
                  <div key={row.provider.id} className="rounded-md border border-[#e6dcc3] bg-white p-3 text-xs dark:border-[#1d3a57] dark:bg-[#0c2238]">
                    <div className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{row.provider.name}</div>
                    <p className="mt-2 italic text-[#5d6b80]">No recent classified news.</p>
                  </div>
                );
              }
              return (
                <div key={row.provider.id} className="rounded-md border border-[#e6dcc3] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">{row.provider.name}</span>
                    <SeedDataBadge label={news[0].isLive ? "live" : "seed"} provenance={news[0].isLive ? "live" : "seed"} />
                  </div>
                  <ul className="space-y-2">
                    {news.slice(0, 3).map((n) => (
                      <li key={n.id}>
                        <div className="text-xs font-medium text-[#13294b] dark:text-[#eef3f8]">{n.title}</div>
                        <div className="mt-0.5 text-[11px] leading-4 text-[#475a72] dark:text-[#a7bacd]">{n.whyItMatters}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-[#5d6b80]">
                          <span>{new Date(n.publishedAt).toLocaleDateString()}</span>
                          <span>impact {n.impactScore}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function Stat({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const colorClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "bad"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#13294b] dark:text-[#eef3f8]";
  return (
    <div className="rounded-md border border-[#e6dcc3] bg-white p-2.5 dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
      <div className={`mt-0.5 font-mono text-base font-semibold ${colorClass}`}>{value}</div>
      {note && <div className="text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">{note}</div>}
    </div>
  );
}
