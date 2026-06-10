// Monitor — is the AI decision still valid?
// ──────────────────────────────────────────
// The fifth component of the CIO Decision Lifecycle. Monitors whether
// prior AI recommendations remain valid by tracking:
//   1. Recommendation validity & drift
//   2. Assumption health
//   3. Vendor change signals (product, funding, M&A, outages, pricing)
//   4. Regulation & risk watch
//   5. Reputation shifts
//   6. Reassessment queue
//
// MVP sources: existing watchlists, news items, risk alerts, vendor
// momentum, provenance. Clearly labelled as estimated/seed where live
// data is not yet connected.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  getMarketDashboard,
  listIntelligenceVendors,
  listVendorMomentum,
  listNewsItems,
  listWatchlists,
} from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { isRankable } from "@/lib/intelligence/roles";
import ShortlistVendorCards from "@/components/shortlist-vendor-cards";
import AnalystInsight from "@/components/analyst-insight";
import TrendSpark from "@/components/trend-spark";
import { getRankingHistories } from "@/lib/intelligence/ranking-snapshots";
import { monitorInsight } from "@/lib/insights/tab-insights";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const [dashboard, vendors, momentum, news, watchlists, provenance] = await Promise.all([
    getMarketDashboard(),
    listIntelligenceVendors(),
    listVendorMomentum(),
    listNewsItems(),
    listWatchlists(),
    getDataProvenance(),
  ]);

  const momentumByVendor = new Map(momentum.map((m) => [m.vendorId, m]));

  // Simulated recommendation drift — MVP uses the top-5 vendors by
  // overall score as "active recommendations" and computes drift from
  // momentum signals. Will be replaced by real stored recommendations
  // when the assessment → monitor pipeline is wired.
  // Role-aware: recommendations track assessable AI products only (exclude
  // investors and pure hardware/fabs).
  const topVendors = [...vendors].filter(isRankable).sort((a, b) => b.overallScore - a.overallScore).slice(0, 8);
  // Score histories for hover trend lines — real snapshots merged over
  // reconstructed series (provenance carried through to the tooltip).
  const histories = await getRankingHistories(vendors, momentum);

  const recommendations = topVendors.map((v) => {
    const mom = momentumByVendor.get(v.id);
    const drift = mom ? Math.round((mom.momentumScore - 60) * 0.4) : 0;
    const action: "monitor" | "reassess_this_quarter" | "reassess_now" =
      Math.abs(drift) >= 12 ? "reassess_now"
      : Math.abs(drift) >= 6 ? "reassess_this_quarter"
      : "monitor";
    return { vendor: v, momentum: mom, drift, action };
  });

  // Simulated assumptions — derived from the competitive targets and
  // risk alerts. Each assumption has a status based on recent news.
  const assumptions = [
    {
      id: "asm_1",
      title: "Anthropic retains enterprise coding advantage",
      status: "stable" as const,
      failureTrigger: "OpenAI or Google ships native enterprise coding agents with equivalent safety controls.",
      currentSignal: "No direct competitor announcement in the last 30 days.",
      action: "Continue monitoring product launches.",
    },
    {
      id: "asm_2",
      title: "Harvey retains legal workflow differentiation",
      status: "watch" as const,
      failureTrigger: "Anthropic or OpenAI launches native legal workflow agents with document review and matter management.",
      currentSignal: "Frontier models increasingly capable at legal reasoning; no native workflow product yet.",
      action: "Reassess legal AI stack if frontier vendor launches legal-specific product.",
    },
    {
      id: "asm_3",
      title: "GPU supply normalises within 12 months",
      status: "at_risk" as const,
      failureTrigger: "Extended NVIDIA supply constraints or export control escalation.",
      currentSignal: "Geopolitical tension and demand growth continue to pressure supply.",
      action: "Evaluate multi-cloud inference and alternative hardware strategies.",
    },
    {
      id: "asm_4",
      title: "EU AI Act compliance timeline holds",
      status: "stable" as const,
      failureTrigger: "Accelerated enforcement or broadened scope of high-risk classification.",
      currentSignal: "Implementation proceeding on published timeline.",
      action: "Monitor regulatory gazette and vendor compliance statements.",
    },
  ];

  const ASSUMPTION_TONE = {
    stable: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    watch: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
    at_risk: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    broken: "bg-red-200 text-red-900 dark:bg-red-950/60 dark:text-red-200",
  };

  const ACTION_LABEL = {
    monitor: { label: "Monitor", tone: "text-emerald-700 dark:text-emerald-300" },
    reassess_this_quarter: { label: "Reassess this quarter", tone: "text-amber-700 dark:text-amber-300" },
    reassess_now: { label: "Reassess now", tone: "text-rose-700 dark:text-rose-300" },
  };

  // Recent vendor change events — top news classified as decision-relevant
  const vendorChangeEvents = news
    .filter((n) => n.categories.some((c) => ["Product launch", "Pricing", "Partnership", "Risk event", "Strategy signal", "Market movement"].includes(c)))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8);

  // Reassessment queue — count by priority
  const reassessNow = recommendations.filter((r) => r.action === "reassess_now").length;
  const reassessQuarter = recommendations.filter((r) => r.action === "reassess_this_quarter").length;
  const monitorOnly = recommendations.filter((r) => r.action === "monitor").length;

  return (
    <PageFrame
      title="Monitor"
      kicker="Is the AI decision still valid?"
      description="Track whether prior AI recommendations remain defensible. Monitors recommendation drift, assumption health, vendor change signals, regulation, and reputation shifts. Surfaces reassessment triggers before decisions degrade."
    >
      <AnalystInsight paragraph={monitorInsight({
        activeRecommendations: recommendations.length,
        reassessNow,
        reassessQuarter,
        brokenAssumptions: assumptions.filter((a) => a.status === "at_risk").length,
        vendorSignals: vendorChangeEvents.length,
        largestDrift: (() => {
          const sorted = [...recommendations].sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
          return sorted[0] ? { name: sorted[0].vendor.name, drift: sorted[0].drift } : null;
        })(),
      })} />

      {/* 0. Assessed shortlist cards — restored from the assessment session */}
      <ShortlistVendorCards
        universe={vendors.filter(isRankable).map((v) => ({ id: v.id, name: v.name, category: v.category, score: v.overallScore, confidence: v.confidenceScore, ownershipType: v.ownershipType }))}
      />

      {/* 1. Monitor executive summary — 6 top cards */}
      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MonitorCard label="Active recommendations" value={recommendations.length} tone="neutral" />
        <MonitorCard label="Reassess now" value={reassessNow} tone={reassessNow > 0 ? "red" : "green"} />
        <MonitorCard label="Reassess this quarter" value={reassessQuarter} tone={reassessQuarter > 0 ? "amber" : "green"} />
        <MonitorCard label="Broken assumptions" value={assumptions.filter((a) => a.status === "at_risk").length} tone={assumptions.some((a) => a.status === "at_risk") ? "red" : "green"} />
        <MonitorCard label="Vendor signals" value={vendorChangeEvents.length} tone="neutral" />
        <MonitorCard label="Monitor only" value={monitorOnly} tone="green" />
      </section>

      {/* 2. Recommendation drift */}
      <section className="mb-6">
        <Panel
          title="Recommendation validity & drift"
          action={<SeedDataBadge label="Estimated" provenance="seed" reason="Drift computed from momentum signals against a baseline of 60. Will use real stored recommendations when assessment→monitor pipeline is wired." />}
        >
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Active recommendations scored against current market signals, grouped by category — scores compare within a category, never across.
            Negative drift means conditions have moved against the recommendation. Hover a trend line for the window and provenance.
          </p>
          <div className="space-y-5">
            {[...new Set(recommendations.map((r) => r.vendor.category))].map((category) => (
              <div key={category}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">
                  {category}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e6dcc3] text-left text-xs uppercase tracking-wide text-[#56657b]">
                        <th className="py-2 pr-3">Vendor</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2 pr-3">Trend</th>
                        <th className="py-2 pr-3">Momentum</th>
                        <th className="py-2 pr-3">Drift</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.filter((r) => r.vendor.category === category).map((r) => {
                        const a = ACTION_LABEL[r.action];
                        const h = histories.get(r.vendor.id);
                        return (
                          <tr key={r.vendor.id} className="border-b border-[#efe9d9]/60">
                            <td className="py-2.5 pr-3">
                              <VendorNameWithOwnership name={r.vendor.name} ownershipType={r.vendor.ownershipType} />
                            </td>
                            <td className="py-2.5 pr-3 font-mono">{r.vendor.overallScore}</td>
                            <td className="py-2.5 pr-3">
                              {h && h.points.length >= 2 ? (
                                <TrendSpark
                                  label={`${r.vendor.name} — overall score`}
                                  points={h.points.map((pt) => ({ date: pt.date, value: pt.score }))}
                                  provenance={"sourceLabel" in h && (h as { sourceLabel?: string }).sourceLabel === "snapshot" ? "snapshot" : "reconstructed"}
                                />
                              ) : (
                                <span className="text-[10px] text-[#7e8a99]">accumulating</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 font-mono">{r.momentum?.momentumScore.toFixed(0) ?? "—"}</td>
                            <td className={`py-2.5 pr-3 font-mono font-semibold ${r.drift > 0 ? "text-emerald-700 dark:text-emerald-300" : r.drift < 0 ? "text-rose-700 dark:text-rose-300" : "text-zinc-500"}`}>
                              {r.drift > 0 ? "+" : ""}{r.drift}
                            </td>
                            <td className={`py-2.5 font-semibold text-xs ${a.tone}`}>{a.label}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* 3. Assumption monitor */}
      <section className="mb-6">
        <Panel title="Assumption health">
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Key assumptions underpinning the current AI strategy. Each is monitored for signals that could invalidate it.
          </p>
          <div className="space-y-3">
            {assumptions.map((a) => (
              <div key={a.id} className="rounded-lg border border-[#e6dcc3] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#13294b] dark:text-zinc-100">{a.title}</div>
                    <div className="mt-1 text-xs text-[#56657b] dark:text-zinc-400">
                      <strong>Failure trigger:</strong> {a.failureTrigger}
                    </div>
                    <div className="mt-1 text-xs text-[#56657b] dark:text-zinc-400">
                      <strong>Current signal:</strong> {a.currentSignal}
                    </div>
                    <div className="mt-1 text-xs text-[#56657b] dark:text-zinc-400">
                      <strong>Action:</strong> {a.action}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ASSUMPTION_TONE[a.status]}`}>
                    {a.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <SeedDataBadge label="Estimated" provenance="seed" reason="Assumptions are curated examples. Will be populated from stored assessment outputs when the pipeline is wired." />
          </div>
        </Panel>
      </section>

      {/* 4. Vendor change feed */}
      <section className="mb-6">
        <Panel
          title="Vendor change signals"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live" : "Seed"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <div className="divide-y divide-[#efe9d9] dark:divide-zinc-800">
            {vendorChangeEvents.map((item) => (
              <div key={item.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#13294b] dark:text-zinc-100">{item.title}</div>
                  <span className="font-mono text-xs text-[#5b6b7f] dark:text-zinc-500">{item.impactScore}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-[#5d6b80] dark:text-zinc-400">{item.whyItMatters}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.categories.slice(0, 3).map((c) => (
                    <span key={c} className="rounded bg-[#f3ead2] px-2 py-0.5 text-[10px] text-[#455044] dark:bg-zinc-800 dark:text-zinc-300">{c}</span>
                  ))}
                  <Confidence value={item.confidenceScore} />
                </div>
              </div>
            ))}
            {vendorChangeEvents.length === 0 && <div className="py-3 text-sm text-zinc-500">No recent change signals.</div>}
          </div>
        </Panel>
      </section>

      {/* 5. Risk & regulation watch */}
      <section className="mb-6 grid gap-5 lg:grid-cols-2">
        <Panel
          title="Enterprise risk alerts"
          action={<SeedDataBadge label={provenance.source === "live" ? "Live" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />}
        >
          <div className="space-y-3">
            {dashboard.riskAlerts.slice(0, 5).map((item) => (
              <div key={item.vendor.id} className="rounded-md bg-[#faf8f1] px-3 py-2 dark:bg-amber-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    <VendorNameWithOwnership name={item.vendor.name} ownershipType={item.vendor.ownershipType} />
                  </span>
                  <span className="text-xs uppercase text-[#8a5b2d] dark:text-amber-300">{item.severity}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-[#5f665a] dark:text-zinc-400">{item.alert}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Active watchlists">
          <div className="space-y-3">
            {watchlists.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No watchlists configured. Set one up in <Link href="/assess#watchlists" className="underline font-semibold">Assess</Link>.
              </p>
            ) : (
              watchlists.slice(0, 5).map((w) => (
                <div key={w.id} className="rounded-md border border-[#e6dcc3] bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-sm font-medium text-[#13294b] dark:text-zinc-100">{w.name}</div>
                  <div className="mt-1 text-xs text-[#56657b] dark:text-zinc-400">
                    {w.vendors?.length ?? 0} vendors · {w.categories?.length ?? 0} categories
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>

      {/* 6. Regulation monitor */}
      <section className="mb-6">
        <Panel title="Regulation & compliance watch">
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Regulatory developments that could affect your AI strategy. Sourced from classified news with regulation/compliance tags.
          </p>
          <div className="space-y-3">
            {news
              .filter((n) => n.categories.some((c) => c.toLowerCase().includes("regulat") || c.toLowerCase().includes("compliance") || c.toLowerCase().includes("risk")))
              .slice(0, 4)
              .map((item) => (
                <div key={item.id} className="rounded-md border border-[#e6dcc3] bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#13294b] dark:text-zinc-100">{item.title}</span>
                    <span className="font-mono text-[10px] text-[#5b6b7f]">{item.impactScore}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#5f665a] dark:text-zinc-400">{item.whyItMatters}</div>
                  <div className="mt-1"><Confidence value={item.confidenceScore} /></div>
                </div>
              ))}
            {news.filter((n) => n.categories.some((c) => c.toLowerCase().includes("regulat") || c.toLowerCase().includes("compliance"))).length === 0 && (
              <p className="text-xs text-zinc-500 italic">No regulation-specific signals in the current news window.</p>
            )}
          </div>
          <SeedDataBadge label={provenance.source === "live" ? "Live" : "Seed"} provenance={provenance.source} reason={provenance.reason} />
        </Panel>
      </section>

      {/* 7. Reputation shift monitor */}
      <section className="mb-6">
        <Panel title="Reputation shift signals">
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Vendor reputation changes that could warrant reassessment. Developer, employee, and customer signal trends.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {topVendors.slice(0, 6).map((v) => {
              const mom = momentumByVendor.get(v.id);
              const repDirection = (mom?.momentumScore ?? 50) > 60 ? "improving" : (mom?.momentumScore ?? 50) < 40 ? "declining" : "stable";
              return (
                <div key={v.id} className="rounded-md border border-[#e6dcc3] bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium"><VendorNameWithOwnership name={v.name} ownershipType={v.ownershipType} /></span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      repDirection === "improving" ? "text-emerald-700 dark:text-emerald-300"
                      : repDirection === "declining" ? "text-rose-700 dark:text-rose-300"
                      : "text-zinc-500"
                    }`}>{repDirection}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#56657b] dark:text-zinc-400">
                    Momentum: {mom?.momentumScore.toFixed(0) ?? "—"} · Confidence: {v.confidenceScore}
                  </div>
                </div>
              );
            })}
          </div>
          <SeedDataBadge label="Estimated" provenance="seed" reason="Reputation direction inferred from momentum signals. Will use dedicated reputation delta when wired." />
        </Panel>
      </section>

      {/* 8. Competitor movement */}
      <section className="mb-6">
        <Panel title="Competitor movement signals">
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Competitor AI adoption and vendor choices that could affect your positioning.
          </p>
          <div className="space-y-3">
            {dashboard.weeklyMovers?.slice(0, 4).map((item) => {
              const status = item.changePct > 0 ? "gaining" : item.changePct < 0 ? "declining" : "stable";
              return (
                <div key={`${item.vendor.id}_${item.reason}`} className={`border-l-2 pl-3 ${status === "gaining" ? "border-emerald-500" : status === "declining" ? "border-rose-500" : "border-zinc-300"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.vendor.name}</span>
                    <span className={`font-mono text-xs ${status === "gaining" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                      {item.changePct > 0 ? "+" : ""}{item.changePct}%
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#5d6b80] dark:text-zinc-400">{item.reason}</div>
                </div>
              );
            })}
          </div>
          <SeedDataBadge label={provenance.source === "live" ? "Live" : "Estimated"} provenance={provenance.source} reason={provenance.reason} />
        </Panel>
      </section>

      {/* 9. Reassessment queue */}
      <section className="mb-6">
        <Panel title="Reassessment queue">
          <p className="mb-3 text-xs text-[#56657b] dark:text-zinc-400">
            Prioritised list of recommendations requiring action, ordered by urgency.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-[#e6dcc3] text-left text-[10px] uppercase tracking-wide text-[#56657b]">
                <th className="py-2 pr-3">Vendor</th><th className="py-2 pr-3">Drift</th><th className="py-2 pr-3">Urgency</th><th className="py-2">Recommended next step</th>
              </tr></thead>
              <tbody>
                {recommendations
                  .filter((r) => r.action !== "monitor")
                  .sort((a, b) => (a.action === "reassess_now" ? 0 : 1) - (b.action === "reassess_now" ? 0 : 1))
                  .map((r) => {
                    const a = ACTION_LABEL[r.action];
                    return (
                      <tr key={r.vendor.id} className="border-b border-[#efe9d9]/60">
                        <td className="py-2 pr-3"><VendorNameWithOwnership name={r.vendor.name} ownershipType={r.vendor.ownershipType} /></td>
                        <td className={`py-2 pr-3 font-mono font-semibold ${r.drift < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{r.drift > 0 ? "+" : ""}{r.drift}</td>
                        <td className={`py-2 pr-3 text-xs font-semibold ${a.tone}`}>{a.label}</td>
                        <td className="py-2 text-xs text-[#56657b]">Review vendor position and update assessment if drift exceeds threshold.</td>
                      </tr>
                    );
                  })}
                {recommendations.filter((r) => r.action !== "monitor").length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-sm text-emerald-700 dark:text-emerald-300">All recommendations stable — no reassessment required.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <SeedDataBadge label="Estimated" provenance="seed" reason="Queue derived from momentum-based drift. Will use stored recommendation history when wired." />
        </Panel>
      </section>

      {/* 10. Navigation context */}
      <section className="mb-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href="/assess" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-zinc-700 dark:hover:bg-zinc-900">← Run new assessment</Link>
          <Link href="/demonstrate" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-zinc-700 dark:hover:bg-zinc-900">Defend decision →</Link>
          <Link href="/query" className="rounded-md border border-[#d6c9a8] px-3 py-2 font-semibold hover:bg-[#f3ead2] dark:border-zinc-700 dark:hover:bg-zinc-900">Market intelligence →</Link>
        </div>
      </section>
    </PageFrame>
  );
}

function MonitorCard({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" | "neutral" }) {
  const border = tone === "red" ? "border-rose-200 dark:border-rose-900/60" : tone === "amber" ? "border-amber-200 dark:border-amber-900/60" : tone === "green" ? "border-emerald-200 dark:border-emerald-900/60" : "border-[#e6dcc3] dark:border-zinc-800";
  const bg = tone === "red" ? "bg-rose-50 dark:bg-rose-950/30" : tone === "amber" ? "bg-amber-50 dark:bg-amber-950/30" : tone === "green" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-white dark:bg-zinc-900";
  const text = tone === "red" ? "text-rose-700 dark:text-rose-300" : tone === "amber" ? "text-amber-700 dark:text-amber-300" : tone === "green" ? "text-emerald-700 dark:text-emerald-300" : "text-[#13294b] dark:text-zinc-100";
  const labelColor = tone === "red" ? "text-rose-800 dark:text-rose-300" : tone === "amber" ? "text-amber-800 dark:text-amber-300" : tone === "green" ? "text-emerald-800 dark:text-emerald-300" : "text-[#5b6b7f] dark:text-zinc-500";
  return (
    <div className={`rounded-xl border ${border} ${bg} p-3`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${labelColor}`}>{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${text}`}>{value}</div>
    </div>
  );
}
