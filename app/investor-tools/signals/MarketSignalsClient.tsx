"use client";

import { useMemo, useState } from "react";
import type {
  MarketRegime,
  MarketSignal,
  MarketTalkSignal,
  RegulatoryEvent,
  SignalCategory,
  SignalImpactScore,
} from "@/lib/market-signals/types";

type ScoredSignal = { signal: MarketSignal; score: SignalImpactScore };

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  macro: "Macro",
  political_regulatory: "Political / Regulatory",
  market_sentiment: "Market sentiment",
  company_specific: "Company-specific",
  ai_sector: "AI sector",
  financial_market: "Financial market",
  energy_infrastructure: "Energy / Infra",
  legal_litigation: "Legal / Litigation",
  ipo_specific: "IPO-specific",
  social_market_talk: "Social / market talk",
};

const CATEGORY_COLORS: Record<SignalCategory, string> = {
  macro: "#2563eb",
  political_regulatory: "#b91c1c",
  market_sentiment: "#7c3aed",
  company_specific: "#0f766e",
  ai_sector: "#059669",
  financial_market: "#0284c7",
  energy_infrastructure: "#a16207",
  legal_litigation: "#be185d",
  ipo_specific: "#9333ea",
  social_market_talk: "#71717a",
};

export default function MarketSignalsClient({
  signals,
  scored,
  regime,
  regulatoryEvents,
  marketTalk,
}: {
  signals: MarketSignal[];
  scored: ScoredSignal[];
  regime: MarketRegime;
  regulatoryEvents: RegulatoryEvent[];
  marketTalk: MarketTalkSignal[];
}) {
  const [filter, setFilter] = useState<"all" | SignalCategory>("all");
  const filtered = useMemo(
    () => (filter === "all" ? scored : scored.filter(({ signal }) => signal.signalCategory === filter)),
    [scored, filter],
  );
  const sortedByDate = useMemo(
    () => [...filtered].sort((a, b) => b.signal.sourceDate.localeCompare(a.signal.sourceDate)),
    [filtered],
  );

  const verifiedCount = signals.filter((sig) => sig.dataStatus === "verified" || sig.dataStatus === "documented").length;
  const seedCount = signals.filter((sig) => sig.dataStatus === "seed").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#18201b]">Market Signals</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#596151]">
            Source-cited macro, political, sector, company, and market-talk signals feeding the
            Investment Intelligence and Simulator. Truthfulness gates: low-confidence chatter cannot
            move centre, stale signals are excluded from regime classification, partisan commentary
            needs corroboration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
            {verifiedCount} verified / documented
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            {seedCount} seed
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">
            {marketTalk.length} market-talk items
          </span>
        </div>
      </header>

      <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18201b]">Current market regime</h2>
          <span className="text-xs text-[#697362]">
            Confidence {regime.confidenceScore}/100 · {regime.contributingSignalIds.length} contributing signals
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
          <RegimeChip label="Risk appetite" value={regime.riskAppetite} tone={regime.riskAppetite === "risk_on" ? "ok" : regime.riskAppetite === "risk_off" ? "warn" : "neutral"} />
          <RegimeChip label="Rates" value={regime.rateRegime} tone={regime.rateRegime === "easing" ? "ok" : regime.rateRegime === "tightening" ? "warn" : "neutral"} />
          <RegimeChip label="Inflation" value={regime.inflationRegime} tone={regime.inflationRegime === "disinflation" ? "ok" : regime.inflationRegime === "shock" ? "warn" : "neutral"} />
          <RegimeChip label="Growth" value={regime.growthRegime} tone={regime.growthRegime === "expansion" ? "ok" : regime.growthRegime === "contraction" ? "warn" : "neutral"} />
          <RegimeChip label="Volatility" value={regime.volatilityRegime} tone={regime.volatilityRegime === "low" ? "ok" : regime.volatilityRegime === "stressed" ? "warn" : "neutral"} />
          <RegimeChip label="Tech multiple" value={regime.techMultipleRegime} tone={regime.techMultipleRegime === "expanded" ? "ok" : regime.techMultipleRegime === "compressed" ? "warn" : "neutral"} />
          <RegimeChip label="IPO window" value={regime.ipoWindowQuality} tone={regime.ipoWindowQuality === "open" ? "ok" : regime.ipoWindowQuality === "closed" ? "warn" : "neutral"} />
          <RegimeChip label="AI sentiment" value={regime.aiSentimentRegime} tone={regime.aiSentimentRegime === "exuberant" || regime.aiSentimentRegime === "constructive" ? "ok" : "neutral"} />
          <RegimeChip label="Credit" value={regime.creditRegime} tone={regime.creditRegime === "stressed" ? "warn" : "neutral"} />
          <RegimeChip label="Infra constraint" value={regime.infrastructureConstraintRegime} tone={regime.infrastructureConstraintRegime === "shortage" ? "warn" : "neutral"} />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#697362]">{regime.uncertaintyNote}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All ({scored.length})</FilterPill>
        {(Object.keys(CATEGORY_LABELS) as SignalCategory[]).map((cat) => {
          const count = scored.filter(({ signal }) => signal.signalCategory === cat).length;
          if (count === 0) return null;
          return (
            <FilterPill key={cat} active={filter === cat} onClick={() => setFilter(cat)} color={CATEGORY_COLORS[cat]}>
              {CATEGORY_LABELS[cat]} ({count})
            </FilterPill>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#18201b]">Signal timeline</h2>
          <div className="space-y-3">
            {sortedByDate.map(({ signal, score }) => <SignalCard key={signal.id} signal={signal} score={score} />)}
            {sortedByDate.length === 0 && (
              <div className="rounded-md border border-dashed border-[#dfe4da] p-4 text-sm text-[#697362]">No signals match this filter.</div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[#18201b]">Sentiment vs evidence</h2>
          <p className="mb-3 text-[11px] leading-5 text-[#697362]">
            High-sentiment / low-evidence signals (bottom-right) are market chatter — they widen
            bands but do not move centre. High-sentiment / high-evidence signals (top-right) drive
            scoring.
          </p>
          <SentimentEvidenceScatter scored={filtered} />
        </section>
      </div>

      <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#18201b]">Regulatory events</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#697362]">
              <tr>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Jurisdiction</th>
                <th className="py-2 pr-4">Effective</th>
                <th className="py-2 pr-4">Vendors affected</th>
                <th className="py-2">Top impacts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ebe2]">
              {regulatoryEvents.map((evt) => (
                <tr key={evt.id}>
                  <td className="py-3 pr-4 capitalize">{evt.eventType.replace(/_/g, " ")}</td>
                  <td className="py-3 pr-4 text-xs">{evt.jurisdiction}</td>
                  <td className="py-3 pr-4 text-xs">{evt.effectiveDate ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs text-[#596151]">{evt.affectedVendorIds.length}</td>
                  <td className="py-3 text-xs leading-5 text-[#596151]">
                    market-access {evt.impacts.marketAccessRisk}, valuation {evt.impacts.valuationRisk}, supply-chain {evt.impacts.supplyChainRisk}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#18201b]">Market talk watchlist (low confidence)</h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">band-widener only</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {marketTalk.map((talk) => (
            <div key={talk.id} className="rounded-md border border-[#edf0ea] bg-[#f7f8f5] p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold capitalize text-[#18201b]">{talk.platform}</span>
                <span className="font-mono text-[#697362]">vol {talk.volumeScore} · sent {talk.sentimentScore}</span>
              </div>
              <div className="mt-1 text-[#596151]">{talk.query}</div>
              <div className="mt-1 text-[#697362]">bot-risk {talk.botRiskScore} · repetition {talk.repetitionScore} · confidence {talk.sourceConfidence}/100</div>
              <div className="mt-1 text-[11px] italic text-[#697362]">{talk.uncertaintyNote}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RegimeChip({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "neutral" }) {
  const toneClass = tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warn"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-[#dfe4da] bg-[#f7f8f5] text-[#4d574b]";
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-xs font-semibold capitalize">{value.replace(/_/g, " ")}</div>
    </div>
  );
}

function FilterPill({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
        active
          ? "border-[#192319] bg-[#192319] text-white"
          : "border-[#dfe4da] bg-white text-[#4d574b] hover:bg-[#eef2e8]"
      }`}
      style={!active && color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
    >
      {children}
    </button>
  );
}

function SignalCard({ signal, score }: { signal: MarketSignal; score: SignalImpactScore }) {
  const toneClass = signal.dataStatus === "verified" ? "bg-emerald-100 text-emerald-800"
    : signal.dataStatus === "documented" ? "bg-sky-100 text-sky-800"
      : signal.dataStatus === "seed" ? "bg-amber-100 text-amber-800"
        : "bg-zinc-100 text-zinc-700";
  return (
    <article className="rounded-md border border-[#edf0ea] bg-[#f7f8f5] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full px-2 py-0.5 font-semibold capitalize" style={{ background: `${CATEGORY_COLORS[signal.signalCategory]}22`, color: CATEGORY_COLORS[signal.signalCategory] }}>
              {CATEGORY_LABELS[signal.signalCategory]}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${toneClass}`}>{signal.dataStatus}</span>
            <span className="text-[#697362]">{signal.evidenceGrade} · {signal.sourceDate}</span>
            {signal.requiresHumanReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">review</span>}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-[#18201b]">{signal.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#596151]">{signal.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#697362]">
            <span>Impact <span className="font-mono tabular-nums text-[#18201b]">{score.impactScore}</span>/100</span>
            <span>·</span>
            <span>Confidence <span className="font-mono tabular-nums text-[#18201b]">{score.confidenceScore}</span>/100</span>
            {signal.sourceUrl && (
              <>
                <span>·</span>
                <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#2f5d50] hover:underline">{signal.sourceName}</a>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] italic text-[#697362]">{score.explanation}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-[#697362]">Direction</div>
          <div className={`mt-0.5 text-xs font-semibold ${signal.direction === "positive" ? "text-emerald-700" : signal.direction === "negative" ? "text-rose-700" : "text-amber-700"}`}>
            {signal.direction}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-wide text-[#697362]">Horizon</div>
          <div className="mt-0.5 text-xs capitalize text-[#4d574b]">{signal.timeHorizon.replace(/_/g, " ")}</div>
        </div>
      </div>
    </article>
  );
}

function SentimentEvidenceScatter({ scored }: { scored: ScoredSignal[] }) {
  const w = 480;
  const h = 320;
  const pad = 40;
  return (
    <svg className="h-[320px] w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Sentiment vs evidence scatter">
      <rect width={w} height={h} rx="10" fill="#f7f8f5" />
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#aab4a2" />
      <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="#aab4a2" />
      <line x1={(pad + w - pad) / 2} x2={(pad + w - pad) / 2} y1={pad} y2={h - pad} stroke="#dfe4da" strokeDasharray="3 3" />
      <line x1={pad} x2={w - pad} y1={(pad + h - pad) / 2} y2={(pad + h - pad) / 2} stroke="#dfe4da" strokeDasharray="3 3" />
      {scored.map(({ signal, score }) => {
        const xPct = (signal.sentiment + 1) / 2;
        const yPct = score.confidenceScore / 100;
        const cx = pad + xPct * (w - pad * 2);
        const cy = h - pad - yPct * (h - pad * 2);
        const radius = Math.max(4, score.impactScore / 8);
        return (
          <g key={signal.id}>
            <title>{`${signal.title}\nConfidence ${score.confidenceScore} · Impact ${score.impactScore}\n${signal.dataStatus}`}</title>
            <circle cx={cx} cy={cy} r={radius} fill={CATEGORY_COLORS[signal.signalCategory]} fillOpacity={signal.dataStatus === "seed" ? 0.4 : 0.78} stroke="white" strokeWidth="1" />
          </g>
        );
      })}
      <text x={pad} y={h - 6} fontSize="10" fill="#697362">← negative sentiment / positive sentiment →</text>
      <text x={pad - 4} y={pad - 6} fontSize="10" fill="#697362">↑ evidence confidence</text>
    </svg>
  );
}
