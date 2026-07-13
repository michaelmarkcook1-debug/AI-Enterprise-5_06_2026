// Evidence-Instrument kit — visual preview (Phase 1, Item 1).
// ──────────────────────────────────────────────────────────────────────
// A developer showcase of the shared decision-surface primitives, rendered
// with a mix of REAL Artificial Analysis frontier numbers (the face-off) and
// clearly-labelled illustrative data (the scorecard). Lives under the
// admin-gated (internal) tree; not part of the public product. Delete once the
// primitives are wired into the real scorecard / face-off / peer surfaces.

import type { Metadata } from "next";
import { BulletGraph, DivergingBar, ConfidenceVeil, ClickToSource, EvidenceGrade } from "@/components/instrument";

export const metadata: Metadata = { title: "Evidence-Instrument kit — preview" };

// Illustrative vendor scorecard (sample data — clearly labelled below).
const PILLARS: {
  label: string;
  score: number | null;
  grade: string;
  bench: number;
  low?: boolean;
  src?: { title: string; publisher: string; date: string; grade: string; href: string };
}[] = [
  { label: "Enterprise control", score: 81, grade: "E4", bench: 70, src: { title: "SOC 2 Type II report (independent audit)", publisher: "Trust center", date: "as of 2026-06", grade: "E4", href: "https://example.com" } },
  { label: "Reliability & safety", score: 76, grade: "E4", bench: 68 },
  { label: "Business fit", score: 69, grade: "E3", bench: 66 },
  { label: "Integration & ops", score: 64, grade: "E3", bench: 63 },
  { label: "Vendor resilience", score: 52, grade: "E1", bench: 60, low: true },
  { label: "Market strength", score: null, grade: "—", bench: 0 },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b08d2f] dark:text-[#c9a84a]">{children}</div>;
}

export default function InstrumentKitPreview() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Kicker>Evidence Instrument · component kit</Kicker>
      <h1 className="font-display mt-2 text-3xl text-[#13294b] dark:text-[#f6f0e7]">The primitives, rendered</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#3f5068] dark:text-[#a7bacd]">
        Phase-1 building blocks for the scorecard, model face-off and peer surfaces. The face-off uses real
        Artificial Analysis frontier numbers; the scorecard is illustrative sample data.
      </p>

      {/* ── 1 · Vendor scorecard — bullet-graph stack ── */}
      <section className="mt-10 rounded-lg border border-[#e6dcc3] bg-white/60 p-5 dark:border-[#1a3953] dark:bg-[#0c2238]/50">
        <div className="flex items-baseline justify-between">
          <Kicker>Vendor scorecard · illustrative</Kicker>
          <div className="text-right">
            <span className="font-mono text-2xl font-semibold tabular-nums text-[#13294b] dark:text-[#eef3f8]">72.4</span>
            <span className="ml-1.5 text-[11px] text-[#7e8a99] dark:text-[#8fa5bb]">composite · 5 of 6 covered</span>
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {PILLARS.map((p) => (
            <div key={p.label} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-[#3f5068] dark:text-[#c7d4e2]">{p.label}</span>
                {p.grade !== "—" && <EvidenceGrade grade={p.grade} />}
              </div>
              <BulletGraph value={p.score} benchmark={p.bench || null} lowConfidence={p.low} label={p.label} />
              <div className="text-right font-mono text-sm tabular-nums text-[#13294b] dark:text-[#eef3f8]">
                {p.score == null ? (
                  <span className="text-[#7e8a99] dark:text-[#8fa5bb]">—</span>
                ) : p.src ? (
                  <ClickToSource href={p.src.href} source={p.src} label={`${p.label} source`}>
                    <ConfidenceVeil confidence={p.low ? 30 : 85} label={`${p.label} score`}>{p.low ? "~" : ""}{p.score}</ConfidenceVeil>
                  </ClickToSource>
                ) : (
                  <ConfidenceVeil confidence={p.low ? 30 : 85} label={`${p.label} score`}>{p.low ? "~" : ""}{p.score}</ConfidenceVeil>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#7e8a99] dark:text-[#8fa5bb]">
          Tick = cohort benchmark · faded/hatched = low-confidence evidence · bottom row = honest "insufficient
          evidence" (no bar, drags coverage) · hover a score with a ↗ to see its cited source.
        </p>
      </section>

      {/* ── 2 · Model face-off — diverging bars (real AA data) ── */}
      <section className="mt-8 rounded-lg border border-[#e6dcc3] bg-white/60 p-5 dark:border-[#1a3953] dark:bg-[#0c2238]/50">
        <Kicker>Model face-off · Artificial Analysis (real)</Kicker>
        <div className="mt-1 flex justify-between text-[13px] font-medium text-[#13294b] dark:text-[#eef3f8]">
          <span>OpenAI · GPT-5.6 Sol</span><span>Anthropic · Claude Fable 5</span>
        </div>
        <div className="mt-3 space-y-3">
          {([
            ["Intelligence Index", 58.9, 59.9, true],
            ["Coding Index", 77.4, 76.5, true],
            ["Agentic Index", 54.0, 52.8, true],
            ["Price / 1M out · illustrative $ ↓", 40, 25, false],
          ] as const).map(([m, a, b, hib]) => (
            <div key={m}>
              <div className="mb-0.5 text-[10px] font-mono uppercase tracking-wide text-[#7e8a99] dark:text-[#8fa5bb]">
                {m} <span className="text-[#b08d2f] dark:text-[#c9a84a]">· {hib ? "higher is better" : "lower is better"}</span>
              </div>
              <DivergingBar a={a} b={b} higherIsBetter={hib} aName="GPT-5.6 Sol" bName="Claude Fable 5" />
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 · Confidence veil + click-to-source, isolated ── */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[#e6dcc3] bg-white/60 p-5 dark:border-[#1a3953] dark:bg-[#0c2238]/50">
          <Kicker>Confidence veil · same number, three weights</Kicker>
          <div className="mt-3 flex items-center gap-5 font-mono text-2xl tabular-nums text-[#13294b] dark:text-[#eef3f8]">
            <ConfidenceVeil confidence={90} label="high">88</ConfidenceVeil>
            <ConfidenceVeil confidence={55} label="moderate">88</ConfidenceVeil>
            <ConfidenceVeil confidence={20} label="low">88</ConfidenceVeil>
          </div>
          <p className="mt-2 text-[11px] text-[#7e8a99] dark:text-[#8fa5bb]">high · moderate · low — a thin-evidence number never looks as solid as a measured one.</p>
        </div>
        <div className="rounded-lg border border-[#e6dcc3] bg-white/60 p-5 dark:border-[#1a3953] dark:bg-[#0c2238]/50">
          <Kicker>Click-to-source · hover the ↗</Kicker>
          <div className="mt-3 font-mono text-2xl tabular-nums text-[#13294b] dark:text-[#eef3f8]">
            <ClickToSource
              href="https://artificialanalysis.ai/models"
              source={{ title: "Artificial Analysis Intelligence Index", publisher: "Artificial Analysis", date: "released 2026-07-09", grade: "E4" }}
              label="Intelligence Index source"
            >
              58.9
            </ClickToSource>
          </div>
          <p className="mt-2 text-[11px] text-[#7e8a99] dark:text-[#8fa5bb]">every figure can prove its origin; no source → no affordance (honest absence).</p>
        </div>
      </section>
    </div>
  );
}
