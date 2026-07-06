// AIE-01 — Frontier model face-off. Renders lib/model-inventory/frontier.ts's
// FrontierComparison as a side-by-side table: one column per tracked vendor,
// one row per agreed comparison category, so all four carry the SAME fields
// (the ticket's "consistent, agreed set of fields across all four"). Every
// column cites its own source + as-of date (AnalystGenius rule) — nothing
// renders without a visible trace back to the evidence. Pure server component:
// no client state, no per-request LLM call — the data underneath is already
// pre-computed platform work (lib/model-inventory/live.ts).

import Link from "next/link";
import type { FrontierColumn, FrontierComparison } from "@/lib/model-inventory/frontier";
import { COMPARE_CATEGORIES } from "@/lib/model-inventory/frontier";

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function fmt(n: number | undefined): string {
  return typeof n === "number" ? Math.round(n).toLocaleString() : "—";
}

function ColumnHead({ col }: { col: FrontierColumn }) {
  if (!col.present) {
    return (
      <th className="min-w-[150px] py-2 px-3 text-left align-bottom">
        <div className="text-sm font-semibold">{col.vendorName}</div>
        <p className={`mt-1 text-[11px] italic ${MUTED}`}>Not on the tracked leaderboard yet</p>
      </th>
    );
  }
  return (
    <th className="min-w-[150px] py-2 px-3 text-left align-bottom">
      <Link href={`/vendors/${col.vendorId}`} className="text-sm font-semibold hover:underline underline-offset-2">
        {col.vendorName}
      </Link>
      <div className={`mt-0.5 text-xs ${MUTED}`}>{col.modelName}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {col.overallRank && (
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              col.overallRank === 1
                ? "border-[#b08d2f] bg-[#d4af37]/15 text-[#8a6d1f] dark:text-[#d4af37]"
                : "border-black/10 dark:border-white/15"
            }`}
          >
            #{col.overallRank} overall
          </span>
        )}
        {col.leadsCategory && col.leadsCategory !== "overall" && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            Leads {COMPARE_CATEGORIES.find((c) => c.key === col.leadsCategory)?.label}
          </span>
        )}
      </div>
    </th>
  );
}

export default function FrontierFaceOff({
  comparison,
  summary,
}: {
  comparison: FrontierComparison;
  summary?: string | null;
}) {
  const c = comparison;
  if (c.presentCount === 0) return null;

  return (
    <section className={`${CARD} mb-8`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
          Frontier model face-off
        </h2>
        {c.asOf && <span className={`text-xs ${MUTED}`}>As of {c.asOf}</span>}
      </div>
      <p className={`${summary ? "mb-1" : "mb-4"} text-xs ${MUTED}`}>
        The four tracked frontier models, each vendor&apos;s single highest-rated model on independent
        LMArena Elo benchmarks — the same fields for all four, so they compare like for like.
      </p>
      {summary && (
        <p className="mb-4 text-sm leading-5 text-[#13294b] dark:text-[#eef3f8]">{summary}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="w-32 py-2 pr-3 text-left align-bottom">
                <span className={`text-xs font-medium uppercase tracking-wide ${MUTED}`}>Category</span>
              </th>
              {c.columns.map((col) => (
                <ColumnHead key={col.vendorId} col={col} />
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_CATEGORIES.map((cat) => (
              <tr key={cat.key} className="border-b border-black/5 dark:border-white/10">
                <td className={`py-2 pr-3 font-medium ${MUTED}`}>{cat.label}</td>
                {c.columns.map((col) => {
                  const value = col.ratings[cat.key];
                  const isLeader = c.categoryLeaders[cat.key] === col.vendorId && typeof value === "number";
                  const elsewhere = col.uncoveredWithOtherModel?.includes(cat.key);
                  return (
                    <td key={col.vendorId} className="py-2 px-3 tabular-nums">
                      {typeof value === "number" ? (
                        <span className={isLeader ? "font-semibold text-[#13294b] dark:text-[#eef3f8]" : undefined}>
                          {fmt(value)}
                        </span>
                      ) : elsewhere ? (
                        <span
                          className={MUTED}
                          title={`A different ${col.vendorName} model has a cited ${cat.label.toLowerCase()} score — not shown here, since this column shows only the tracked flagship model's own ratings.`}
                        >
                          —†
                        </span>
                      ) : (
                        <span className={MUTED}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Source row — every column's data traces to a visible, dated citation. */}
            <tr>
              <td className={`pt-3 pr-3 text-xs font-medium ${MUTED}`}>Source</td>
              {c.columns.map((col) => (
                <td key={col.vendorId} className="pt-3 px-3 text-xs">
                  {col.present && col.sourceUrl ? (
                    <a
                      href={col.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      LMArena{col.publishDate ? ` · ${col.publishDate}` : ""}
                    </a>
                  ) : (
                    <span className={MUTED}>—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className={`mt-4 text-[11px] leading-4 ${MUTED}`}>
        Every rating is an independent LMArena Elo score, cited and dated. A vendor shows only its single
        highest-overall-Elo model — categories are never mixed in from a different model of the same
        vendor. A missing vendor means no benchmarked model yet, never a low or zero score.
        {c.columns.some((col) => col.uncoveredWithOtherModel?.length) && (
          <>
            {" "}
            <strong>†</strong> a different model from that vendor has a cited score in that category —
            withheld here rather than blended into this column, since categories can come from separate,
            model-specific leaderboards.
          </>
        )}
      </p>
    </section>
  );
}
