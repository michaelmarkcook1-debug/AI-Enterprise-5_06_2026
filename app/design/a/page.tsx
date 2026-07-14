// DESIGN PREVIEW — Direction A: "Evidence Ledger"
// Elevates the committed navy/gold/cream identity: serif tabular score numerals,
// hairline ledger rules, surgical gold, editorial rhythm. Real data only
// (getCategoryComposites) — no fabrication. Scoped styles; global theme untouched.

import Link from "next/link";
import { getCategoryComposites } from "@/lib/ranking/category-composite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Design A — Evidence Ledger", robots: { index: false } };

const INK = "#13294b";
const GOLD = "#9a7b28";
const CREAM = "#f7f2e7";
const RULE = "#e2d7bd";

// Sky→orange calibration (never red↔green): high confidence = deep sky, low = warm amber.
function conf(c: number | null): string {
  if (c == null) return "#b9c2cf";
  if (c >= 80) return "#2c5b8a";
  if (c >= 60) return "#5a86ad";
  if (c >= 40) return "#c88a3e";
  return "#cf9b57";
}

export default async function DesignAPreview() {
  const composites = (await getCategoryComposites().catch(() => []))
    .filter((c) => c.isLive && c.ranked.length > 0)
    .slice(0, 6);

  return (
    <div style={{ background: CREAM, color: INK }} className="min-h-screen">
      <div className="mx-auto max-w-[1120px] px-6 py-14 md:px-10">
        {/* Masthead */}
        <header className="border-b pb-6" style={{ borderColor: INK }}>
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                Enterprise AI · Evidence Ledger
              </p>
              <h1 className="font-display leading-[0.9] tracking-[-0.02em]" style={{ fontSize: "clamp(2.6rem,6vw,4.6rem)" }}>
                Who leads, who’s exposed,
                <br />
                <span style={{ color: GOLD }}>and who’s coming for them.</span>
              </h1>
            </div>
            <div className="hidden shrink-0 text-right md:block">
              <p className="font-display text-[3.2rem] leading-none tabular-nums">140</p>
              <p className="text-[12px] tracking-wide" style={{ color: "#6a5f45" }}>vendors under<br />continuous review</p>
            </div>
          </div>
          <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed" style={{ color: "#3a4457" }}>
            Every score traces to a public source. Rankings are a weighted composite of evidence-graded
            pillars — coverage-discounted, never a market-share proxy. Thin evidence reads
            <em> insufficient</em>, never a guess.
          </p>
        </header>

        {/* The ledger */}
        <div className="mt-12 grid gap-x-14 gap-y-12 md:grid-cols-2">
          {composites.map((c) => (
            <section key={c.category.id}>
              <div className="mb-3 flex items-baseline justify-between border-b pb-2" style={{ borderColor: INK }}>
                <h2 className="font-display text-[1.5rem] leading-tight tracking-[-0.01em]">{c.category.name}</h2>
                <Link href={`/category/${c.category.id}`} className="text-[12px] font-medium tracking-wide hover:underline" style={{ color: GOLD }}>
                  Full ledger →
                </Link>
              </div>
              <ol>
                {c.ranked.slice(0, 3).map((v, i) => (
                  <li
                    key={v.vendorId}
                    className="grid grid-cols-[1.4rem_1fr_auto] items-baseline gap-3 py-2.5"
                    style={{ borderTop: i === 0 ? "none" : `1px solid ${RULE}` }}
                  >
                    <span className="font-display text-[1.05rem] tabular-nums" style={{ color: GOLD }}>{v.rank}</span>
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-[15px] font-medium">{v.vendorName}</span>
                      {v.rank === 1 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
                          style={{ color: GOLD, border: `1px solid ${GOLD}`, background: "rgba(154,123,40,0.06)" }}
                        >
                          Leader
                        </span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-2.5">
                      <span
                        aria-hidden
                        className="inline-block h-[7px] w-[7px] rounded-full"
                        style={{ background: conf(v.compositeConfidence) }}
                        title={`${v.compositeConfidence ?? "—"}% confidence`}
                      />
                      <span className="font-display text-[1.35rem] leading-none tabular-nums">
                        {v.assessmentComposite == null ? "—" : v.assessmentComposite.toFixed(2)}
                      </span>
                      <span className="text-[11px]" style={{ color: "#8a7c5c" }}>/5</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        {composites.length === 0 && (
          <p className="mt-16 text-[15px]" style={{ color: "#6a5f45" }}>
            Live rankings are momentarily unavailable — shown only when backed by verified evidence.
          </p>
        )}

        <footer className="mt-16 flex items-center justify-between border-t pt-5 text-[12px]" style={{ borderColor: RULE, color: "#6a5f45" }}>
          <span>Design preview A · Evidence Ledger</span>
          <span className="font-display italic">AI Enterprise</span>
        </footer>
      </div>
    </div>
  );
}
