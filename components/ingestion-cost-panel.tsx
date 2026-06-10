"use client";

// Ingestion cost panel — shows the REAL estimated Anthropic API cost of a
// full ingestion run before anyone presses the button. Every assumption is
// editable and every stage line is reproducible from the cost model.

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  estimateIngestionCost,
  PRICES,
  type IngestionAssumptions,
} from "@/lib/ingestion/cost-model";

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(0)}K`);

export default function IngestionCostPanel({ vendorCount }: { vendorCount: number }) {
  const [a, setA] = useState<IngestionAssumptions>({ ...DEFAULT_ASSUMPTIONS, vendorCount });
  const est = useMemo(() => estimateIngestionCost(a), [a]);

  const num = (label: string, value: number, set: (n: number) => void, step = 1) => (
    <label className="flex items-center justify-between gap-3 text-xs text-[#3a4a63] dark:text-zinc-300">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => set(Math.max(0, Number(e.target.value)))}
        className="w-24 rounded-md border border-[#d6c9a8] bg-white px-2 py-1 text-right font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </label>
  );

  return (
    <div className="space-y-5">
      {/* Headline estimate */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            Estimated cost — full ingestion run
          </div>
          <div className="font-mono text-3xl font-semibold text-emerald-900 dark:text-emerald-200">{fmtUsd(est.totalUsd)}</div>
          <div className="mt-1 text-[11px] text-[#3a4a63] dark:text-zinc-400">
            {a.vendorCount} vendors · {fmtTok(est.totalInputTokens)} input / {fmtTok(est.totalOutputTokens)} output tokens ·
            prices verified 10 Jun 2026
          </div>
        </div>
        <Link
          href="/admin/ingestion"
          className="rounded-full bg-[#071827] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 dark:bg-emerald-600"
        >
          Run ingestion (admin) →
        </Link>
      </div>

      {/* Per-stage breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e6dcc3] text-[10px] uppercase tracking-wider text-[#5b6b7f] dark:border-zinc-800 dark:text-zinc-500">
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Tier · Model</th>
              <th className="py-2 pr-3 text-right">Calls</th>
              <th className="py-2 pr-3 text-right">Tokens in/out</th>
              <th className="py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {est.stages.map((s) => (
              <tr key={s.stage} className="border-b border-[#efe9d9]/70 dark:border-zinc-800/70">
                <td className="py-2 pr-3 font-medium text-[#13294b] dark:text-zinc-100">
                  {s.stage}
                  {s.note && <span className="ml-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">{s.note}</span>}
                </td>
                <td className="py-2 pr-3 text-[#5b6b7f] dark:text-zinc-400">{s.tier} · {s.model}</td>
                <td className="py-2 pr-3 text-right font-mono">{s.calls}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmtTok(s.inputTokens)} / {fmtTok(s.outputTokens)}</td>
                <td className="py-2 text-right font-mono font-semibold">{fmtUsd(s.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editable assumptions */}
      <details className="rounded-lg border border-[#e6dcc3] p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-xs font-semibold text-[#13294b] dark:text-zinc-100">
          Adjust workload assumptions
        </summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {num("Vendors in run", a.vendorCount, (n) => setA({ ...a, vendorCount: n }))}
          {num("Documents per vendor", a.docsPerVendor, (n) => setA({ ...a, docsPerVendor: n }))}
          {num("Extraction input tokens / doc", a.extraction.inputTokensPerDoc, (n) => setA({ ...a, extraction: { ...a.extraction, inputTokensPerDoc: n } }), 500)}
          {num("Extraction output tokens / doc", a.extraction.outputTokensPerDoc, (n) => setA({ ...a, extraction: { ...a.extraction, outputTokensPerDoc: n } }), 100)}
          {num("Enrichment input tokens / vendor", a.enrichment.inputTokens, (n) => setA({ ...a, enrichment: { ...a.enrichment, inputTokens: n } }), 500)}
          {num("Narrative input tokens / vendor", a.narrative.inputTokens, (n) => setA({ ...a, narrative: { ...a.narrative, inputTokens: n } }), 500)}
          <label className="flex items-center justify-between gap-3 text-xs text-[#3a4a63] dark:text-zinc-300 md:col-span-2">
            <span>Run analyst narratives via Batch API (−50%, async)</span>
            <input
              type="checkbox"
              checked={a.narrative.useBatch}
              onChange={(e) => setA({ ...a, narrative: { ...a.narrative, useBatch: e.target.checked } })}
            />
          </label>
        </div>
      </details>

      {/* Staged model strategy */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-zinc-500">
          Staged model strategy
        </h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#e6dcc3] text-[10px] uppercase tracking-wider text-[#5b6b7f] dark:border-zinc-800 dark:text-zinc-500">
              <th className="py-2 pr-3">Tier</th>
              <th className="py-2 pr-3">Model · $/MTok in/out</th>
              <th className="py-2">Use for</th>
            </tr>
          </thead>
          <tbody className="text-[#3a4a63] dark:text-zinc-300">
            <tr className="border-b border-[#efe9d9]/70 dark:border-zinc-800/70">
              <td className="py-2 pr-3 font-semibold">T1</td>
              <td className="py-2 pr-3 font-mono">{PRICES.haiku.label} · ${PRICES.haiku.inputPerMTok}/${PRICES.haiku.outputPerMTok}</td>
              <td className="py-2">Bulk collection: classification, dedupe, evidence extraction (env: ANTHROPIC_EXTRACT_MODEL)</td>
            </tr>
            <tr className="border-b border-[#efe9d9]/70 dark:border-zinc-800/70">
              <td className="py-2 pr-3 font-semibold">T2</td>
              <td className="py-2 pr-3 font-mono">{PRICES.sonnet.label} · ${PRICES.sonnet.inputPerMTok}/${PRICES.sonnet.outputPerMTok}</td>
              <td className="py-2">Context work: URL discovery, enrichment, summarisation (env: ANTHROPIC_MODEL)</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-semibold">T3</td>
              <td className="py-2 pr-3 font-mono">{PRICES.opus.label} · ${PRICES.opus.inputPerMTok}/${PRICES.opus.outputPerMTok}</td>
              <td className="py-2">Analyst-grade synthesis: insight narratives, board-pack prose — always via Batch API (−50%); cache stable vendor context (reads at 0.1×)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
