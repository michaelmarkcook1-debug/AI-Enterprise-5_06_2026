import type { EvidenceGrade } from "@/lib/types";
import { evidenceGradeClasses } from "@/lib/ui/semantic-colors";

// Terminal-style stat: thin gold rule on top, large mono numeral, smallcaps label.
export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-t-2 border-[#d4af37] pt-2.5">
      <div className="font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums text-[#0f2240] dark:text-[#f6f1e3]">{value}</div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#3f5068] dark:text-[#9fb3c8]">{label}</div>
      {note && <div className="mt-0.5 text-[11px] text-[#5e7088] dark:text-[#7d93aa]">{note}</div>}
    </div>
  );
}

// Flat editorial card — hairline border, smallcaps header, no decoration.
// Gold is reserved for the masthead, key numerals and active states.
export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#e3d9c0] bg-[#fffdf7] dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="flex items-center justify-between gap-3 border-b border-[#ece4d0] px-5 py-3 dark:border-[#16314e]">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3f5068] dark:text-[#9fb3c8]">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Data-provenance badge.
 *
 * SEED rendering is intentionally LOUD (bold red, dot indicator, "NOT LIVE"
 * prefix) so any panel reading from seed data is visually unmissable. The
 * label is preserved as the human-readable source ("Seed news", "Estimated
 * market signals", etc.) and the optional `reason` populates the tooltip.
 *
 * LIVE rendering is calm green — the absence of red anywhere on screen is
 * the at-a-glance signal that the page is fully source-backed.
 */
export function SeedDataBadge({
  label,
  provenance = "seed",
  reason,
}: {
  label?: string;
  provenance?: "seed" | "live";
  reason?: string;
}) {
  const isLive = provenance === "live";
  const text = label ?? (isLive ? "Live source" : "Seed estimate");
  const tone = isLive
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    : "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200";
  const tooltip = reason ?? (isLive
    ? "Source-backed live data."
    : `NOT LIVE — ${text}. Source: typed seed module. Run /admin/ingestion + approve in /admin/evidence to flip this surface to live.`);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone}`}
      title={tooltip}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`}
      />
      {!isLive && <span className="font-extrabold">NOT LIVE:</span>}
      <span>{text}</span>
    </span>
  );
}

/**
 * Honest evidence-depth marker. Driven by the count of analyst_verified
 * EvidenceRecord rows behind a vendor's scores (see entities.ts evidenceDepthBand):
 *   ≥10 verified → renders nothing (score is source-backed),
 *   1–9 limited  → amber "Limited evidence (n verified)",
 *   0  seed      → rose "Seed estimate — no verified evidence".
 * Use it next to any authoritative score so an un-evidenced number is never
 * presented as fact. Pair with lowEvidenceClass() to de-emphasise the row.
 */
export function EvidenceDepthBadge({ depth }: { depth: number }) {
  if (depth >= 10) return null;
  const seed = depth <= 0;
  const tone = seed
    ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
    : "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
  const text = seed ? "Seed estimate — no verified evidence" : `Limited evidence (${depth} verified)`;
  const tooltip = seed
    ? "This vendor's scores are seed estimates with NO analyst-verified evidence behind them. Treat as directional only."
    : `Only ${depth} analyst-verified evidence row${depth === 1 ? "" : "s"} back these scores — treat as preliminary.`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
      title={tooltip}
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${seed ? "bg-rose-500" : "bg-amber-500"}`} />
      {text}
    </span>
  );
}

/** Tailwind opacity class to de-emphasise a low-evidence row (never hide it). */
export function lowEvidenceClass(depth: number): string {
  if (depth >= 10) return "";
  return depth <= 0 ? "opacity-60" : "opacity-80";
}

// Confidence badge removed per product decision — scores were noisy and
// drew attention from the headline rank. The component is kept as a
// no-op so every existing `<Confidence value={...} />` call site
// continues to compile, but renders nothing. To bring the badge back,
// restore the previous implementation in this file's git history.
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Confidence(_: { value: number }) {
  return null;
}

export function EvidenceBadge({ grade }: { grade: EvidenceGrade }) {
  const label = grade === "E5" || grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred";
  // Colour-coded by grade so verified (E5/E4 emerald) is visually distinct from
  // inferred (E0 slate) — previously every grade rendered the same muted colour.
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${evidenceGradeClasses(grade)}`}>{grade} {label}</span>;
}

export function ScoreBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        {label && <span className="text-[#475a72] dark:text-[#a7bacd]">{label}</span>}
        <span className="font-mono text-[#13294b] dark:text-[#eef3f8]">{value.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden bg-[#ece3cb] dark:bg-[#122c49]">
        <div className="h-full bg-[#b08d2f] dark:bg-[#d4af37]" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function EstimatedNote() {
  return (
    <p className="text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
      Estimated or inferred values are confidence-labelled seed data. Market share and momentum are directional signals, not proof of vendor quality.
    </p>
  );
}
