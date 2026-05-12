"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { TIERS, type AssessmentTier, parseTier } from "@/lib/assessment/tiers";

interface Props {
  current: AssessmentTier;
}

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
    <div className="mb-6 rounded-xl border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Assessment depth
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TIERS.map((t) => {
          const active = parseTier(current) === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(t.id)}
              aria-pressed={active}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-[#192319] bg-[#192319] text-white shadow-sm dark:border-white dark:bg-white dark:text-[#0c1220]"
                  : "border-[#dfe4da] bg-white hover:bg-[#eef2e8] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="text-sm font-semibold">{t.label}</div>
              <div className={`mt-1 text-[11px] ${active ? "text-white/80 dark:text-[#0c1220]/70" : "text-zinc-500"}`}>
                {t.estTime}
              </div>
              <div className={`mt-2 text-xs ${active ? "text-white/90 dark:text-[#0c1220]/80" : "text-zinc-600 dark:text-zinc-400"}`}>
                {t.description}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">
        Your answers persist when you switch tiers — pick the depth that matches the decision you&apos;re making.
      </p>
    </div>
  );
}
