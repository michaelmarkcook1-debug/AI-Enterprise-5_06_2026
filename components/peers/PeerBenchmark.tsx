"use client";

// Peer-AI benchmark — the interactive your-org-vs-peers surface.
// ──────────────────────────────────────────────────────────────
// Heatmap (rows = observable AI signals, columns = peers, 4-level qualitative
// scale) + per-peer drill-down showing the cited evidence behind every cell.
// The data is the curated, cited starter set in lib/peer/peer-adoption-data.ts;
// this component only ARRANGES it — no scoring, no derivation, no writes.
// Selection state (primary org + peer scope) is saved per-browser in
// localStorage — editable any time, and it never touches canonical data.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PEER_COMPANIES, PEER_DATASET_SOURCE } from "@/lib/peer/peer-adoption-data";
import { buildPeerHeatmap, LEVEL_LABELS, SIGNAL_KINDS } from "@/lib/peer/heatmap";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import type { PeerSignal } from "@/lib/peer/types";

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

const ORG_KEY = "ae_peer_primary_org";
const SCOPE_KEY = "ae_peer_scope";

/** Gold intensity steps for the 4 qualitative levels (on-brand, theme-safe). */
const LEVEL_BG: Record<1 | 2 | 3 | 4, string> = {
  1: "bg-[#d4af37]/15",
  2: "bg-[#d4af37]/30",
  3: "bg-[#d4af37]/50",
  4: "bg-[#d4af37]/75",
};

function CellChip({ signal }: { signal: PeerSignal }) {
  if (signal.status === "not_disclosed" || !signal.level) {
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${MUTED}`}>
        Not disclosed
      </span>
    );
  }
  const est = signal.status === "inferred";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={est ? "Inferred from disclosed metrics — estimate, not asserted" : "From disclosed, cited sources"}
    >
      <span
        className={`h-2.5 w-6 shrink-0 rounded ${LEVEL_BG[signal.level]} ${
          est ? "border border-dashed border-amber-600/60" : ""
        }`}
        aria-hidden
      />
      <span className="text-[11px] font-medium">{LEVEL_LABELS[signal.level]}</span>
      {est && <span className="text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300">est.</span>}
    </span>
  );
}

export default function PeerBenchmark({ companyIds }: { companyIds?: string[] } = {}) {
  // Optional segment scoping (corrected peer model): when the parent passes the
  // cohort's exemplar ids, the heatmap only ever shows companies from the
  // user's own segment. No ids = the full starter set (legacy behaviour).
  const COMPANIES = useMemo(
    () => (companyIds && companyIds.length > 0 ? PEER_COMPANIES.filter((c) => companyIds.includes(c.id)) : PEER_COMPANIES),
    [companyIds],
  );
  const allIds = useMemo(() => COMPANIES.map((c) => c.id), [COMPANIES]);
  const [orgId, setOrgId] = useState<string>("");
  const [scope, setScope] = useState<string[]>(allIds);
  const [focusId, setFocusId] = useState<string>("");

  // Hydrate saved selection AFTER first render (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      const savedOrg = window.localStorage.getItem(ORG_KEY);
      const savedScope = window.localStorage.getItem(SCOPE_KEY);
      if (savedOrg && allIds.includes(savedOrg)) setOrgId(savedOrg);
      if (savedScope) {
        const ids = JSON.parse(savedScope) as string[];
        const valid = ids.filter((id) => allIds.includes(id));
        if (valid.length > 0) setScope(valid);
      }
    } catch {
      /* saved state is a convenience — never let it break the page */
    }
  }, [allIds]);

  const saveOrg = (id: string) => {
    setOrgId(id);
    try {
      if (id) window.localStorage.setItem(ORG_KEY, id);
      else window.localStorage.removeItem(ORG_KEY);
    } catch { /* ignore */ }
  };

  const toggleScope = (id: string) => {
    setScope((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Keep original dataset order and never allow an empty board.
      const ordered = allIds.filter((x) => next.includes(x));
      const finalScope = ordered.length > 0 ? ordered : prev;
      try { window.localStorage.setItem(SCOPE_KEY, JSON.stringify(finalScope)); } catch { /* ignore */ }
      return finalScope;
    });
  };

  // Primary org always shows, first; then the rest of the scope.
  const columnsIds = useMemo(() => {
    const rest = scope.filter((id) => id !== orgId);
    return orgId ? [orgId, ...rest] : rest;
  }, [orgId, scope]);

  const heatmap = useMemo(() => buildPeerHeatmap(columnsIds), [columnsIds]);
  const focus = heatmap.columns.find((c) => c.id === focusId) ?? null;

  return (
    <div className="space-y-6">
      {/* ── Scope controls: your org + editable peer set (saved per browser) ── */}
      <div className={`${CARD} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Your organisation</span>
            <select
              value={orgId}
              onChange={(e) => saveOrg(e.target.value)}
              className="rounded-md border border-black/15 bg-white/80 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-[#0a1f38]"
            >
              <option value="">— not selected —</option>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <p className={`text-[11px] ${MUTED}`}>
            Named exemplars with publicly disclosed AI deployments — never private usage.
            Your selection is saved in this browser only.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {COMPANIES.map((c) => {
            const on = scope.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleScope(c.id)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? "border-[#d4af37]/60 bg-[#d4af37]/15 font-medium"
                    : `border-black/10 dark:border-white/15 ${MUTED} hover:border-black/25 dark:hover:border-white/30`
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className={`${CARD} overflow-x-auto p-4`}>
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className={`pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>
                Observable signal
              </th>
              {heatmap.columns.map((c) => {
                const isOrg = c.id === orgId;
                return (
                  <th key={c.id} className="pb-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setFocusId(c.id === focusId ? "" : c.id)}
                      className={`rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline ${
                        isOrg ? "ring-1 ring-[#d4af37] bg-[#d4af37]/10" : ""
                      } ${focusId === c.id ? "bg-black/5 dark:bg-white/10" : ""}`}
                      title="Show the cited evidence behind this peer's cells"
                    >
                      {c.name}
                      {isOrg && <span className="ml-1 text-[9px] font-bold uppercase text-[#b08d2f] dark:text-[#d4af37]">You</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.meta.kind} className="border-t border-black/5 dark:border-white/10">
                <td className="max-w-[220px] py-2.5 pr-3 align-top">
                  <p className="text-sm font-medium leading-snug">{row.meta.label}</p>
                  {row.meta.kind === "automation_intensity" && (
                    <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">always inferred (est.)</p>
                  )}
                </td>
                {row.cells.map((cell) => (
                  <td
                    key={cell.companyId}
                    className={`py-2.5 pr-3 align-top ${cell.companyId === orgId ? "bg-[#d4af37]/[0.06]" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setFocusId(cell.companyId === focusId ? "" : cell.companyId)}
                      className="block text-left"
                      title="Show the cited evidence"
                    >
                      <CellChip signal={cell.signal} />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-black/5 pt-3 text-[11px] dark:border-white/10 ${MUTED}`}>
          <span className="font-semibold">Scale (computed from cited evidence via the documented rubric):</span>
          {(Object.keys(LEVEL_BG) as unknown as (1 | 2 | 3 | 4)[]).map((lvl) => (
            <span key={lvl} className="inline-flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded ${LEVEL_BG[lvl]}`} aria-hidden />
              {LEVEL_LABELS[lvl]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block rounded border border-dashed border-amber-600/60 px-1 text-[9px] font-semibold uppercase text-amber-700 dark:text-amber-300">est.</span>
            inferred from disclosed metrics
          </span>
          <span>“Not disclosed” = no observable public evidence — never a guess.</span>
        </div>
      </div>

      {/* ── Drill-down: the cited evidence behind one peer's cells ── */}
      {focus && (
        <div className={`${CARD} p-5`}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-[var(--font-display)] text-lg font-bold tracking-tight">
              {focus.name} — evidence behind the cells
            </h3>
            <button type="button" onClick={() => setFocusId("")} className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
              Close
            </button>
          </div>
          <div className="space-y-4">
            {SIGNAL_KINDS.map((meta) => {
              const s = focus.signals.find((x) => x.kind === meta.kind);
              if (!s || s.status === "not_disclosed") {
                return (
                  <div key={meta.kind} className="border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className={`mt-1 text-sm ${MUTED}`}>
                      Not disclosed — no observable public evidence compiled. Absence here is
                      under-coverage or genuine non-disclosure, never a low rating.
                    </p>
                  </div>
                );
              }
              return (
                <div key={meta.kind} className="border-t border-black/5 pt-3 first:border-t-0 first:pt-0 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <CellChip signal={s} />
                  </div>
                  {s.summary && <p className="mt-1.5 text-sm leading-6">{s.summary}</p>}
                  {s.status === "inferred" && s.inferenceNote && (
                    <p className="mt-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200">
                      {s.inferenceNote}
                    </p>
                  )}
                  {(s.vendorIds ?? []).length > 0 && (
                    <p className={`mt-1.5 text-xs ${MUTED}`}>
                      Disclosed platforms:{" "}
                      {(s.vendorIds ?? []).map((v, i) => (
                        <span key={v}>
                          {i > 0 && " · "}
                          <Link href={`/vendors/${v}`} className="font-medium underline underline-offset-2">
                            {TRACKED_VENDOR_NAMES[v] ?? v}
                          </Link>
                        </span>
                      ))}
                      <span className="ml-1">(opens the vendor's assessment)</span>
                    </p>
                  )}
                  <ul className={`mt-1.5 space-y-0.5 text-[11px] ${MUTED}`}>
                    {(s.citations ?? []).map((cite) => (
                      <li key={cite.url}>
                        <a href={cite.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#15263c] dark:hover:text-[#eef3f8]">
                          {cite.title}
                        </a>{" "}
                        — {cite.publisher}
                        {cite.publishedAt ? ` · ${cite.publishedAt}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className={`text-[11px] ${MUTED}`}>{PEER_DATASET_SOURCE}</p>
    </div>
  );
}
