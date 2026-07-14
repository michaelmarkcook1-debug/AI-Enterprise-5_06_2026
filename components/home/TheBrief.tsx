// The Brief — the homepage "since you last looked" digest. Renders the real,
// dated, cited events from lib/brief/market-brief. Pure server component: no
// client JS, house palette only (gold + ink, never red↔green), tabular dates.
// Honest by construction — an empty window shows a real pivot, never filler.

import Link from "next/link";
import type { MarketBrief } from "@/lib/brief/market-brief";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function fmt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const KIND: Record<"news" | "model", { label: string; cls: string }> = {
  news: { label: "News", cls: "border-[#123d2c]/15 text-[#123d2c] dark:border-white/20 dark:text-[#c8d7e9]" },
  model: { label: "New model", cls: "border-[#b08d2f]/40 bg-[#b08d2f]/10 text-[#8a6d1f] dark:text-[#d4af37]" },
};

export default function TheBrief({ brief }: { brief: MarketBrief }) {
  const { items, horizon, sinceLabel, newCount } = brief;
  const hasItems = items.length > 0;

  return (
    <section className="mb-8 rounded-xl border border-[#d4af37]/40 bg-[#fbf6e4]/50 p-5 dark:border-[#d4af37]/30 dark:bg-[#1a1605]/25">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">The Brief</h2>
          {newCount > 0 && (
            <span className="rounded-full bg-[#b08d2f] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#0b2519]">
              {newCount} new since you last looked
            </span>
          )}
        </div>
        <span className={`text-xs ${MUTED}`}>Evidence-backed moves {sinceLabel} — every item dated &amp; sourced</span>
      </div>

      {hasItems ? (
        <ul className="divide-y divide-[#e6dcc3]/70 dark:divide-[#2a4a6b]/50">
          {items.map((it, i) => (
            <li key={`${it.kind}-${i}-${it.href}`} className="flex items-baseline gap-3 py-2">
              <time className={`w-12 shrink-0 font-mono text-xs tabular-nums ${MUTED}`}>{fmt(it.date)}</time>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${KIND[it.kind].cls}`}>
                {KIND[it.kind].label}
              </span>
              <span className="min-w-0 flex-1">
                {it.external ? (
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#123d2c] underline-offset-2 hover:underline dark:text-[#eef3f8]"
                  >
                    {it.title}
                    <span aria-hidden className="ml-0.5 text-xs text-[#7a8aa0]">↗</span>
                  </a>
                ) : (
                  <Link
                    href={it.href}
                    className="text-sm font-medium text-[#123d2c] underline-offset-2 hover:underline dark:text-[#eef3f8]"
                  >
                    {it.title}
                  </Link>
                )}
                <span className={`ml-2 text-xs ${MUTED}`}>{it.sourceLabel}</span>
              </span>
              {it.isNew && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#e8c95c]" aria-label="new since your last visit" />}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-sm ${MUTED}`}>
          Quiet {sinceLabel} — nothing new verified in the market feed. Meanwhile, compare models on{" "}
          <Link href="/models" className="underline underline-offset-2 hover:no-underline">cost vs capability</Link>{" "}
          or browse the <Link href="/vendors" className="underline underline-offset-2 hover:no-underline">rankings</Link>.
        </p>
      )}

      {horizon.length > 0 && (
        <div className="mt-3 border-t border-[#e6dcc3]/70 pt-3 dark:border-[#2a4a6b]/50">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>On the regulatory horizon</span>
            {horizon.map((h) => (
              <span key={h.shortName} className="text-xs">
                <a
                  href={h.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#123d2c] underline-offset-2 hover:underline dark:text-[#eef3f8]"
                >
                  {h.shortName}
                </a>
                <span className={MUTED}>
                  {" "}{h.upcoming ? "in force" : "in force since"} {fmt(h.inForceDate)} · {h.jurisdictionLabel}
                </span>
              </span>
            ))}
            <Link href="/legislation" className={`text-xs underline-offset-2 hover:underline ${MUTED}`}>
              full tracker →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
