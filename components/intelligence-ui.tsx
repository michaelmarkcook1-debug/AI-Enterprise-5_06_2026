import type { EvidenceGrade } from "@/lib/types";

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-l-2 border-[#d4af37] pl-4 dark:border-[#b08d2f]">
      <div className="text-2xl font-semibold tabular-nums text-[#0f2240] dark:text-[#f6f0e7]">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#5b6b7f] dark:text-[#8aa4b8]">{label}</div>
      {note && <div className="mt-1 text-xs text-[#5e6b7e] dark:text-[#8aa4b8]/80">{note}</div>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e6dcc3] bg-[#fffdf7] shadow-[0_1px_3px_rgba(19,41,75,0.06)] dark:border-[#1a3953] dark:bg-[#0a1f38]">
      <div className="flex items-center justify-between border-b border-[#ece4d0] px-4 py-3 dark:border-[#1a3953]">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#13294b] dark:text-[#f6f0e7]">
          <span aria-hidden className="h-3.5 w-1 rounded-full bg-[#d4af37]" />
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
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
  return <span className="rounded border border-[#e0d6ba] px-1.5 py-0.5 text-xs text-[#4a5a70] dark:border-zinc-700 dark:text-zinc-400">{grade} {label}</span>;
}

export function ScoreBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        {label && <span className="text-[#475a72] dark:text-zinc-400">{label}</span>}
        <span className="font-mono text-[#13294b] dark:text-zinc-100">{value.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#ece3cb] dark:bg-[#122c49]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#b08d2f] to-[#d4af37] dark:from-[#d4af37] dark:to-[#e8c95c]" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function EstimatedNote() {
  return (
    <p className="text-xs leading-5 text-[#5e6b7e] dark:text-zinc-400">
      Estimated or inferred values are confidence-labelled seed data. Market share and momentum are directional signals, not proof of vendor quality.
    </p>
  );
}
