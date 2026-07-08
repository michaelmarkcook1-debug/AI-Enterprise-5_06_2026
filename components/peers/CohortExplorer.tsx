"use client";

// Cohort explorer — the CORRECTED peer model surface (spec rewrite 2 Jul 2026).
// ─────────────────────────────────────────────────────────────────────────────
// "What are enterprises like mine doing with AI?" — the user states their
// segment (vertical × size band × region) and sees:
//   1. the cohort's CITED adoption benchmarks (real surveys, dated, with an
//      honest segment-fit note on every stat) — or "limited data";
//   2. top use-cases in the segment (cited, cross-linked to C6 routes);
//   3. the AI platforms the segment's exemplars have DISCLOSED adopting;
//   4. you-vs-cohort — their self-assessed C6 maturity against the cohort's
//      analyst-curated anchor, explicitly directional;
//   5. named exemplar deployments (the cited heatmap), scoped to the segment.
// Pure arrangement of curated cited data; per-browser saved state only.

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

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";
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

export default function CohortExplorer() {
  const [segment, setSegment] = useState<Segment>(DEFAULT_SEGMENT);
  const [maturity, setMaturity] = useState<MaturityId | "">("");

  // Hydrate saved segment + maturity after mount (SSR-safe).
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
  const benchmark = composed.exact; // anchor + use-cases live on exact-seeded entries
  const exemplars = useMemo(() => exemplarsForSegment(segment), [segment]);
  const platforms = useMemo(() => disclosedPlatformsForSegment(segment), [segment]);
  const position = benchmark && maturity ? youVsCohort(maturity, benchmark) : null;

  const selectCls =
    "rounded-md border border-black/15 bg-white/80 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-[#0a1f38]";

  return (
    <div className="space-y-6">
      {/* ── 1 · Your segment ── */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold">1 · Your segment — who counts as “enterprises like mine”</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className={`text-xs font-medium ${MUTED}`}>Vertical</span>
            <select value={segment.vertical} onChange={(e) => update({ vertical: e.target.value as Segment["vertical"] })} className={selectCls}>
              {VERTICALS.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className={`text-xs font-medium ${MUTED}`}>Size</span>
            <select value={segment.sizeBand} onChange={(e) => update({ sizeBand: e.target.value as Segment["sizeBand"] })} className={selectCls}>
              {SIZE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className={`text-xs font-medium ${MUTED}`}>Region</span>
            <select value={segment.region} onChange={(e) => update({ region: e.target.value as Segment["region"] })} className={selectCls}>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
        </div>
        <p className={`mt-2 text-[11px] ${MUTED}`}>Saved in this browser — re-enter any time and pick up where you left off.</p>
      </section>

      {/* ── 2 · The cohort's adoption picture (cited, layered by scope) ── */}
      {composed.layers.length === 0 ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5" role="status">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            <h2 className="text-sm font-semibold">Limited data for this segment</h2>
          </div>
          <p className={`mt-2 text-sm ${MUTED}`}>
            We haven&apos;t yet compiled credible, citable adoption research applicable to this
            vertical × size × region. Rather than show a manufactured number, we hold the
            benchmark — segments are seeded through the same cited pipeline.
          </p>
        </section>
      ) : (
        <section className={`${CARD} p-5`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">2 · How your cohort is adopting AI</h2>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Cited research, layered by how closely each source matches your segment
            </span>
          </div>
          <div className="space-y-4">
            {composed.layers.map((layer) => (
              <div key={layer.scope}>
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
                  {layer.scopeLabel}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {layer.stats.map((s, i) => (
                    <div key={i} className="rounded-lg border border-black/5 p-4 dark:border-white/10">
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>
                        {STAT_KIND_LABEL[s.kind] ?? s.kind}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-snug">{s.headline}</p>
                      {s.detail && <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{s.detail}</p>}
                      <p className={`mt-2 text-[11px] ${MUTED}`}>
                        <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {s.source.title}
                        </a>{" "}
                        — {s.source.publisher} · {s.source.surveyDate}
                      </p>
                      <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">Fit: {s.segmentFitNote}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {benchmark && benchmark.topUseCases.length > 0 && (
            <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
              <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
                Use-cases observed in your cohort&apos;s disclosed deployments (cited)
              </p>
              <div className="flex flex-wrap gap-2">
                {benchmark.topUseCases.map((u) => (
                  <span key={u.label} className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-2.5 py-1 text-xs dark:border-white/15">
                    {u.categoryRouteId ? (
                      <Link href={`/category/${u.categoryRouteId}`} className="font-medium underline-offset-2 hover:underline">
                        {u.label}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.label}</span>
                    )}
                    <a href={u.source.url} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${MUTED}`} title={`${u.source.title} — ${u.source.publisher}`}>
                      src
                    </a>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 3 · Platforms the cohort's exemplars disclose (supply cross-link) ── */}
      {platforms.length > 0 && (
        <section className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold">3 · AI platforms your cohort has disclosed adopting</h2>
          <p className={`mt-1 text-[11px] ${MUTED}`}>
            Derived from the named exemplars&apos; publicly disclosed adoptions below — disclosure
            counts, not market share. Links open the vendor&apos;s evidence-based assessment.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <li key={p.vendorId}>
                <Link
                  href={`/vendors/${p.vendorId}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-xs font-medium underline-offset-2 hover:underline dark:border-white/15"
                >
                  {TRACKED_VENDOR_NAMES[p.vendorId] ?? p.vendorId}
                  <span className={MUTED}>· {p.adopters} disclosed adopter{p.adopters !== 1 ? "s" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 4 · You vs the cohort (directional, honest) ── */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold">4 · You vs your cohort</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={`text-xs font-medium ${MUTED}`}>Your data &amp; AI maturity</span>
          <select value={maturity} onChange={(e) => saveMaturity(e.target.value as MaturityId | "")} className={selectCls}>
            <option value="">— select —</option>
            {MATURITY_LEVELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        {!benchmark ? (
          <p className={`mt-3 text-sm ${MUTED}`}>
            The directional comparison needs an analyst-curated cohort anchor, which we
            curate segment-by-segment as the cited research lands — not yet available for
            this exact segment. The layered benchmarks above still apply.
          </p>
        ) : !maturity ? (
          <p className={`mt-3 text-sm ${MUTED}`}>Select your maturity to see the directional gap.</p>
        ) : position ? (
          <div className="mt-3 rounded-lg border border-black/5 p-4 dark:border-white/10">
            <p className="text-sm">
              <span
                className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  position.position === "ahead"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : position.position === "behind"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                }`}
              >
                {position.position === "at" ? "In step" : position.position}
              </span>
              {position.position === "at"
                ? "Your self-assessment sits level with the cohort anchor."
                : `Your self-assessment sits ${Math.abs(position.gap)} rung${Math.abs(position.gap) !== 1 ? "s" : ""} ${position.position} of the cohort anchor.`}
            </p>
            <p className={`mt-1.5 text-xs ${MUTED}`}>
              You: {position.userLabel} · Cohort anchor: {position.cohortLabel}
            </p>
            <p className={`mt-1.5 text-[11px] ${MUTED}`}>{position.caveat}</p>
            <p className={`mt-1 text-[11px] ${MUTED}`}>Anchor basis: {benchmark.anchorRationale}</p>
          </div>
        ) : null}
      </section>

      {/* ── 5 · Named exemplar deployments in the segment (cited heatmap) ── */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold">5 · Named exemplar deployments in your segment</h2>
          <p className={`mt-0.5 text-[11px] ${MUTED}`}>
            Specific companies in this cohort with publicly disclosed AI deployments — cited,
            disclosure-only, never private usage.
          </p>
        </div>
        {/* key = the segment → full remount on segment switch, so selection
            state (org / scope / drilldown) can NEVER leak another cohort's
            companies into this heatmap (the "banks showing under pharma" bug). */}
        {exemplars.length > 0 ? (
          <PeerBenchmark
            key={segmentId(segment)}
            companyIds={exemplars.map((c) => c.id)}
          />
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5" role="status">
            <p className={`text-sm ${MUTED}`}>
              No named exemplars compiled for this segment yet — absence here is under-coverage,
              never evidence that nobody in the cohort is deploying AI.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
