// DESIGN PREVIEW — Direction A (revised): "Evidence Ledger", dark-green identity.
// Per feedback: dark green replaces navy/blue; standard SaaS sans (Geist) replaces
// the Cormorant serif; both LIGHT and DARK views shown. Real data only
// (getCategoryComposites) — no fabrication. Green is the BRAND colour, never a
// score encoding (scores stay neutral ink; confidence = single-hue green intensity),
// so the no-red↔green rule holds.

import type { CSSProperties } from "react";
import Link from "next/link";
import { getCategoryComposites } from "@/lib/ranking/category-composite";
import type { CategoryComposite } from "@/lib/ranking/composite-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Design A — Evidence Ledger (green)", robots: { index: false } };

type Theme = {
  bg: string; panel: string; rule: string; ruleStrong: string;
  ink: string; inkStrong: string; muted: string; accent: string; accentSoft: string;
};

const LIGHT: Theme = {
  bg: "#f6f3ea", panel: "#fbf9f2", rule: "#e4ddca", ruleStrong: "#17392e",
  ink: "#33403a", inkStrong: "#12332a", muted: "#6a746c", accent: "#1c5f46", accentSoft: "rgba(28,95,70,0.08)",
};
const DARK: Theme = {
  bg: "#0d1712", panel: "#111d17", rule: "#243329", ruleStrong: "#3a5548",
  ink: "#c3cec6", inkStrong: "#eef3ee", muted: "#7f8f85", accent: "#5cae89", accentSoft: "rgba(92,174,137,0.12)",
};

// Confidence → single-hue green intensity (never a red↔green diverging scale).
function dotStyle(c: number | null, t: Theme): CSSProperties {
  const op = c == null ? 0.28 : 0.35 + 0.65 * Math.max(0, Math.min(1, c / 100));
  return { background: t.accent, opacity: op };
}

function Ledger({ label, theme, composites }: { label: string; theme: Theme; composites: CategoryComposite[] }) {
  const t = theme;
  return (
    <section style={{ background: t.bg, color: t.ink }} className="px-6 py-14 md:px-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: t.muted }}>
          <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: t.accent }} />
          {label} view
        </div>

        {/* Masthead */}
        <header className="border-b pb-6" style={{ borderColor: t.ruleStrong }}>
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.26em]" style={{ color: t.accent }}>
                Enterprise AI · Evidence Ledger
              </p>
              <h1 className="font-semibold tracking-[-0.025em]" style={{ color: t.inkStrong, fontSize: "clamp(2.2rem,5vw,3.7rem)", lineHeight: 1.02 }}>
                Who leads, who’s exposed,
                <br />
                <span style={{ color: t.accent }}>and who’s coming for them.</span>
              </h1>
            </div>
            <div className="hidden shrink-0 text-right md:block">
              <p className="text-[2.9rem] font-semibold leading-none tabular-nums" style={{ color: t.inkStrong }}>140</p>
              <p className="mt-1 text-[12px] leading-tight" style={{ color: t.muted }}>vendors under<br />continuous review</p>
            </div>
          </div>
          <p className="mt-5 max-w-[64ch] text-[14.5px] leading-relaxed" style={{ color: t.ink }}>
            Every score traces to a public source — a weighted composite of evidence-graded pillars,
            coverage-discounted, never a market-share proxy. Thin evidence reads <em>insufficient</em>, never a guess.
          </p>
        </header>

        {/* Ledger */}
        <div className="mt-10 grid gap-x-14 gap-y-11 md:grid-cols-2">
          {composites.map((c) => (
            <div key={c.category.id}>
              <div className="mb-2 flex items-baseline justify-between border-b pb-2" style={{ borderColor: t.ruleStrong }}>
                <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em]" style={{ color: t.inkStrong }}>{c.category.name}</h2>
                <Link href={`/category/${c.category.id}`} className="text-[11.5px] font-semibold uppercase tracking-wider hover:underline" style={{ color: t.accent }}>
                  Full ledger →
                </Link>
              </div>
              <ol>
                {c.ranked.slice(0, 3).map((v, i) => (
                  <li key={v.vendorId} className="grid grid-cols-[1.3rem_1fr_auto] items-center gap-3 py-2.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${t.rule}` }}>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: t.accent }}>{v.rank}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium" style={{ color: t.inkStrong }}>{v.vendorName}</span>
                      {v.rank === 1 && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.accent, background: t.accentSoft }}>
                          Leader
                        </span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-2.5">
                      <span aria-hidden className="inline-block h-[7px] w-[7px] rounded-full" style={dotStyle(v.compositeConfidence, t)} title={`${v.compositeConfidence ?? "—"}% confidence`} />
                      <span className="text-[1.15rem] font-semibold leading-none tabular-nums" style={{ color: t.inkStrong }}>
                        {v.assessmentComposite == null ? "—" : v.assessmentComposite.toFixed(2)}
                      </span>
                      <span className="text-[11px]" style={{ color: t.muted }}>/5</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {composites.length === 0 && (
          <p className="mt-14 text-[14.5px]" style={{ color: t.muted }}>
            Live rankings are momentarily unavailable — shown only when backed by verified evidence.
          </p>
        )}

        <footer className="mt-14 flex items-center justify-between border-t pt-5 text-[12px]" style={{ borderColor: t.rule, color: t.muted }}>
          <span>Evidence Ledger · {label.toLowerCase()}</span>
          <span className="font-semibold tracking-tight" style={{ color: t.accent }}>AI Enterprise</span>
        </footer>
      </div>
    </section>
  );
}

export default async function DesignAPreview() {
  const composites = (await getCategoryComposites().catch(() => []))
    .filter((c) => c.isLive && c.ranked.length > 0)
    .slice(0, 6);

  return (
    <main>
      <Ledger label="Light" theme={LIGHT} composites={composites} />
      <Ledger label="Dark" theme={DARK} composites={composites} />
    </main>
  );
}
