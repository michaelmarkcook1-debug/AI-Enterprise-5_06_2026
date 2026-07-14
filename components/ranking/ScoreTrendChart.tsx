"use client";

// Hover trend chart for a ranking score.
// ─────────────────────────────────────────────────────────────────────────────
// Wrap a vendor's score with this; on hover/focus it lazily fetches the REAL
// tracked history (/api/vendors/[id]/score-history) and shows how the vendor's
// overall composite AND each pillar have moved since we started tracking.
//
// HONEST BY CONSTRUCTION: it draws only points the API returns (real snapshots +
// span-guarded reconstructions). With 0–1 points it shows a "tracking since …"
// baseline instead of a fabricated line. Reconstructed points are drawn hollow
// and footnoted. No score colour uses red↔green (clarity standard) — the accent
// is the brand gold; pillars are neutral ink at low opacity.

import { useCallback, useId, useRef, useState } from "react";

interface Point {
  date: string;
  composite: number | null;
  rank: number | null;
  pillars: { pillar: string; score: number | null }[];
  source: "snapshot" | "reconstructed";
}

const PILLAR_LABEL: Record<string, string> = {
  market_strength: "Market",
  reliability_safety: "Reliability",
  enterprise_control: "Control",
  integration_ops: "Integration",
  business_fit: "Business fit",
  vendor_resilience: "Resilience",
};

const fmtDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1]}`;
};

export function ScoreTrendChart({
  vendorId,
  categoryId,
  vendorName,
  children,
}: {
  vendorId: string;
  categoryId: string;
  vendorName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const load = useCallback(async () => {
    if (points !== null || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/vendors/${encodeURIComponent(vendorId)}/score-history?category=${encodeURIComponent(categoryId)}`,
      );
      const data = res.ok ? await res.json() : { points: [] };
      setPoints(Array.isArray(data.points) ? data.points : []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId, categoryId, points, loading]);

  const show = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    // Fixed positioning escapes any overflow:hidden ancestor (ranking rows clip).
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 336), top: r.bottom + 8 });
    setOpen(true);
    void load();
  }, [load]);

  const hide = useCallback(() => setOpen(false), []);

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? labelId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          open ? hide() : show();
        }}
        className="cursor-help border-b border-dotted border-current/40 bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit]"
      >
        {children}
      </button>
      {open && pos && (
        <div
          id={labelId}
          role="tooltip"
          style={{ position: "fixed", left: pos.left, top: pos.top, width: 320, zIndex: 60 }}
          className="rounded-xl border border-[#15263c]/12 bg-white p-3.5 text-[#15263c] shadow-xl dark:border-white/12 dark:bg-[#0f1b2d] dark:text-[#eef3f8]"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={hide}
        >
          <TrendBody points={points} loading={loading} vendorName={vendorName} />
        </div>
      )}
    </span>
  );
}

function TrendBody({ points, loading, vendorName }: { points: Point[] | null; loading: boolean; vendorName: string }) {
  if (loading || points === null) {
    return <p className="text-[13px] text-current/60">Loading trend…</p>;
  }

  const scored = points.filter((p) => p.composite != null) as (Point & { composite: number })[];

  // 0–1 real points → honest baseline, never a drawn line.
  if (scored.length < 2) {
    const since = scored[0]?.date;
    return (
      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold">{vendorName} — score trend</p>
        <p className="text-[13px] leading-snug text-current/70">
          {since
            ? `Tracking since ${fmtDate(since)}. The trend line builds as we snapshot the score daily — check back to see how it moves.`
            : "No tracked history yet. We record a snapshot each day; the trend appears once there are at least two points."}
        </p>
        {scored[0] && (
          <p className="text-[13px] text-current/60">
            Baseline: <span className="font-mono tabular-nums">{scored[0].composite.toFixed(2)}</span>/5
            {scored[0].rank != null && <> · rank #{scored[0].rank}</>}
          </p>
        )}
      </div>
    );
  }

  const first = scored[0];
  const last = scored[scored.length - 1];
  const delta = last.composite - first.composite;
  const rankDelta = first.rank != null && last.rank != null ? first.rank - last.rank : null; // +ve = climbed

  // ── Chart geometry (0–5 Y axis, evenly spaced X) ──
  const W = 292, H = 92, PAD = 6;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (scored.length - 1);
  const y = (v: number) => H - PAD - (v / 5) * (H - 2 * PAD);
  const linePath = (get: (p: Point) => number | null) => {
    const pts = scored.map((p, i) => [x(i), get(p)] as const).filter(([, v]) => v != null) as [number, number][];
    return pts.length < 2 ? "" : "M" + pts.map(([px, v]) => `${px.toFixed(1)},${y(v as number).toFixed(1)}`).join(" L");
  };

  const pillarKeys = Object.keys(PILLAR_LABEL).filter((k) =>
    scored.some((p) => p.pillars.find((pp) => pp.pillar === k)?.score != null),
  );
  const pillarGet = (key: string) => (p: Point) => p.pillars.find((pp) => pp.pillar === key)?.score ?? null;
  const anyReconstructed = scored.some((p) => p.source === "reconstructed");

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold">{vendorName} — score trend</p>
        <span className="text-[12px] text-current/55">{fmtDate(first.date)} → {fmtDate(last.date)}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${vendorName} composite trend`}>
        {[0, 2.5, 5].map((g) => (
          <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.1} strokeWidth={0.5} />
        ))}
        {/* pillars — faint neutral */}
        {pillarKeys.map((k) => (
          <path key={k} d={linePath(pillarGet(k))} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={1} />
        ))}
        {/* overall composite — brand gold, bold */}
        <path d={linePath((p) => p.composite)} fill="none" stroke="#c99a2e" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {scored.map((p, i) =>
          p.composite == null ? null : (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.composite)}
              r={2.6}
              fill={p.source === "reconstructed" ? "transparent" : "#c99a2e"}
              stroke="#c99a2e"
              strokeWidth={1.2}
            />
          ),
        )}
      </svg>

      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span>
          Composite{" "}
          <span className="font-mono tabular-nums font-semibold">{last.composite.toFixed(2)}</span>/5
        </span>
        <span className="tabular-nums text-current/70">
          {delta === 0 ? "no change" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)} since start`}
          {rankDelta != null && rankDelta !== 0 && <> · rank {rankDelta > 0 ? "▲" : "▼"}{Math.abs(rankDelta)}</>}
        </span>
      </div>

      <p className="text-[12px] leading-snug text-current/50">
        Gold = overall composite; faint lines = the six pillars.
        {anyReconstructed && " Hollow points are reconstructed from evidence captured by that date, not a re-measurement."}
      </p>
    </div>
  );
}
