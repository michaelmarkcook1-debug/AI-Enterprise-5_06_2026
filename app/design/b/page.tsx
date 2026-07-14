// DESIGN PREVIEW — Direction B: "Instrument"
// A bolder redirect: near-black warm-ink canvas, off-white, mono-technical labels
// with serif score numerals, a single cool-steel accent, gauge meters. Stark,
// data-forward, confident. Real data only (getCategoryComposites) — no fabrication.

import Link from "next/link";
import { getCategoryComposites } from "@/lib/ranking/category-composite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Design B — Instrument", robots: { index: false } };

const INK = "#0e1013"; // near-black, faintly warm
const PANEL = "#16191e";
const LINE = "#282d35";
const TEXT = "#eef1f4";
const MUTE = "#8b93a0";
const STEEL = "#6ea8ff"; // the single cool accent

// Gold→bright score ramp (never red↔green): intensity encodes the composite.
function ramp(v: number | null): string {
  if (v == null) return "#3a4049";
  const t = Math.max(0, Math.min(1, v / 5));
  // steel-desaturated (low) → luminous steel (high)
  const l = 40 + t * 42;
  const s = 55 + t * 30;
  return `hsl(215 ${s}% ${l}%)`;
}

export default async function DesignBPreview() {
  const composites = (await getCategoryComposites().catch(() => []))
    .filter((c) => c.isLive && c.ranked.length > 0)
    .slice(0, 6);

  return (
    <div style={{ background: INK, color: TEXT }} className="min-h-screen">
      <div className="mx-auto max-w-[1160px] px-6 py-14 md:px-10">
        {/* Masthead */}
        <header>
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: MUTE }}>
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: STEEL, boxShadow: `0 0 10px ${STEEL}` }} />
            Enterprise AI · live instrument
          </div>
          <h1 className="mt-5 font-display tracking-[-0.02em]" style={{ fontSize: "clamp(2.7rem,6.4vw,5rem)", lineHeight: 0.92 }}>
            Read the market like a
            <br />
            <span style={{ color: STEEL }}>calibrated instrument.</span>
          </h1>
          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed" style={{ color: "#b7bfca" }}>
            Every score traces to a public source — a weighted composite of evidence-graded pillars,
            coverage-discounted. Thin evidence reads <span className="font-mono" style={{ color: MUTE }}>INSUFFICIENT</span>,
            never a guess.
          </p>
          <div className="mt-6 h-px w-full" style={{ background: LINE }} />
        </header>

        {/* The instrument grid */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {composites.map((c) => (
            <section key={c.category.id} className="rounded-xl p-4" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-semibold leading-tight tracking-tight">{c.category.name}</h2>
                <Link href={`/category/${c.category.id}`} className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider hover:underline" style={{ color: STEEL }}>
                  open →
                </Link>
              </div>
              <ul className="space-y-2.5">
                {c.ranked.slice(0, 3).map((v) => {
                  const pct = v.assessmentComposite == null ? 0 : (v.assessmentComposite / 5) * 100;
                  return (
                    <li key={v.vendorId}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="font-mono text-[11px] tabular-nums" style={{ color: MUTE }}>{String(v.rank).padStart(2, "0")}</span>
                          <span className="truncate text-[14px]">{v.vendorName}</span>
                          {v.rank === 1 && (
                            <span className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: STEEL }}>lead</span>
                          )}
                        </span>
                        <span className="font-display text-[1.25rem] leading-none tabular-nums">
                          {v.assessmentComposite == null ? "—" : v.assessmentComposite.toFixed(2)}
                        </span>
                      </div>
                      {/* gauge meter */}
                      <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "#20242c" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ramp(v.assessmentComposite) }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {composites.length === 0 && (
          <p className="mt-16 font-mono text-[13px]" style={{ color: MUTE }}>
            LIVE RANKINGS UNAVAILABLE — shown only when backed by verified evidence.
          </p>
        )}

        <footer className="mt-14 flex items-center justify-between border-t pt-5 font-mono text-[11px] uppercase tracking-widest" style={{ borderColor: LINE, color: MUTE }}>
          <span>Design preview B · Instrument</span>
          <span style={{ color: STEEL }}>AI Enterprise</span>
        </footer>
      </div>
    </div>
  );
}
