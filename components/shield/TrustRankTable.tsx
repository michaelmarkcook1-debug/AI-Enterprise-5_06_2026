"use client";

// The Trust Rank — the Privacy & IP Shield as a ranked, re-weightable table.
// ─────────────────────────────────────────────────────────────────────────────
// Ported from The Desk (components/TrustRankTable.tsx) and rebuilt on this app's
// palette. Two things deliberately did NOT come across:
//   • the delta badge — it read a hand-committed baseline because The Desk has no
//     database. We have a nightly cron, so Shield history should be captured for
//     real (like vendor_score_history) rather than snapshotted by hand. Until
//     that lands there is no delta, and a missing delta beats a fake one.
//   • StarButton — cookie-backed. This app has a DB-backed watchlist; wiring it
//     is a follow-up, so the column is absent rather than inert.
//
// The invariant that MUST survive any edit here: re-weighting reorders rows. It
// never changes a mark, a glyph, or a receipt. Same verified facts, your
// priorities. If you ever find yourself deriving a mark from a weight, stop.

import { useMemo, useState } from "react";
import {
  DEFAULT_SHIELD_WEIGHTS,
  rankedShieldWeighted,
  shieldCoverage,
  SHIELD_DIM_INFO,
  SHIELD_VERSION,
  type Mark,
  type MarkState,
  type ShieldDim,
  type ShieldWeights,
} from "@/lib/shield/data";
import { vendorIdForShieldSlug } from "@/lib/shield/vendor-map";
import Link from "next/link";

const GLYPH: Record<MarkState, string> = { protective: "✓", conditional: "◐", adverse: "✗", unverified: "—" };

// The glyph carries the meaning; colour only reinforces it. That ordering is
// deliberate — it survives colour-blindness and greyscale printing, which a
// board pack will eventually get put through.
const TONE: Record<MarkState, string> = {
  protective: "border-[#3f9d76]/50 text-[#2f8f66] dark:text-[#3f9d76]",
  conditional: "border-[#d4af37]/50 text-[#b08d2f] dark:text-[#d4af37]",
  adverse: "border-[#c2410c]/40 text-[#c2410c] dark:border-[#ea7317]/40 dark:text-[#ea7317]",
  unverified: "border-black/12 text-[#123d2c]/40 dark:border-white/12 dark:text-[#eef3f8]/35",
};

const WEIGHT_LABEL = ["off", "standard", "high priority", "must-have"];

/** What raises vs lowers each column's mark — hover/focus, never a wall of text. */
const COL_INFO: Record<string, string> = {
  training:
    "Raises trust: the vendor states in writing it will NOT train on your prompts/outputs. Lowers trust: it trains by default, or no such commitment is published.",
  retention:
    "Raises trust: short, bounded retention or a Zero Data Retention (ZDR) option you can turn on. Lowers trust: indefinite retention with no customer control, or nothing published.",
  indemnity:
    "Raises trust: the vendor will defend you against third-party IP claims on model outputs. Lowers trust: no indemnity is offered, or none is publicly documented.",
  residency:
    "Raises trust: you can choose where your data is processed/stored, or you self-host it. Lowers trust: data is forced into one jurisdiction with no choice, or nothing published.",
  shield:
    "The combined score: ✓ protective = 1, ◐ conditional = 0.5, ✗ adverse and — unverified = 0, summed across the four columns (or weighted, if you customise above). Higher = a stronger verified trust posture.",
};

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function InfoIcon({ topic }: { topic: keyof typeof COL_INFO }) {
  return (
    <span
      tabIndex={0}
      title={COL_INFO[topic]}
      aria-label={COL_INFO[topic]}
      className="ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-current/40 text-[9px] normal-case outline-none hover:border-[#b08d2f] hover:text-[#b08d2f] focus-visible:border-[#b08d2f] dark:hover:border-[#d4af37] dark:hover:text-[#d4af37]"
    >
      i
    </span>
  );
}

/** n/4 verified. Amber when there are gaps, so a low score built from real
 *  adverse facts never reads the same as one padded with blanks. */
function CoveragePip({ n }: { n: number }) {
  return (
    <span
      title={`${n} of 4 dimensions verified — a blank ("—") is a gap in OUR receipts, scored 0. It is not a verdict on the vendor.`}
      className={`font-mono text-[12px] tabular-nums ${n === 4 ? MUTED : "text-[#b08d2f] dark:text-[#d4af37]"}`}
    >
      {n}/4
    </span>
  );
}

/** Every mark links its receipt. A mark with no source can only be unverified. */
function MarkChip({ mark }: { mark: Mark }) {
  const inner = (
    <span
      title={mark.note}
      className={`inline-flex h-7 min-w-11 items-center justify-center rounded-lg border bg-white/60 px-2 font-mono text-[12px] dark:bg-white/5 ${TONE[mark.state]}`}
    >
      {GLYPH[mark.state]}
    </span>
  );
  return mark.source ? (
    <a href={mark.source.url} target="_blank" rel="noopener noreferrer" title={`${mark.note}\n\nSource: ${mark.source.name}`}>
      {inner}
    </a>
  ) : (
    inner
  );
}

export default function TrustRankTable() {
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState<ShieldWeights>({ ...DEFAULT_SHIELD_WEIGHTS });

  const isDefault = SHIELD_DIM_INFO.every((d) => weights[d.key] === DEFAULT_SHIELD_WEIGHTS[d.key]);
  const ranked = useMemo(() => rankedShieldWeighted(weights), [weights]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#b08d2f] dark:text-[#d4af37]">
          The Privacy &amp; IP Shield · model providers only
        </p>
        <span className={`rounded-full border border-[#d4af37]/40 px-2.5 py-1 font-mono text-[12px] uppercase ${MUTED}`}>
          v{SHIELD_VERSION} · every mark links its receipt
        </span>
      </div>

      {/* Re-weighting: order changes, facts don't. */}
      <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="mb-5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-black/12 px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide hover:border-[#b08d2f] dark:border-white/12 dark:hover:border-[#d4af37]">
          <span aria-hidden>{open ? "▾" : "▸"}</span> Weight it your way
        </summary>
        <div className="mt-3 rounded-xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
          <p className={`mb-3 text-sm leading-6 ${MUTED}`}>
            A healthcare CIO may not care about output indemnity but treat residency as a hard requirement. Re-weight
            below and the order changes — <strong className="font-semibold">the marks never do</strong>. Same verified
            facts, your priorities.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHIELD_DIM_INFO.map((d) => (
              <label key={d.key} className="block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className={`font-mono text-[12px] ${MUTED}`}>{WEIGHT_LABEL[weights[d.key as ShieldDim]]}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={weights[d.key as ShieldDim]}
                  onChange={(e) => setWeights((w) => ({ ...w, [d.key]: Number(e.target.value) }))}
                  className="mt-1.5 w-full accent-[#b08d2f] dark:accent-[#d4af37]"
                  aria-label={`${d.label} weight`}
                />
                <span className={`text-xs ${MUTED}`}>{d.blurb}</span>
              </label>
            ))}
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => setWeights({ ...DEFAULT_SHIELD_WEIGHTS })}
              className="mt-3 rounded-md border border-black/15 px-3 py-1.5 text-xs hover:border-[#b08d2f] dark:border-white/15 dark:hover:border-[#d4af37]"
            >
              Reset to equal weights
            </button>
          )}
        </div>
      </details>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className={`border-b border-black/10 font-mono text-[12px] uppercase tracking-wide dark:border-white/10 ${MUTED}`}>
              <th scope="col" className="py-2 pr-2 font-normal">#</th>
              <th scope="col" className="py-2 pr-4 font-normal">Vendor</th>
              {SHIELD_DIM_INFO.map((d) => (
                <th key={d.key} scope="col" className="py-2 pr-3 font-normal">
                  <span className="inline-flex items-center">
                    {d.label}
                    <InfoIcon topic={d.key} />
                  </span>
                </th>
              ))}
              <th scope="col" className="py-2 pr-3 font-normal">
                <span className="inline-flex items-center">
                  Shield
                  <InfoIcon topic="shield" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((v, i) => {
              const vendorId = vendorIdForShieldSlug(v.slug);
              const cov = shieldCoverage(v);
              const pct = v.max > 0 ? (v.score / v.max) * 100 : 0;
              return (
                <tr key={v.slug} className="border-b border-black/5 dark:border-white/5">
                  <td className={`py-3 pr-2 font-mono text-[12px] tabular-nums ${MUTED}`}>{i + 1}</td>
                  <td className="py-3 pr-4">
                    <span className="flex flex-wrap items-center gap-2">
                      {vendorId ? (
                        <Link href={`/vendors/${vendorId}`} className="font-semibold underline-offset-2 hover:underline">
                          {v.vendor}
                        </Link>
                      ) : (
                        // No profile to link to — the Shield tracks it, we don't.
                        <span className="font-semibold">{v.vendor}</span>
                      )}
                      {v.kind === "open-weights" && (
                        <span
                          title="You host the weights yourself, so the lab's terms don't govern your data the way a hosted API's do. Judge it on a different axis, not a better one."
                          className={`rounded-full border border-black/12 px-1.5 py-0.5 font-mono text-[12px] uppercase dark:border-white/15 ${MUTED}`}
                        >
                          Open weights — different trust model
                        </span>
                      )}
                    </span>
                  </td>
                  {(["training", "retention", "indemnity", "residency"] as ShieldDim[]).map((dim) => (
                    <td key={dim} className="py-3 pr-3">
                      <MarkChip mark={v.marks[dim]} />
                    </td>
                  ))}
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums">{v.score}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/8 dark:bg-white/10" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#3f9d76] to-[#d4af37]"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <CoveragePip n={cov} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
