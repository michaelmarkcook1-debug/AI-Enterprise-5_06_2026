"use client";

// Indirect-exposure hero map.
// ──────────────────────────
// Replaces the small SVG that previously lived on /investor-tools/exposure-map.
// This version is designed as a dashboard hero panel — full-width, taller,
// with vendor logos, hover-to-highlight edges, and click-to-pin a node so
// operators can read out the dependency map for one company at a time.
//
// All data comes pre-resolved from the server. The component is purely
// presentational + interactive (hover/pin state).

import { useMemo, useState } from "react";

export interface ExposureEdge {
  privateProviderId: string;
  privateProviderName: string;
  publicTicker: string;
  exposureType: string;
  exposureStrength: number;
  revenueLinkage: number;
  confidence: number;
  dilutionPenalty: number;
  indirectExposureScore: number;
}

// ──────────────── Logo resolution ────────────────
// Maps the vendor id (ticker or provider slug) → the company's primary
// domain. clearbit.com/logo/{domain} serves a high-resolution PNG with
// transparency — no API key needed. Falls back to a typeset chip when
// the domain is unknown or the logo fails to load.
const DOMAIN_BY_KEY: Record<string, string> = {
  // Public tickers
  MSFT: "microsoft.com",
  GOOGL: "google.com",
  AMZN: "amazon.com",
  NVDA: "nvidia.com",
  ORCL: "oracle.com",
  ASML: "asml.com",
  AMD: "amd.com",
  AVGO: "broadcom.com",
  ARM: "arm.com",
  CRM: "salesforce.com",
  NOW: "servicenow.com",
  SNOW: "snowflake.com",
  IBM: "ibm.com",
  SAP: "sap.com",
  META: "meta.com",
  // Private providers
  openai: "openai.com",
  anthropic: "anthropic.com",
  mistral: "mistral.ai",
  cohere: "cohere.com",
  databricks: "databricks.com",
  cerebras: "cerebras.net",
  harvey: "harvey.ai",
  glean: "glean.com",
  perplexity: "perplexity.ai",
  xai: "x.ai",
  writer: "writer.com",
  hebbia: "hebbia.ai",
  rogo: "rogo.ai",
  meta: "meta.com",
  deepseek: "deepseek.com",
  snow: "snowflake.com",
};

function logoUrl(key: string): string | null {
  const domain = DOMAIN_BY_KEY[key];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
}

function prettyName(rawId: string, fallback: string): string {
  // Normalise the special grouping ids that aren't real companies.
  const overrides: Record<string, string> = {
    frontier_labs: "Frontier labs",
    ai_infrastructure: "AI infrastructure",
    meta: "Meta",
  };
  return overrides[rawId] ?? fallback;
}

// ──────────────── Visual constants ────────────────
const W = 1100;
const ROW_H = 70;
const PADDING_Y = 80;
const COL_LEFT = 220;
const COL_RIGHT = W - 220;

export default function ExposureMapHero({ edges }: { edges: ExposureEdge[] }) {
  const publicTickers = useMemo(() => Array.from(new Set(edges.map((e) => e.publicTicker))).sort(), [edges]);
  const privateIds = useMemo(() => Array.from(new Set(edges.map((e) => e.privateProviderId))).sort(), [edges]);
  const nameByPrivateId = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of edges) m.set(e.privateProviderId, prettyName(e.privateProviderId, e.privateProviderName));
    return m;
  }, [edges]);

  // Pinned + hovered nodes share highlight semantics; pinned wins.
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = pinned ?? hovered;

  const H = PADDING_Y * 2 + Math.max(publicTickers.length, privateIds.length) * ROW_H;

  const publicY = (ticker: string) => PADDING_Y + publicTickers.indexOf(ticker) * ROW_H;
  const privateY = (id: string) => PADDING_Y + privateIds.indexOf(id) * ROW_H;

  // For the active node, compute the set of connected counterparties so
  // edges-not-touching-active fade out.
  const activeEdges = useMemo(() => {
    if (!active) return new Set<string>();
    const ids = new Set<string>();
    for (const e of edges) {
      const key = `${e.publicTicker}|${e.privateProviderId}`;
      if (e.publicTicker === active || e.privateProviderId === active) ids.add(key);
    }
    return ids;
  }, [edges, active]);

  function isHighlighted(edgeKey: string): boolean {
    if (!active) return false;
    return activeEdges.has(edgeKey);
  }

  function nodeOpacity(id: string): number {
    if (!active) return 1;
    if (active === id) return 1;
    // Check whether this node is connected to the active node.
    for (const e of edges) {
      if (e.publicTicker === active && e.privateProviderId === id) return 1;
      if (e.privateProviderId === active && e.publicTicker === id) return 1;
    }
    return 0.25;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Indirect exposure map
          </div>
          <h2 className="mt-0.5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Who owns whose AI?
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Hover a logo to highlight its dependencies. Click to pin. Edge thickness ∝ strength × revenue linkage; opacity ∝ confidence.
          </p>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={() => setPinned(null)}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Unpin {pinned}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="min-h-[420px] text-zinc-900 dark:text-zinc-100"
        >
          {/* Column headers */}
          <text x={COL_LEFT} y={36} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-wider opacity-70">
            Public companies
          </text>
          <text x={COL_RIGHT} y={36} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-wider opacity-70">
            AI providers / labs
          </text>

          {/* Edges first so logos paint over them */}
          {edges.map((e) => {
            const edgeKey = `${e.publicTicker}|${e.privateProviderId}`;
            const ay = publicY(e.publicTicker);
            const by = privateY(e.privateProviderId);
            const stroke = 1.2 + e.exposureStrength * e.revenueLinkage * 8;
            const baseOpacity = 0.2 + e.confidence * 0.6;
            const highlighted = isHighlighted(edgeKey);
            const opacity = !active ? baseOpacity : highlighted ? 0.9 : 0.06;
            const color =
              e.indirectExposureScore >= 50
                ? "#10b981" // emerald-500 — strong
                : e.indirectExposureScore >= 30
                  ? "#84cc16" // lime-500 — medium
                  : "#f59e0b"; // amber-500 — weak
            const cx = (COL_LEFT + COL_RIGHT) / 2;
            return (
              <g key={edgeKey}>
                <title>
                  {`${e.publicTicker} → ${prettyName(e.privateProviderId, e.privateProviderName)}\n${e.exposureType}\nscore ${e.indirectExposureScore.toFixed(0)} · strength ${e.exposureStrength.toFixed(2)} · linkage ${e.revenueLinkage.toFixed(2)} · confidence ${e.confidence.toFixed(2)} · dilution ${e.dilutionPenalty.toFixed(2)}`}
                </title>
                <path
                  d={`M ${COL_LEFT + 26} ${ay} C ${cx} ${ay}, ${cx} ${by}, ${COL_RIGHT - 26} ${by}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={highlighted ? stroke + 1 : stroke}
                  strokeOpacity={opacity}
                  style={{ transition: "stroke-opacity 200ms, stroke-width 200ms" }}
                />
              </g>
            );
          })}

          {/* Public nodes */}
          {publicTickers.map((ticker) => (
            <Node
              key={`pub-${ticker}`}
              cx={COL_LEFT}
              cy={publicY(ticker)}
              id={ticker}
              label={ticker}
              logo={logoUrl(ticker)}
              tone="public"
              opacity={nodeOpacity(ticker)}
              activePin={pinned === ticker}
              onHover={setHovered}
              onClick={(id) => setPinned((p) => (p === id ? null : id))}
            />
          ))}

          {/* Private nodes */}
          {privateIds.map((id) => (
            <Node
              key={`prv-${id}`}
              cx={COL_RIGHT}
              cy={privateY(id)}
              id={id}
              label={nameByPrivateId.get(id) ?? id}
              logo={logoUrl(id)}
              tone="private"
              opacity={nodeOpacity(id)}
              activePin={pinned === id}
              onHover={setHovered}
              onClick={(nodeId) => setPinned((p) => (p === nodeId ? null : nodeId))}
            />
          ))}
        </svg>
      </div>

      {/* Active-node readout */}
      {active && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {pinned ? "Pinned" : "Hovered"}
          </div>
          <div className="mt-0.5 font-semibold text-emerald-900 dark:text-emerald-100">{active}</div>
          <ul className="mt-2 space-y-1 text-xs">
            {edges
              .filter((e) => e.publicTicker === active || e.privateProviderId === active)
              .sort((a, b) => b.indirectExposureScore - a.indirectExposureScore)
              .map((e) => (
                <li key={`${e.publicTicker}|${e.privateProviderId}`} className="flex flex-wrap items-center gap-2 text-emerald-900/90 dark:text-emerald-200/90">
                  <span className="font-mono text-emerald-900 dark:text-emerald-100">
                    {e.publicTicker} ↔ {prettyName(e.privateProviderId, e.privateProviderName)}
                  </span>
                  <span>· {e.exposureType}</span>
                  <span className="ml-auto rounded bg-emerald-200/60 px-1.5 py-0.5 font-mono dark:bg-emerald-900/40">
                    score {e.indirectExposureScore.toFixed(0)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface NodeProps {
  cx: number;
  cy: number;
  id: string;
  label: string;
  logo: string | null;
  tone: "public" | "private";
  opacity: number;
  activePin: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

function Node({ cx, cy, id, label, logo, tone, opacity, activePin, onHover, onClick }: NodeProps) {
  const radius = 22;
  const ringColor = tone === "public" ? "#10b981" : "#a78bfa"; // emerald / violet
  const labelOffset = tone === "public" ? -(radius + 14) : radius + 14;
  const textAnchor = tone === "public" ? "end" : "start";

  return (
    <g
      transform={`translate(${cx},${cy})`}
      style={{ cursor: "pointer", opacity, transition: "opacity 180ms" }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(id)}
    >
      {/* Pin ring (visual indicator when pinned) */}
      {activePin && <circle r={radius + 6} fill="none" stroke={ringColor} strokeWidth={2} strokeDasharray="3 3" />}
      {/* Outer ring */}
      <circle r={radius} fill="white" stroke={ringColor} strokeWidth={2} />
      {/* Logo (image clipped to circle) */}
      {logo && (
        <>
          <defs>
            <clipPath id={`clip-${id}`}>
              <circle r={radius - 2} />
            </clipPath>
          </defs>
          <image
            href={logo}
            x={-(radius - 2)}
            y={-(radius - 2)}
            width={(radius - 2) * 2}
            height={(radius - 2) * 2}
            clipPath={`url(#clip-${id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      )}
      {/* Initials fallback when no logo */}
      {!logo && (
        <text textAnchor="middle" dy={5} className="fill-current text-[12px] font-bold font-mono">
          {label.slice(0, 3).toUpperCase()}
        </text>
      )}
      {/* Label outside the circle */}
      <text
        x={labelOffset}
        y={5}
        textAnchor={textAnchor}
        className="fill-current text-[13px] font-semibold"
      >
        {label}
      </text>
    </g>
  );
}
