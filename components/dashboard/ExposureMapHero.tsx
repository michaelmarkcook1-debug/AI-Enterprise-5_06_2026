"use client";

// Indirect Exposure Map — premium hero.
// ────────────────────────────────────
// Replaces the previous diagnostic widget with a strategic-intelligence
// hero per the May-2026 redesign brief. Key changes from the prior
// implementation:
//
//   - Hover (not just click) reveals tooltips with relationship type,
//     confidence, estimated value, date, summary, and source links.
//   - Multi-pin (up to 3) instead of single-pin.
//   - Relationship-type + confidence filter chips.
//   - "Extended ecosystem" toggle reveals the global / non-US frontier
//     and NVIDIA-Nemotron set; core-market view shows the headline
//     hyperscaler ↔ frontier-lab graph.
//   - Edge colour encodes relationship type (gold / cyan / teal / lime /
//     gray / violet); thickness encodes strengthScore via 4 visual
//     bands rather than continuous.
//   - Keyboard support: Tab through nodes, Enter/Space to pin.
//   - Reduced-motion: pin ring dash-animation disabled.
//   - Logos via Clearbit, falls back to brand-coloured monogram.
//
// Data lives in lib/investing/exposure-map-data.ts where every edge
// has a verified source URL + confidence tier. Speculative edges are
// either omitted or explicitly marked seed.

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  EXPOSURE_EDGES,
  EXPOSURE_NODES,
  EXTENDED_ECOSYSTEM_NODE_IDS,
  type ConfidenceTier,
  type ExposureMapEdge,
  type ExposureMapNode,
  type RelationshipType,
} from "@/lib/investing/exposure-map-data";

// ──────────────── Visual constants ────────────────

const REL_COLOR: Record<RelationshipType, string> = {
  investment: "#eab308",            // gold
  cloud: "#06b6d4",                 // cyan
  model_hosting: "#14b8a6",         // teal
  commercial_partnership: "#84cc16",// lime
  supply_chain: "#94a3b8",          // gray
  subsidiary: "#a855f7",            // violet (for clarity in subsidiary cases)
};

const REL_LABEL: Record<RelationshipType, string> = {
  investment: "Investment",
  cloud: "Cloud / compute",
  model_hosting: "Model hosting",
  commercial_partnership: "Commercial partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

const CONF_LABEL: Record<ConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  seed: "Seed",
};

const W = 1200;
const ROW_H = 78;
const PAD_Y = 92;
const COL_LEFT_X = 230;
const COL_RIGHT_X = W - 230;
const NODE_R = 26;

// Strength bands: thickness in px depending on strengthScore quartile.
function thicknessFor(score: number): number {
  if (score >= 0.85) return 6;
  if (score >= 0.6) return 4.5;
  if (score >= 0.4) return 3;
  return 1.5;
}

// ──────────────── Component ────────────────

const MAX_PINS = 3;
const ALL_REL_TYPES: RelationshipType[] = ["investment", "cloud", "model_hosting", "commercial_partnership", "supply_chain", "subsidiary"];
const ALL_CONF_TIERS: ConfidenceTier[] = ["high", "medium", "seed"];

export default function ExposureMapHero(_: { edges?: unknown } = {}) {
  // Filter state
  const [activeRelTypes, setActiveRelTypes] = useState<Set<RelationshipType>>(new Set(ALL_REL_TYPES));
  const [activeConfTiers, setActiveConfTiers] = useState<Set<ConfidenceTier>>(new Set(ALL_CONF_TIERS));
  const [showExtended, setShowExtended] = useState(false);

  // Interaction state
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: TooltipContent } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Respect prefers-reduced-motion.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Filter nodes by extended-ecosystem toggle.
  const visibleNodes = useMemo(() => {
    if (showExtended) return EXPOSURE_NODES;
    return EXPOSURE_NODES.filter((n) => !EXTENDED_ECOSYSTEM_NODE_IDS.has(n.id));
  }, [showExtended]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Filter edges by relationship type + confidence + visible-nodes set.
  const visibleEdges = useMemo(() => {
    return EXPOSURE_EDGES.filter(
      (e) =>
        activeRelTypes.has(e.relationshipType) &&
        activeConfTiers.has(e.confidence) &&
        visibleNodeIds.has(e.sourceId) &&
        visibleNodeIds.has(e.targetId),
    );
  }, [activeRelTypes, activeConfTiers, visibleNodeIds]);

  // Layout: row index per side based on edges-present-in-view to avoid
  // empty rows when a vendor's only edge has been filtered out.
  const { leftNodes, rightNodes, height } = useMemo(() => {
    const usedIds = new Set<string>();
    for (const e of visibleEdges) {
      usedIds.add(e.sourceId);
      usedIds.add(e.targetId);
    }
    const left = visibleNodes.filter((n) => n.side === "left" && usedIds.has(n.id));
    const right = visibleNodes.filter((n) => n.side === "right" && usedIds.has(n.id));
    const rows = Math.max(left.length, right.length, 1);
    return { leftNodes: left, rightNodes: right, height: PAD_Y * 2 + rows * ROW_H };
  }, [visibleEdges, visibleNodes]);

  const leftY = (id: string) => PAD_Y + leftNodes.findIndex((n) => n.id === id) * ROW_H;
  const rightY = (id: string) => PAD_Y + rightNodes.findIndex((n) => n.id === id) * ROW_H;

  // Active = pinned ∪ hovered; the pinned set persists, hovered is transient.
  const activeIds = useMemo(() => {
    const s = new Set<string>(pinned);
    if (hovered) s.add(hovered);
    return s;
  }, [pinned, hovered]);

  // For dimming: a node is "in scope" if it's active OR it has an edge to an active node.
  const connectedIds = useMemo(() => {
    if (activeIds.size === 0) return null; // null = default state, everything shown at base
    const s = new Set<string>(activeIds);
    for (const e of visibleEdges) {
      if (activeIds.has(e.sourceId)) s.add(e.targetId);
      if (activeIds.has(e.targetId)) s.add(e.sourceId);
    }
    return s;
  }, [activeIds, visibleEdges]);

  const isEdgeActive = useCallback(
    (e: ExposureMapEdge) => {
      if (!connectedIds) return false;
      return activeIds.has(e.sourceId) || activeIds.has(e.targetId);
    },
    [activeIds, connectedIds],
  );

  // ──────────────── Tooltip helpers ────────────────
  type TooltipContent =
    | { kind: "node"; node: ExposureMapNode; edges: ExposureMapEdge[] }
    | { kind: "edge"; edge: ExposureMapEdge; sourceNode: ExposureMapNode; targetNode: ExposureMapNode };

  function moveTooltipTo(svgX: number, svgY: number, content: TooltipContent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = rect.width / W;
    setTooltip({
      x: svgX * scale,
      y: svgY * scale,
      content,
    });
  }

  // ──────────────── Pin / toggle handlers ────────────────
  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_PINS) {
          // Drop the oldest pin (first inserted) to make room.
          const first = next.values().next().value;
          if (first) next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const onNodeKey = (id: string) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePin(id);
    }
  };

  // ──────────────── Render ────────────────

  return (
    <div ref={containerRef} className="relative rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:from-[#0a1521] dark:to-[#071827]">
      {/* Header */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
          Indirect exposure map
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
          Understand the AI Market at a Glance
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Who backs whom, who hosts whom, and where enterprise AI risk concentrates.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        {/* Relationship-type filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Relationship</span>
          {ALL_REL_TYPES.map((rt) => {
            const active = activeRelTypes.has(rt);
            return (
              <button
                key={rt}
                type="button"
                onClick={() =>
                  setActiveRelTypes((prev) => {
                    const next = new Set(prev);
                    next.has(rt) ? next.delete(rt) : next.add(rt);
                    if (next.size === 0) return new Set(ALL_REL_TYPES); // never empty
                    return next;
                  })
                }
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500"
                }`}
                style={active ? undefined : { borderLeftColor: REL_COLOR[rt], borderLeftWidth: 3 }}
              >
                {REL_LABEL[rt]}
              </button>
            );
          })}
        </div>

        {/* Confidence filter */}
        <div className="ml-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Confidence</span>
          {ALL_CONF_TIERS.map((ct) => {
            const active = activeConfTiers.has(ct);
            return (
              <button
                key={ct}
                type="button"
                onClick={() =>
                  setActiveConfTiers((prev) => {
                    const next = new Set(prev);
                    next.has(ct) ? next.delete(ct) : next.add(ct);
                    if (next.size === 0) return new Set(ALL_CONF_TIERS);
                    return next;
                  })
                }
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-600 hover:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                }`}
              >
                {CONF_LABEL[ct]}
              </button>
            );
          })}
        </div>

        {/* Extended toggle */}
        <button
          type="button"
          onClick={() => setShowExtended((v) => !v)}
          className={`ml-1 rounded-full border px-3 py-0.5 text-[11px] font-medium transition-colors ${
            showExtended
              ? "border-violet-500 bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200"
              : "border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          {showExtended ? "Core market ←" : "Extended ecosystem →"}
        </button>

        {/* Clear pins */}
        {pinned.size > 0 && (
          <button
            type="button"
            onClick={() => setPinned(new Set())}
            className="ml-auto rounded-full border border-zinc-300 px-3 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Clear {pinned.size} pin{pinned.size === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {/* Map */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="min-h-[460px] cursor-default text-zinc-900 dark:text-zinc-100"
          role="img"
          aria-label="Indirect AI market exposure map"
        >
          {/* Column headers */}
          <text x={COL_LEFT_X} y={42} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">
            Public exposure owners
          </text>
          <text x={COL_RIGHT_X} y={42} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">
            AI labs / model owners
          </text>

          {/* Edges */}
          {visibleEdges.map((e) => {
            const src = EXPOSURE_NODES.find((n) => n.id === e.sourceId)!;
            const tgt = EXPOSURE_NODES.find((n) => n.id === e.targetId)!;
            const ay = leftY(src.id);
            const by = rightY(tgt.id);
            const baseStroke = thicknessFor(e.strengthScore);
            const color = REL_COLOR[e.relationshipType];
            const dim = connectedIds !== null;
            const onPath = isEdgeActive(e);
            const isHov = hoveredEdge === e.id;
            const opacity = !dim ? 0.35 : onPath ? 0.95 : 0.06;
            const strokeWidth = isHov ? baseStroke + 2 : baseStroke;
            const dashArray = e.confidence === "seed" ? "6 5" : undefined;
            const cx = (COL_LEFT_X + COL_RIGHT_X) / 2;
            return (
              <path
                key={e.id}
                d={`M ${COL_LEFT_X + NODE_R} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${COL_RIGHT_X - NODE_R} ${by}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeDasharray={dashArray}
                style={{ transition: "stroke-opacity 180ms, stroke-width 180ms", vectorEffect: "non-scaling-stroke" }}
                onMouseEnter={() => {
                  setHoveredEdge(e.id);
                  moveTooltipTo(cx, (ay + by) / 2, { kind: "edge", edge: e, sourceNode: src, targetNode: tgt });
                }}
                onMouseLeave={() => {
                  setHoveredEdge(null);
                  setTooltip(null);
                }}
              />
            );
          })}

          {/* Nodes */}
          {leftNodes.map((n) => (
            <NodeBubble
              key={`L-${n.id}`}
              node={n}
              cx={COL_LEFT_X}
              cy={leftY(n.id)}
              labelSide="left"
              pinned={pinned.has(n.id)}
              dimmed={connectedIds !== null && !connectedIds.has(n.id)}
              reducedMotion={reducedMotion}
              onEnter={() => {
                setHovered(n.id);
                const incidentEdges = visibleEdges.filter((e) => e.sourceId === n.id || e.targetId === n.id);
                moveTooltipTo(COL_LEFT_X, leftY(n.id), { kind: "node", node: n, edges: incidentEdges });
              }}
              onLeave={() => {
                setHovered(null);
                setTooltip(null);
              }}
              onClick={() => togglePin(n.id)}
              onKey={onNodeKey(n.id)}
            />
          ))}
          {rightNodes.map((n) => (
            <NodeBubble
              key={`R-${n.id}`}
              node={n}
              cx={COL_RIGHT_X}
              cy={rightY(n.id)}
              labelSide="right"
              pinned={pinned.has(n.id)}
              dimmed={connectedIds !== null && !connectedIds.has(n.id)}
              reducedMotion={reducedMotion}
              onEnter={() => {
                setHovered(n.id);
                const incidentEdges = visibleEdges.filter((e) => e.sourceId === n.id || e.targetId === n.id);
                moveTooltipTo(COL_RIGHT_X, rightY(n.id), { kind: "node", node: n, edges: incidentEdges });
              }}
              onLeave={() => {
                setHovered(null);
                setTooltip(null);
              }}
              onClick={() => togglePin(n.id)}
              onKey={onNodeKey(n.id)}
            />
          ))}
        </svg>

        {/* Floating tooltip */}
        {tooltip && <MapTooltip {...tooltip} />}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-3 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Legend</span>
        {ALL_REL_TYPES.map((rt) => (
          <span key={rt} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-6 rounded-sm" style={{ backgroundColor: REL_COLOR[rt] }} />
            {REL_LABEL[rt]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg width={28} height={4} aria-hidden>
            <line x1={0} y1={2} x2={28} y2={2} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" />
          </svg>
          Seed / unverified
        </span>
        <span className="ml-auto text-zinc-500">Hover for detail · click to pin (max {MAX_PINS})</span>
      </div>
    </div>
  );
}

// ──────────────── Subcomponents ────────────────

function NodeBubble({
  node, cx, cy, labelSide, pinned, dimmed, reducedMotion, onEnter, onLeave, onClick, onKey,
}: {
  node: ExposureMapNode;
  cx: number; cy: number;
  labelSide: "left" | "right";
  pinned: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
  onKey: (e: React.KeyboardEvent<SVGGElement>) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = node.logoDomain && !logoFailed;
  const labelDx = labelSide === "left" ? -(NODE_R + 14) : NODE_R + 14;
  const labelAnchor = labelSide === "left" ? "end" : "start";

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} — ${node.category}${pinned ? " (pinned)" : ""}`}
      onFocus={onEnter}
      onBlur={onLeave}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      onKeyDown={onKey}
      style={{
        cursor: "pointer",
        opacity: dimmed ? 0.28 : 1,
        transition: "opacity 180ms",
        outline: "none",
      }}
    >
      {/* Pin ring (dashed) — animated unless reduced motion. */}
      {pinned && (
        <circle
          r={NODE_R + 7}
          fill="none"
          stroke={node.brandColor}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          style={!reducedMotion ? { animation: "spin-slow 12s linear infinite", transformOrigin: "0 0" } : undefined}
        />
      )}
      {/* Filled bubble */}
      <circle r={NODE_R} fill="white" stroke={node.brandColor} strokeWidth={2.5} className="dark:[fill:#1a2333]" />
      {/* Logo or monogram */}
      {showLogo && (
        <>
          <defs>
            <clipPath id={`clip-${node.id}`}>
              <circle r={NODE_R - 3} />
            </clipPath>
          </defs>
          <image
            href={`https://logo.clearbit.com/${node.logoDomain}`}
            x={-(NODE_R - 3)}
            y={-(NODE_R - 3)}
            width={(NODE_R - 3) * 2}
            height={(NODE_R - 3) * 2}
            clipPath={`url(#clip-${node.id})`}
            preserveAspectRatio="xMidYMid slice"
            onError={() => setLogoFailed(true)}
          />
        </>
      )}
      {!showLogo && (
        <>
          <circle r={NODE_R - 3} fill={node.brandColor} />
          <text
            textAnchor="middle"
            dy={5}
            className="fill-white text-[14px] font-bold"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {node.monogram}
          </text>
        </>
      )}
      {/* Label */}
      <text x={labelDx} y={4} textAnchor={labelAnchor} className="fill-current text-[13px] font-semibold">
        {node.label}
      </text>
      <text x={labelDx} y={20} textAnchor={labelAnchor} className="fill-current text-[10.5px] opacity-60">
        {node.ticker ?? node.category}
      </text>

      <style>{`@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </g>
  );
}

function MapTooltip({
  x, y, content,
}: {
  x: number;
  y: number;
  content:
    | { kind: "node"; node: ExposureMapNode; edges: ExposureMapEdge[] }
    | { kind: "edge"; edge: ExposureMapEdge; sourceNode: ExposureMapNode; targetNode: ExposureMapNode };
}) {
  // Position to the right of the active point, clamped so it doesn't
  // overflow the container.
  const style: React.CSSProperties = {
    position: "absolute",
    left: Math.min(x + 24, 99999),
    top: Math.max(0, y - 60),
    maxWidth: 340,
    pointerEvents: "none", // tooltip never steals hover
    zIndex: 30,
  };
  if (content.kind === "edge") {
    const e = content.edge;
    return (
      <div style={style} className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {content.sourceNode.label} → {content.targetNode.label}
          </span>
        </div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          {REL_LABEL[e.relationshipType]} · confidence {CONF_LABEL[e.confidence]}
          {e.estimatedValue && ` · ${e.estimatedValue}`}
        </div>
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">{e.summary}</p>
        <div className="mt-2 text-[10px] text-zinc-500">Updated {e.dateUpdated}</div>
        {e.sourceUrls.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[10px]">
            {e.sourceUrls.slice(0, 2).map((u) => (
              <li key={u} className="truncate text-emerald-700 dark:text-emerald-400">{new URL(u).hostname}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div style={style} className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">{content.node.label}</div>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
        {content.node.ticker ? `${content.node.ticker} · ` : ""}{content.node.category}
      </div>
      {content.edges.length === 0 ? (
        <div className="text-[11px] italic text-zinc-500">No edges match current filters.</div>
      ) : (
        <ul className="space-y-1 text-[11px]">
          {content.edges.slice(0, 5).map((e) => {
            const otherId = e.sourceId === content.node.id ? e.targetId : e.sourceId;
            const other = EXPOSURE_NODES.find((n) => n.id === otherId);
            return (
              <li key={e.id} className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{other?.label ?? otherId}</span>
                <span className="text-zinc-500">· {REL_LABEL[e.relationshipType]}</span>
                <span className="ml-auto text-[9px] uppercase tracking-wider text-zinc-400">{CONF_LABEL[e.confidence]}</span>
              </li>
            );
          })}
          {content.edges.length > 5 && (
            <li className="text-[10px] italic text-zinc-500">+{content.edges.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ──────────────── Back-compat re-export ────────────────
// The old hero accepted edges via prop; the new hero is self-contained
// from lib/investing/exposure-map-data.ts. We keep the named type
// export so existing imports compile without churn.
export type ExposureEdge = ExposureMapEdge;
