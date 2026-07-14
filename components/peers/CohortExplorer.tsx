"use client";

// Cohort explorer — BUYER-FIRST redesign (2026-07-13). The buyer arrives asking
// "what are enterprises like MINE doing, and am I behind?", so the flow now leads
// with the answer, not the apparatus:
//   • one compact segment bar at the top (vertical × size × region);
//   • the HEADLINE: their cohort's cited adoption reality + an inline "are you
//     ahead/behind?" read (optional maturity);
//   • what their peers are running (disclosed vendors → assess, + cited use-cases);
//   • who specifically (named exemplars, cited, disclosure-only);
//   • all the cited research, collapsed for anyone who wants to audit it.
// Same curated cited data as before — only the order and weight change. Honesty
// intact: limited-data states, fit notes, disclosure-only, directional caveats.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  VERTICALS,
  SIZE_BANDS,
  REGIONS,
  segmentId,
  exemplarsForSegment,
  disclosedPlatformsForSegment,
  type Segment,
} from "@/lib/peer/segments";
import { composeBenchmark } from "@/lib/peer/segment-benchmarks";
import { youVsCohort } from "@/lib/peer/you-vs-cohort";
import { MATURITY_LEVELS, type MaturityId } from "@/lib/usecase-front-door";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import PeerBenchmark from "./PeerBenchmark";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

const SEGMENT_KEY = "ae_peer_segment";
const MATURITY_KEY = "ae_peer_maturity";

const DEFAULT_SEGMENT: Segment = {
  vertical: "financial_services",
  sizeBand: "global_enterprise",
  region: "north_america",
};

const STAT_KIND_LABEL: Record<string, string> = {
  adoption_rate: "Adoption",
  maturity: "Maturity",
  use_case: "Use-cases",
  platform_share: "Platforms",
  investment: "Investment",
  other: "Signal",
};

// Ahead/behind is a DIRECTIONAL read (sky↔amber), not a score (never red↔green).
const POSITION_TONE: Record<string, string> = {
  ahead: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  behind: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  at: "bg-black/5 text-[#3f5068] dark:bg-white/10 dark:text-[#c7d4e2]",
};

export default function CohortExplorer() {
  const [segment, setSegment] = useState<Segment>(DEFAULT_SEGMENT);
  const [maturity, setMaturity] = useState<MaturityId | "">("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEGMENT_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Segment;
        if (
          VERTICALS.some((v) => v.id === s.vertical) &&
          SIZE_BANDS.some((b) => b.id === s.sizeBand) &&
          REGIONS.some((r) => r.id === s.region)
        ) {
          setSegment(s);
        }
      }
      const m = window.localStorage.getItem(MATURITY_KEY);
      if (m && MATURITY_LEVELS.some((x) => x.id === m)) setMaturity(m as MaturityId);
    } catch {
      /* saved state is a convenience — never let it break the page */
    }
  }, []);

  const update = (patch: Partial<Segment>) => {
    setSegment((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(SEGMENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const saveMaturity = (m: MaturityId | "") => {
    setMaturity(m);
    try {
      if (m) window.localStorage.setItem(MATURITY_KEY, m);
      else window.localStorage.removeItem(MATURITY_KEY);
    } catch { /* ignore */ }
  };

  const composed = useMemo(() => composeBenchmark(segment), [segment]);
  const benchmark = composed.exact;
  const allStats = useMemo(() => composed.layers.flatMap((l) => l.stats), [composed]);
  const headline = useMemo(
    () => allStats.find((s) => s.kind === "adoption_rate") ?? allStats[0] ?? null,
    [allStats],
  );
  const exemplars = useMemo(() => exemplarsForSegment(segment), [segment]);
  const platforms = useMemo(() => disclosedPlatformsForSegment(segment), [segment]);
  const position = benchmark && maturity ? youVsCohort(maturity, benchmark) : null;
  const hasData = composed.layers.length > 0;

  const verticalLabel = VERTICALS.find((v) => v.id === segment.vertical)?.label ?? segment.vertical;
  const selectCls =
    "rounded-md border border-black/15 bg-white/80 px-2 py-1.5 text-sm font-medium dark:border-white/15 dark:bg-[#0b2519]";

  return (
    <div className="space-y-5">
      {/* ── Segment bar — one input, up top ── */}
      <section className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Enterprises like mine:</span>
          <select aria-label="Industry" value={segment.vertical} onChange={(e) => update({ vertical: e.target.value as Segment["vertical"] })} className={selectCls}>
            {VERTICALS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <select aria-label="Company size" value={segment.sizeBand} onChange={(e) => update({ sizeBand: e.target.value as Segment["sizeBand"] })} className={selectCls}>
            {SIZE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <select aria-label="Region" value={segment.region} onChange={(e) => update({ region: e.target.value as Segment["region"] })} className={selectCls}>
            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </section>

      {/* ── HEADLINE: how your cohort is adopting + are you behind ── */}
      {hasData && headline ? (
        <section className="rounded-2xl border border-[#d4af37]/45 bg-[#fbf6e4]/55 p-6 dark:border-[#d4af37]/30 dark:bg-[#1a1605]/25">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]">
            How your cohort is adopting AI
          </p>
          <p className="mt-2 max-w-3xl text-xl font-semibold leading-snug text-[#123d2c] dark:text-[#eef3f8]">
            {headline.headline}
          </p>
          <p className={`mt-2 text-sm ${MUTED}`}>
            <a href={headline.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline">
              {headline.source.title}
            </a>{" "}
            — {headline.source.publisher} · {headline.source.surveyDate}
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">How well it fits your exact segment: {headline.segmentFitNote}</p>

          {/* Are you behind? — inline, the buyer's #1 question. */}
          <div className="mt-5 border-t border-[#e6dcc3]/70 pt-4 dark:border-[#2a4a6b]/50">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Where do you sit?</span>
              <select aria-label="Your AI maturity" value={maturity} onChange={(e) => saveMaturity(e.target.value as MaturityId | "")} className={selectCls}>
                <option value="">Select your AI maturity…</option>
                {MATURITY_LEVELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            {position ? (
              <div className="mt-3">
                <p className="text-sm">
                  <span className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${POSITION_TONE[position.position]}`}>
                    {position.position === "at" ? "In step" : position.position}
                  </span>
                  {position.position === "at"
                    ? "Your self-assessment sits level with the cohort anchor."
                    : `Your self-assessment sits ${Math.abs(position.gap)} rung${Math.abs(position.gap) !== 1 ? "s" : ""} ${position.position} of the cohort anchor.`}
                </p>
                <p className={`mt-1.5 text-xs ${MUTED}`}>You: {position.userLabel} · Cohort anchor: {position.cohortLabel} · {position.caveat}</p>
              </div>
            ) : !benchmark ? (
              <p className={`mt-2 text-xs ${MUTED}`}>A directional comparison needs an analyst-curated anchor for this exact segment — not compiled yet. The cited adoption above still applies.</p>
            ) : (
              <p className={`mt-2 text-xs ${MUTED}`}>Pick your maturity to see the directional gap — self-assessed, never a score.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6" role="status">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            <h2 className="text-sm font-semibold">Limited data for {verticalLabel} at this size &amp; region</h2>
          </div>
          <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
            We haven&apos;t yet compiled credible, citable adoption research for this exact vertical × size × region.
            Rather than show a manufactured number, we hold the benchmark. Named exemplars for the segment, where we
            have them, still appear below.
          </p>
        </section>
      )}

      {/* ── What your peers are running: vendors + use-cases ── */}
      {(platforms.length > 0 || (benchmark && benchmark.topUseCases.length > 0)) && (
        <section className={`${CARD} p-5`}>
          <h2 className="text-base font-semibold text-[#123d2c] dark:text-[#eef3f8]">What your peers are running</h2>
          {platforms.length > 0 && (
            <div className="mt-3">
              <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>AI platforms they&apos;ve disclosed adopting</p>
              <ul className="flex flex-wrap gap-2">
                {platforms.map((p) => (
                  <li key={p.vendorId}>
                    <Link
                      href={`/vendors/${p.vendorId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-sm font-medium underline-offset-2 hover:border-[#b08d2f] hover:underline dark:border-white/15"
                    >
                      {TRACKED_VENDOR_NAMES[p.vendorId] ?? p.vendorId}
                      <span className={`text-xs ${MUTED}`}>· {p.adopters} disclosed</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {benchmark && benchmark.topUseCases.length > 0 && (
            <div className="mt-4">
              <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>Top use-cases in their disclosed deployments</p>
              <div className="flex flex-wrap gap-2">
                {benchmark.topUseCases.map((u) => (
                  <span key={u.label} className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-2.5 py-1 text-sm dark:border-white/15">
                    {u.categoryRouteId ? (
                      <Link href={`/category/${u.categoryRouteId}`} className="font-medium underline-offset-2 hover:underline">{u.label}</Link>
                    ) : (
                      <span className="font-medium">{u.label}</span>
                    )}
                    <a href={u.source.url} target="_blank" rel="noopener noreferrer" className={`text-xs underline underline-offset-2 ${MUTED}`} title={`${u.source.title} — ${u.source.publisher}`}>src</a>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className={`mt-3 text-xs ${MUTED}`}>
            Publicly <strong>disclosed</strong> adoptions by named exemplars — disclosure counts, not market share.
            Vendor links open the evidence-based assessment.
          </p>
        </section>
      )}

      {/* ── Who specifically — named exemplars ── */}
      <section>
        <h2 className="text-base font-semibold text-[#123d2c] dark:text-[#eef3f8]">Who specifically — named deployments</h2>
        <p className={`mt-0.5 mb-3 text-xs ${MUTED}`}>
          Companies in your cohort with publicly disclosed AI deployments — cited, disclosure-only, never private usage.
        </p>
        {exemplars.length > 0 ? (
          <PeerBenchmark key={segmentId(segment)} companyIds={exemplars.map((c) => c.id)} />
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5" role="status">
            <p className={`text-sm ${MUTED}`}>
              No named exemplars compiled for this segment yet — absence here is under-coverage, never evidence that
              nobody in the cohort is deploying AI.
            </p>
          </div>
        )}
      </section>

      {/* ── All the cited research, for anyone who wants to audit it ── */}
      {hasData && (
        <details className={`${CARD} p-4`}>
          <summary className={`cursor-pointer select-none text-sm font-medium ${MUTED} hover:underline`}>
            All cited adoption research for this cohort ({allStats.length}) — layered by how closely each source matches your segment
          </summary>
          <div className="mt-3 space-y-4">
            {composed.layers.map((layer) => (
              <div key={layer.scope}>
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>{layer.scopeLabel}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {layer.stats.map((s, i) => (
                    <div key={i} className="rounded-lg border border-black/5 p-4 dark:border-white/10">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>{STAT_KIND_LABEL[s.kind] ?? s.kind}</p>
                      <p className="mt-1 text-sm font-medium leading-snug">{s.headline}</p>
                      {s.detail && <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{s.detail}</p>}
                      <p className={`mt-2 text-xs ${MUTED}`}>
                        <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s.source.title}</a>{" "}
                        — {s.source.publisher} · {s.source.surveyDate}
                      </p>
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Fit: {s.segmentFitNote}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
