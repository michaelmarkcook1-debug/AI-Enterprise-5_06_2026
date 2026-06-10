"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { TIERS, type AssessmentTier, parseTier } from "@/lib/assessment/tiers";

interface Props {
  current: AssessmentTier;
}

/**
 * Per-tier brand palette.
 *
 * Designed for at-a-glance signal of depth/cost:
 *   Quick     → emerald (entry, fastest)
 *   Guided    → sky    (balanced, decision-shaping)
 *   Advanced  → amber  (procurement-grade, premium)
 *
 * Each tier carries an `accentBar` (the tag line at the top of the
 * card) and a paired set of active / inactive surface classes so the
 * card can render in either state without re-deriving colour logic.
 */
const TIER_STYLE: Record<AssessmentTier, {
  badgeLabel: string;
  accentBar: string;
  activeClass: string;
  inactiveClass: string;
  metaActive: string;
  metaInactive: string;
  descActive: string;
  descInactive: string;
  pillActive: string;
  pillInactive: string;
}> = {
  quick: {
    badgeLabel: "Tier 1 · Opportunity",
    accentBar: "bg-emerald-500",
    activeClass:
      "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 dark:border-emerald-400 dark:bg-emerald-500 dark:text-white",
    inactiveClass:
      "border-emerald-200 bg-emerald-50/60 text-zinc-900 hover:bg-emerald-100/70 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-zinc-100 dark:hover:bg-emerald-950/60",
    metaActive: "text-white/85",
    metaInactive: "text-emerald-800/80 dark:text-emerald-300",
    descActive: "text-white/90",
    descInactive: "text-zinc-700 dark:text-zinc-300",
    pillActive: "bg-white/20 text-white",
    pillInactive: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
  },
  guided: {
    badgeLabel: "Tier 2 · Strategy",
    accentBar: "bg-sky-500",
    activeClass:
      "border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-600/20 dark:border-sky-400 dark:bg-sky-500 dark:text-white",
    inactiveClass:
      "border-sky-200 bg-sky-50/60 text-zinc-900 hover:bg-sky-100/70 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-zinc-100 dark:hover:bg-sky-950/60",
    metaActive: "text-white/85",
    metaInactive: "text-sky-800/80 dark:text-sky-300",
    descActive: "text-white/90",
    descInactive: "text-zinc-700 dark:text-zinc-300",
    pillActive: "bg-white/20 text-white",
    pillInactive: "bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100",
  },
  advanced: {
    badgeLabel: "Tier 3 · Procurement",
    accentBar: "bg-amber-500",
    activeClass:
      "border-amber-600 bg-amber-600 text-white shadow-sm shadow-amber-600/20 dark:border-amber-400 dark:bg-amber-500 dark:text-white",
    inactiveClass:
      "border-amber-200 bg-amber-50/60 text-zinc-900 hover:bg-amber-100/70 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-zinc-100 dark:hover:bg-amber-950/60",
    metaActive: "text-white/85",
    metaInactive: "text-amber-900/80 dark:text-amber-300",
    descActive: "text-white/90",
    descInactive: "text-zinc-700 dark:text-zinc-300",
    pillActive: "bg-white/20 text-white",
    pillInactive: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  },
};

export default function TierBar({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const setTier = useCallback(
    (tier: AssessmentTier) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      next.set("tier", tier);
      router.replace(`/assessment?${next.toString()}`, { scroll: false });
    },
    [router, params],
  );

  return (
    <div className="mb-6 rounded-xl border border-[#e6dcc3] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Provenance strip — AnalystGenius proprietary methodology */}
      <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-2 rounded-t-xl bg-gradient-to-r from-[#0c1220] via-[#13294b] to-[#0c1220] px-4 py-2.5 text-[11px] font-medium text-white">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-amber-400 text-[10px] font-black text-[#0c1220]"
        >
          AG
        </span>
        <span className="font-semibold tracking-wide">AnalystGenius proprietary methodology</span>
        <span className="hidden sm:inline text-white/60">·</span>
        <span className="hidden sm:inline text-white/80">
          Source-cited · evidence-graded (E0–E5) · scoring engine v1.2.0
        </span>
        <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0c1220]">
          Proprietary
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Assessment depth
        </div>
        <div className="text-[10px] text-zinc-400">
          colour codes tier · click to switch
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TIERS.map((t) => {
          const active = parseTier(current) === t.id;
          const style = TIER_STYLE[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(t.id)}
              aria-pressed={active}
              className={`relative overflow-hidden rounded-lg border px-4 py-3 text-left transition-colors ${
                active ? style.activeClass : style.inactiveClass
              }`}
            >
              {/* Accent bar so the tier reads as a colour even when
                  inactive (the muted background may otherwise be too
                  subtle on small displays). */}
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`} />

              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className={`mb-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      active ? style.pillActive : style.pillInactive
                    }`}
                  >
                    {style.badgeLabel}
                  </div>
                  <div className="text-sm font-semibold">{t.label}</div>
                </div>
                <div
                  className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                    active
                      ? "border-white/40 text-white"
                      : "border-current/30 text-zinc-500 dark:text-zinc-400"
                  }`}
                  title="AnalystGenius proprietary"
                >
                  AG
                </div>
              </div>
              <div className={`mt-1 text-[11px] ${active ? style.metaActive : style.metaInactive}`}>
                {t.estTime}
              </div>
              <div className={`mt-2 text-xs leading-5 ${active ? style.descActive : style.descInactive}`}>
                {t.description}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-zinc-500">
        Your answers persist when you switch tiers — pick the depth that matches the decision
        you&apos;re making. All three tiers use the AnalystGenius proprietary scoring engine
        with industry-weighted pillars and the E0–E5 evidence grading scale.
      </p>
    </div>
  );
}
