"use client";

// AI Ecosystem Navigator — premium hero.
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

// Maps exposure-map node ids → /vendors/[slug] slugs. Only entries with
// a curated profile in lib/intelligence/seed.ts are listed here; the
// node-detail panel hides the "View vendor profile" link when there's
// no mapping rather than rendering a broken CTA.
//
// Tickers (uppercase) map to plain VendorProfile ids; lowercase ids
// (most right-side nodes) are usually identical to the slug.
const NODE_TO_VENDOR_SLUG: Record<string, string> = {
  // Left-side public tickers
  MSFT: "microsoft",
  AMZN: "aws",
  GOOGL: "google",
  NVDA: "nvidia",
  ORCL: "oracle",
  CRM: "salesforce",
  SNOW: "snowflake",
  // ASML has no /vendors/asml profile — omitted intentionally.
  // Right-side labs / model owners
  openai: "openai",
  anthropic: "anthropic",
  // deepmind has no separate profile — Alphabet's slug is "google"
  deepmind: "google",
  mistral: "mistral",
  cohere: "cohere",
  xai: "xai",
  perplexity: "perplexity",
  meta: "meta",
  deepseek: "deepseek",
  alibaba: "alibaba",
  moonshot: "moonshot",
  zai: "zai",
  minimax: "minimax",
  ai21: "ai21",
  aleph: "aleph",
  // nemotron has no standalone vendor profile — falls under NVIDIA
  nemotron: "nvidia",
};

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
  const nodeSideById = useMemo(() => new Map(EXPOSURE_NODES.map((n) => [n.id, n.side])), []);

  // Filter edges by relationship type + confidence + visible-nodes set.
  const visibleEdges = useMemo(() => {
    return EXPOSURE_EDGES.filter((e) => {
      if (!activeRelTypes.has(e.relationshipType)) return false;
      if (!activeConfTiers.has(e.confidence)) return false;
      if (!visibleNodeIds.has(e.sourceId) || !visibleNodeIds.has(e.targetId)) return false;
      // Bipartite guard: this hero lays out left(owners) → right(labs). An edge
      // must span the two columns. A SAME-SIDE edge (lab↔lab e.g. anthropic→xai,
      // or owner↔owner e.g. GOOGL→NVDA) can't be positioned here and would draw
      // a stray line across the top of the canvas (leftY/rightY findIndex → -1).
      // Those relationships surface on /dependencies instead.
      const ss = nodeSideById.get(e.sourceId);
      const ts = nodeSideById.get(e.targetId);
      return ss !== undefined && ts !== undefined && ss !== ts;
    });
  }, [activeRelTypes, activeConfTiers, visibleNodeIds, nodeSideById]);

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

  // Clamp a missing id (findIndex → -1) to the first row rather than PAD_Y-ROW_H
  // (above the canvas) — a defensive floor so a stray edge can never again paint
  // a line across the top; correctness is already handled by the bipartite guard.
  const leftY = (id: string) => PAD_Y + Math.max(0, leftNodes.findIndex((n) => n.id === id)) * ROW_H;
  const rightY = (id: string) => PAD_Y + Math.max(0, rightNodes.findIndex((n) => n.id === id)) * ROW_H;

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
    <div ref={containerRef} className="relative rounded-2xl border border-[#e3d9c0] bg-gradient-to-br from-white to-[#f6f1e3] p-6 shadow-sm dark:border-[#1d3a57] dark:from-[#0a1521] dark:to-[#071827]">
      {/* Header */}
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
          AI Ecosystem Navigator
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#15263c] dark:text-[#f6f9fc] md:text-3xl">
          Understand the AI Market at a Glance
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#3f5068] dark:text-[#a7bacd]">
          Who backs whom, who hosts whom, and where enterprise AI risk concentrates.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#e3d9c0] pb-4 dark:border-[#1d3a57]">
        {/* Relationship-type filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75] dark:text-[#8fa5bb]">Relationship</span>
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
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#0a1f38] bg-[#0c2238] text-white dark:border-[#ece4d0] dark:bg-[#ece3cb] dark:text-[#13294b]"
                    : "border-[#d6c9a8] bg-white text-[#3f5068] hover:border-[#6b87a3] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd] dark:hover:border-[#6b87a3]"
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
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75] dark:text-[#8fa5bb]">Confidence</span>
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
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-[#d6c9a8] bg-white text-[#3f5068] hover:border-emerald-500 dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]"
                }`}
              >
                {CONF_LABEL[ct]}
              </button>
            );
          })}
        </div>

        {/* Extended/Core toggle removed — the full ecosystem (sovereign +
            infra middleware + frontier labs) now renders by default on
            the dedicated /exposure-map page. The `showExtended` state +
            EXTENDED_ECOSYSTEM_NODE_IDS plumbing is intentionally kept so
            the toggle can be reintroduced if curation diverges again. */}

        {/* Clear pins */}
        {pinned.size > 0 && (
          <button
            type="button"
            onClick={() => setPinned(new Set())}
            className="ml-auto rounded-full border border-[#d6c9a8] px-3 py-0.5 text-xs font-medium text-[#2e3f57] hover:bg-[#ece3cb] dark:border-[#2a4a6b] dark:text-[#c2d1e0] dark:hover:bg-[#143049]"
          >
            Clear {pinned.size} pin{pinned.size === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {/* Directionality note — always visible above the SVG so users
          don't have to guess what an edge means. Investment / subsidiary
          imply ownership-or-control exposure; cloud / hosting / supply
          chain / partnership imply dependency or distribution exposure. */}
      <div className="mb-3 rounded-lg border border-[#e3d9c0] bg-[#f6f1e3] px-3 py-2 text-xs leading-relaxed text-[#3f5068] dark:border-[#1d3a57] dark:bg-[#0c2238]/50 dark:text-[#a7bacd]">
        <span className="font-semibold text-[#2e3f57] dark:text-[#c2d1e0]">Direction:</span>{" "}
        edges run <span className="font-semibold">left → right</span>, from exposure owner to model/API provider.{" "}
        <span className="font-semibold text-amber-700 dark:text-amber-400">Investment</span> and{" "}
        <span className="font-semibold text-violet-700 dark:text-violet-400">subsidiary</span>{" "}
        indicate ownership / control exposure; <span className="font-semibold text-cyan-700 dark:text-cyan-400">cloud</span>,{" "}
        <span className="font-semibold text-teal-700 dark:text-teal-400">hosting</span>,{" "}
        <span className="font-semibold text-[#4c5d75] dark:text-[#a7bacd]">supply chain</span>, and{" "}
        <span className="font-semibold text-lime-700 dark:text-lime-400">partnership</span>{" "}
        indicate dependency or distribution exposure.
      </div>

      {/* Inline legend strip — always visible. Same content as the
          legend at the bottom of the panel, but anchored near the
          map so colour decoding doesn't require scrolling. */}
      <div className="mb-3 hidden flex-wrap items-center gap-3 rounded-lg border border-[#e3d9c0] bg-white px-3 py-2 text-xs text-[#3f5068] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#a7bacd] md:flex">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75]">Legend</span>
        {ALL_REL_TYPES.map((rt) => (
          <span key={rt} className="inline-flex items-center gap-1.5">
            <svg width={22} height={6} aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke={REL_COLOR[rt]} strokeWidth={2.5} />
              <polygon points="18,0 22,3 18,6" fill={REL_COLOR[rt]} />
            </svg>
            {REL_LABEL[rt]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <svg width={22} height={6} aria-hidden>
            <line x1={0} y1={3} x2={22} y2={3} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 3" />
          </svg>
          Seed / unverified
        </span>
      </div>

      {/* Map — desktop / tablet (≥ md). Below md we fall through to the
          stacked relationship explorer at the bottom of this component. */}
      <div className="relative hidden overflow-x-auto md:block">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="min-h-[460px] cursor-default text-[#15263c] dark:text-[#eef3f8]"
          role="img"
          aria-label="Indirect AI market exposure map"
        >
          {/* Per-relationship-colour arrow markers so every edge carries
              a direction cue at its target node. orient="auto" rotates
              the marker along the bezier path tangent. */}
          <defs>
            {ALL_REL_TYPES.map((rt) => (
              <marker
                key={`arrow-${rt}`}
                id={`arrow-${rt}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={REL_COLOR[rt]} />
              </marker>
            ))}
          </defs>
          {/* Column headers */}
          <text x={COL_LEFT_X} y={42} textAnchor="middle" className="fill-current text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            Public exposure owners
          </text>
          <text x={COL_RIGHT_X} y={42} textAnchor="middle" className="fill-current text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            AI labs / model owners
          </text>

          {/* Edges */}
          {visibleEdges.map((e) => {
            const src = EXPOSURE_NODES.find((n) => n.id === e.sourceId)!;
            const tgt = EXPOSURE_NODES.find((n) => n.id === e.targetId)!;
            // Lay out by NODE SIDE, not source/target order — a reversed edge
            // (lab→owner) still draws left→right. visibleEdges guarantees one of
            // each side, so both lookups always resolve (never findIndex → -1).
            const leftNode = src.side === "left" ? src : tgt;
            const rightNode = src.side === "left" ? tgt : src;
            const ay = leftY(leftNode.id);
            const by = rightY(rightNode.id);
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
                d={`M ${COL_LEFT_X + NODE_R} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${COL_RIGHT_X - NODE_R - 6} ${by}`}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeDasharray={dashArray}
                markerEnd={`url(#arrow-${e.relationshipType})`}
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

      {/* Mobile / narrow-viewport stacked card explorer.
          A SVG node-link layout is unreadable below ~700px wide, so
          below md we drop the SVG and render edges as a flat list of
          relationship cards grouped by left-side node. Same filter
          state as the SVG above, so the chips at the top of the
          component work consistently across both views. */}
      <div className="md:hidden">
        <MobileStackedView
          edges={visibleEdges}
          getNode={(id) => EXPOSURE_NODES.find((n) => n.id === id)!}
        />
      </div>

      {/* Active-node readout — persistent panel below the SVG showing
          the incident edges for every pinned / hovered node, with
          clickable evidence URLs and (when available) a vendor-profile
          drill-through. Hover gives a quick read; click-to-pin makes
          the link surface persistent and reachable. */}
      {activeIds.size > 0 && (
        <ActiveReadout
          activeIds={activeIds}
          edges={visibleEdges}
          getNode={(id) => EXPOSURE_NODES.find((n) => n.id === id)!}
          pinnedCount={pinned.size}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e3d9c0] pt-3 text-xs text-[#3f5068] dark:border-[#1d3a57] dark:text-[#a7bacd]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75]">Legend</span>
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
        <span className="ml-auto text-[#4c5d75]">Hover for detail · click to pin (max {MAX_PINS})</span>
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
  const [focused, setFocused] = useState(false);
  const showLogo = node.logoDomain && !logoFailed;
  const labelDx = labelSide === "left" ? -(NODE_R + 14) : NODE_R + 14;
  const labelAnchor = labelSide === "left" ? "end" : "start";

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      tabIndex={0}
      role="button"
      aria-label={`${node.label} — ${node.category}${pinned ? " (pinned)" : ""}`}
      onFocus={() => { setFocused(true); onEnter(); }}
      onBlur={() => { setFocused(false); onLeave(); }}
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
      {/* Keyboard focus ring — explicit, brand gold. SVG <g> does not reliably
          paint the CSS :focus-visible outline, so we render our own (WCAG 2.4.7). */}
      {focused && (
        <circle r={NODE_R + 4} fill="none" stroke="#b08d2f" strokeWidth={2} pointerEvents="none" />
      )}
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
      {/* Filled bubble — brand colour as base so the bubble carries
          identity even before the logo image loads (or if Clearbit is
          rate-limited / blocked). */}
      <circle r={NODE_R} fill={node.brandColor} stroke={node.brandColor} strokeWidth={2.5} />
      <circle r={NODE_R - 3} fill="white" className="dark:[fill:#1a2333]" />

      {/* Monogram — ALWAYS rendered, behind the logo. If the logo image
          loads successfully it covers the monogram. If the image fails,
          returns transparent, is blocked, or is slow, the monogram keeps
          the node identifiable. This replaces the previous race-condition
          path where SSR showed the image only, and the monogram fallback
          relied on a client-side onError event firing. */}
      <text
        textAnchor="middle"
        dy={5}
        fill={node.brandColor}
        className="text-[13px] font-bold"
        style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
      >
        {node.monogram}
      </text>

      {/* Logo image — clipped to circle, painted ON TOP of the monogram.
          If it loads → covers monogram, brand identity from the real
          logo. If it fails / 404s / is empty → monogram shows through. */}
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
      <div style={style} className="rounded-xl border border-[#e3d9c0] bg-white p-3 text-xs shadow-lg dark:border-[#2a4a6b] dark:bg-[#0c2238]">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
          <span className="font-semibold text-[#15263c] dark:text-[#eef3f8]">
            {content.sourceNode.label} → {content.targetNode.label}
          </span>
        </div>
        <div className="mb-1.5 text-xs uppercase tracking-wider text-[#4c5d75]">
          {REL_LABEL[e.relationshipType]} · confidence {CONF_LABEL[e.confidence]}
          {e.estimatedValue && ` · ${e.estimatedValue}`}
        </div>
        <p className="leading-relaxed text-[#2e3f57] dark:text-[#c2d1e0]">{e.summary}</p>
        <div className="mt-2 text-xs text-[#4c5d75]">Updated {e.dateUpdated}</div>
        {e.sourceUrls.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {e.sourceUrls.slice(0, 2).map((u) => (
              <li key={u} className="truncate text-emerald-700 dark:text-emerald-400">{new URL(u).hostname}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div style={style} className="rounded-xl border border-[#e3d9c0] bg-white p-3 text-xs shadow-lg dark:border-[#2a4a6b] dark:bg-[#0c2238]">
      <div className="mb-1 font-semibold text-[#15263c] dark:text-[#eef3f8]">{content.node.label}</div>
      <div className="mb-2 text-xs uppercase tracking-wider text-[#4c5d75]">
        {content.node.ticker ? `${content.node.ticker} · ` : ""}{content.node.category}
      </div>
      {content.edges.length === 0 ? (
        <div className="text-xs italic text-[#4c5d75]">No edges match current filters.</div>
      ) : (
        <ul className="space-y-1 text-xs">
          {content.edges.slice(0, 5).map((e) => {
            const otherId = e.sourceId === content.node.id ? e.targetId : e.sourceId;
            const other = EXPOSURE_NODES.find((n) => n.id === otherId);
            return (
              <li key={e.id} className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
                <span className="font-medium text-[#20314a] dark:text-[#d8e2ec]">{other?.label ?? otherId}</span>
                <span className="text-[#4c5d75]">· {REL_LABEL[e.relationshipType]}</span>
                <span className="ml-auto text-[9px] uppercase tracking-wider text-[#6b7d93]">{CONF_LABEL[e.confidence]}</span>
              </li>
            );
          })}
          {content.edges.length > 5 && (
            <li className="text-xs italic text-[#4c5d75]">+{content.edges.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ──────────────── Mobile stacked-card view ────────────────
// Used below md breakpoint. Groups visible edges by source (left-side
// public companies) so the user can scan "Microsoft exposes you to:
// OpenAI [investment], Mistral [investment], Meta [model hosting]"
// without horizontal scrolling. Each card respects the same
// relationship-type colour palette and confidence dashing the SVG uses.

function MobileStackedView({
  edges, getNode,
}: {
  edges: ExposureMapEdge[];
  getNode: (id: string) => ExposureMapNode;
}) {
  // Group edges by source node, preserving original order.
  const grouped = new Map<string, ExposureMapEdge[]>();
  for (const e of edges) {
    const list = grouped.get(e.sourceId) ?? [];
    list.push(e);
    grouped.set(e.sourceId, list);
  }
  if (grouped.size === 0) {
    return (
      <div className="rounded-lg border border-[#e3d9c0] bg-[#f6f1e3] p-4 text-center text-xs text-[#4c5d75] dark:border-[#1d3a57] dark:bg-[#0c2238]/40">
        No relationships match the current filters.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([sourceId, sourceEdges]) => {
        const src = getNode(sourceId);
        return (
          <details key={sourceId} open className="rounded-xl border border-[#e3d9c0] bg-white dark:border-[#1d3a57] dark:bg-[#0c2238]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ backgroundColor: src.brandColor }}
                aria-hidden
              >
                {src.monogram}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#15263c] dark:text-[#eef3f8]">{src.label}</div>
                <div className="text-xs uppercase tracking-wider text-[#4c5d75]">
                  {src.ticker ?? src.category} · {sourceEdges.length} relationship{sourceEdges.length === 1 ? "" : "s"}
                </div>
              </div>
              <span aria-hidden className="text-[#6b7d93]">▾</span>
            </summary>
            <ul className="divide-y divide-[#e3d9c0] border-t border-[#e3d9c0] dark:divide-[#1d3a57] dark:border-[#1d3a57]">
              {sourceEdges.map((e) => {
                const tgt = getNode(e.targetId);
                return (
                  <li key={e.id} className="space-y-1.5 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
                      <span className="font-semibold text-[#15263c] dark:text-[#eef3f8]">{tgt.label}</span>
                      <span className="ml-auto rounded-full bg-[#ece3cb] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]">
                        {CONF_LABEL[e.confidence]}
                      </span>
                    </div>
                    <div className="text-xs uppercase tracking-wider text-[#4c5d75]">
                      {REL_LABEL[e.relationshipType]}
                      {e.estimatedValue && ` · ${e.estimatedValue}`}
                      {` · updated ${e.dateUpdated}`}
                    </div>
                    <p className="leading-relaxed text-[#2e3f57] dark:text-[#c2d1e0]">{e.summary}</p>
                    {e.sourceUrls.length > 0 && (
                      <div className="text-xs text-emerald-700 dark:text-emerald-400">
                        {e.sourceUrls.slice(0, 2).map((u) => {
                          try {
                            return <span key={u} className="mr-2">{new URL(u).hostname}</span>;
                          } catch {
                            return null;
                          }
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

// ──────────────── Active-node readout (clickable detail panel) ────────────────
// Renders one card per pinned/hovered node, listing each incident edge
// with relationship type, confidence, summary, clickable evidence URLs,
// and (when a curated profile exists) a "View vendor profile" link.
// This is the surface where the operator actually CLICKS — the floating
// MapTooltip is hover-only.

function safeHost(u: string): string | null {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

function ActiveReadout({
  activeIds, edges, getNode, pinnedCount,
}: {
  activeIds: Set<string>;
  edges: ExposureMapEdge[];
  getNode: (id: string) => ExposureMapNode;
  pinnedCount: number;
}) {
  const ids = [...activeIds];
  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        {pinnedCount > 0 ? `${pinnedCount} pinned · ${ids.length} active` : "Hovered detail"}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ids.map((id) => {
          const node = getNode(id);
          const incident = edges
            .filter((e) => e.sourceId === id || e.targetId === id)
            .sort((a, b) => b.strengthScore - a.strengthScore);
          const profileSlug = NODE_TO_VENDOR_SLUG[id];
          return (
            <div key={id} className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#15263c] dark:text-[#eef3f8]">{node.label}</div>
                  <div className="text-xs uppercase tracking-wider text-[#4c5d75]">
                    {node.ticker ? `${node.ticker} · ` : ""}{node.category}
                  </div>
                </div>
                {profileSlug && (
                  <a
                    href={`/vendors/${profileSlug}`}
                    className="rounded-full border border-emerald-500 bg-white px-2.5 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-[#0c2238] dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                  >
                    View vendor profile →
                  </a>
                )}
              </div>
              <ul className="mt-3 space-y-2">
                {incident.length === 0 && (
                  <li className="text-xs italic text-[#4c5d75]">No relationships match the current filters.</li>
                )}
                {incident.map((e) => {
                  const isOutgoing = e.sourceId === id;
                  const counterparty = getNode(isOutgoing ? e.targetId : e.sourceId);
                  return (
                    <li key={e.id} className="rounded-md border border-[#e3d9c0] bg-white/70 p-2 text-xs dark:border-[#1d3a57] dark:bg-[#0c2238]/70">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: REL_COLOR[e.relationshipType] }} />
                        <span className="font-semibold text-[#20314a] dark:text-[#d8e2ec]">
                          {isOutgoing ? "→" : "←"} {counterparty.label}
                        </span>
                        <span className="text-[#4c5d75]">· {REL_LABEL[e.relationshipType]}</span>
                        <span className="ml-auto rounded bg-[#ece3cb] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]">
                          {CONF_LABEL[e.confidence]}
                        </span>
                      </div>
                      {e.summary && (
                        <p className="mt-1 leading-relaxed text-[#2e3f57] dark:text-[#c2d1e0]">{e.summary}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4c5d75]">
                        {e.estimatedValue && <span>{e.estimatedValue}</span>}
                        <span>Updated {e.dateUpdated}</span>
                      </div>
                      {/* Evidence links — clickable, open in new tab,
                          safe-attribute rel. Falls back to a "Evidence
                          pending" line when sourceUrls is empty so the
                          operator never sees a silent gap. */}
                      <div className="mt-2 border-t border-[#e3d9c0] pt-1.5 dark:border-[#1d3a57]">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75]">View evidence</div>
                        {e.sourceUrls.length === 0 ? (
                          <div className="mt-0.5 text-xs italic text-[#4c5d75]">Evidence pending — relationship classified from public reporting; primary source not yet attached.</div>
                        ) : (
                          <ul className="mt-0.5 space-y-0.5">
                            {e.sourceUrls.slice(0, 3).map((url) => {
                              const host = safeHost(url);
                              if (!host) return null;
                              return (
                                <li key={url}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                                  >
                                    {host}
                                    <span aria-hidden className="text-[9px]">↗</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────── Back-compat re-export ────────────────
// The old hero accepted edges via prop; the new hero is self-contained
// from lib/investing/exposure-map-data.ts. We keep the named type
// export so existing imports compile without churn.
export type ExposureEdge = ExposureMapEdge;
