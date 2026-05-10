import type { EvidenceGrade } from "@/lib/types";

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-l border-[#d6dccf] pl-4 dark:border-zinc-800">
      <div className="text-2xl font-semibold tabular-nums text-[#121812] dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#697362] dark:text-zinc-500">{label}</div>
      {note && <div className="mt-1 text-xs text-[#6a725f] dark:text-zinc-500">{note}</div>}
    </div>
  );
}

export function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dfe4da] bg-white dark:border-zinc-800 dark:bg-[#071827]">
      <div className="flex items-center justify-between border-b border-[#e7ebe2] px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{title}</h2>
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

export function Confidence({ value }: { value: number }) {
  const tone = value >= 75 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : value >= 60 ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>Confidence {value}/100</span>;
}

export function EvidenceBadge({ grade }: { grade: EvidenceGrade }) {
  const label = grade === "E5" || grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred";
  return <span className="rounded border border-[#d8ded0] px-1.5 py-0.5 text-xs text-[#495344] dark:border-zinc-700 dark:text-zinc-400">{grade} {label}</span>;
}

export function ScoreBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        {label && <span className="text-[#4d574b] dark:text-zinc-400">{label}</span>}
        <span className="font-mono text-[#18201b] dark:text-zinc-100">{value.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e8ede2] dark:bg-zinc-800">
        <div className="h-full rounded-full bg-[#2f5d50] dark:bg-emerald-400" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export function EstimatedNote() {
  return (
    <p className="text-xs leading-5 text-[#6a725f] dark:text-zinc-400">
      Estimated or inferred values are confidence-labelled seed data. Market share and momentum are directional signals, not proof of vendor quality.
    </p>
  );
}
