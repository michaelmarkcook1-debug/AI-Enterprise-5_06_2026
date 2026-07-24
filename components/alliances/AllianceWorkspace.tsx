"use client";

// /alliances workspace — the pasted "Sovereign Alliances" prototype rebuilt
// structure-for-structure in the app's deep-green identity.
// ───────────────────────────────────────────────────────────────────────────
// Same IA as the original: header + stat strip, left icon rail, and four tabs —
// Map (force-directed canvas + control panel + topology legend + dossier
// drawer), Directory (6-column registry), Compare (two-partner head-to-head),
// Stats (metric cards + two charts + narrative).
//
// Recoloured only: neon cyan/violet/blue on slate → green ink (#3f9d76) + gold
// (#d4af37) on the deep-green canvas. No new dependencies — the canvas physics
// is vanilla rAF (as the original was) and the charts are inline SVG rather
// than Chart.js.
//
// DATA HONESTY: the original's header strip and Stats tab carried unsourceable
// market figures ($14B market, 1M+ certifications, +75% margin, bill-rate
// bands). Those are NOT reproduced. Every number rendered here is either a
// count measured off the dataset on this page or a fact-checked, cited figure.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AllianceRow } from "@/lib/delivery/alliance-rows";
import { TIER_LABEL, KIND_LABEL } from "@/lib/delivery/alliance-rows";
import type { VendorVenture } from "@/lib/delivery/alliance-highlights";

type TabId = "map" | "directory" | "compare" | "stats";

interface Summary {
  links: number;
  partners: number;
  vendors: number;
  spotlit: number;
  encroaching: number;
  vendorCoverage: { vendorId: string; vendorName: string; count: number }[];
  byTier: Record<string, number>;
}

// ── palette (deep-green identity) ──
const C = {
  canvas: "#071410",
  panel: "rgba(11,37,25,0.62)",
  solid: "#0b2519",
  field: "#0a1f16",
  line: "rgba(255,255,255,0.09)",
  gold: "#d4af37",
  goldDim: "#b08d2f",
  green: "#3f9d76",
  greenLt: "#7fd3ac",
  greenDk: "#4f8f76",
  ink: "#eef3ee",
  dim: "#9db5a8",
  faint: "#7a9689",
};

const NODE_COLOR: Record<string, string> = {
  model: C.gold,
  global_si: C.green,
  strategy_consultancy: C.greenLt,
  platform_hybrid: C.goldDim,
  regional_si: C.greenDk,
};

const TAGS = ["Financial services", "Public sector", "Cybersecurity", "Telecoms"];

// ── tiny inline icon set (replaces FontAwesome) ──
function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    map: <><circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" /><path d="M6.8 7.2 10.4 16M17.2 7.2 13.6 16M7 6h10" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9.5h18M3 15h18M9 4v16" /></>,
    compare: <><rect x="3" y="4" width="7.5" height="16" rx="1.5" /><rect x="13.5" y="4" width="7.5" height="16" rx="1.5" /></>,
    stats: <><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M15.5 3.6A9 9 0 0 1 20.4 8.5" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    sliders: <><path d="M4 7h11M19 7h1M4 17h5M13 17h7" /><circle cx="17" cy="7" r="2" /><circle cx="11" cy="17" r="2" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    scale: <><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6h5L5 8Zm14 0-2.5 6h5L19 8Z" /></>,
    chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3" /></>,
    link: <><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.3-1.3" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

interface GNode {
  id: string; name: string; type: "model" | "gsi"; kind: string; color: string;
  radius: number; x: number; y: number; vx: number; vy: number; fx: number | null; fy: number | null;
}
interface GLink { source: GNode; target: GNode; isElite: boolean; tier: string; row: AllianceRow }

export default function AllianceWorkspace({
  rows,
  summary,
  ventures,
}: {
  rows: AllianceRow[];
  summary: Summary;
  ventures: VendorVenture[];
}) {
  const [tab, setTab] = useState<TabId>("map");
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{ background: C.canvas, borderColor: C.line }}
    >
      {/* ── Header ── */}
      <header
        className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
        style={{ borderColor: C.line, background: "rgba(11,37,25,0.75)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${C.green}, ${C.gold})` }}
          >
            <Icon name="map" className="h-5 w-5 text-[#071410]" />
          </div>
          <div>
            <h1 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight" style={{ color: C.ink }}>
              ALLIANCES
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.dim }}>
              AI &amp; GSI strategic integration ecosystem
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Real counts only — the prototype's market/margin/cert figures were unsourceable and are not reproduced. */}
          <div className="hidden items-center gap-4 border-r pr-6 font-mono text-[11px] lg:flex" style={{ borderColor: C.line }}>
            <div>
              <span style={{ color: C.faint }}>CITED ALLIANCES: </span>
              <span className="font-bold" style={{ color: C.gold }}>{summary.spotlit + ventures.length}</span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.line }} />
            <div>
              <span style={{ color: C.faint }}>INTEGRATORS: </span>
              <span className="font-bold" style={{ color: C.greenLt }}>{summary.partners}</span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.line }} />
            <div>
              <span style={{ color: C.faint }}>CHANNEL LINKS: </span>
              <span className="font-bold" style={{ color: C.greenLt }}>{summary.links}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: C.line, background: "rgba(255,255,255,0.04)", color: C.dim }}
          >
            <Icon name="info" className="h-4 w-4" />
            How to read this
          </button>
        </div>
      </header>

      {/* ── Workspace ── */}
      <div className="flex min-h-0 flex-col xl:flex-row">
        {/* Left icon rail */}
        <aside
          className="flex flex-none items-center justify-between gap-4 border-b px-4 py-2 xl:w-20 xl:flex-col xl:border-b-0 xl:border-r xl:px-0 xl:py-6"
          style={{ borderColor: C.line, background: "rgba(7,20,16,0.6)" }}
        >
          <nav className="flex w-full items-center justify-center gap-2 xl:flex-col xl:gap-4" aria-label="Alliance views">
            {([
              ["map", "map", "Map"],
              ["directory", "table", "Directory"],
              ["compare", "compare", "Compare"],
              ["stats", "stats", "Stats"],
            ] as const).map(([id, icon, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className="flex h-14 w-14 flex-col items-center justify-center rounded-xl border transition-colors"
                  style={{
                    color: active ? C.gold : C.dim,
                    background: active ? "rgba(212,175,55,0.12)" : "transparent",
                    borderColor: active ? "rgba(212,175,55,0.35)" : "transparent",
                  }}
                >
                  <Icon name={icon} className="h-5 w-5" />
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-tight">{label}</span>
                </button>
              );
            })}
          </nav>
          <div className="hidden flex-col items-center xl:flex">
            <div className="h-10 w-0.5" style={{ background: C.line }} />
          </div>
        </aside>

        {/* Content */}
        <div className="min-h-0 flex-1">
          {tab === "map" && <MapTab rows={rows} />}
          {tab === "directory" && <DirectoryTab rows={rows} />}
          {tab === "compare" && <CompareTab rows={rows} />}
          {tab === "stats" && <StatsTab summary={summary} ventures={ventures} />}
        </div>
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} summary={summary} ventures={ventures.length} />}
    </div>
  );
}

/* ───────────────────────── TAB 1 — MAP ───────────────────────── */

function MapTab({ rows }: { rows: AllianceRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  const dragRef = useRef<GNode | null>(null);
  const hoverRef = useRef<GNode | null>(null);
  // Assigned by the canvas effect so imperative actions (stabilise) can force a
  // repaint when the rAF loop isn't running (prefers-reduced-motion).
  const repaintRef = useRef<(() => void) | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "ai" | "gsi">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [indicator, setIndicator] = useState("Hover or click a node to begin inspection");

  // mirror filter state into refs so the rAF loop always reads current values
  const filt = useRef({ query: "", category: "all" as "all" | "ai" | "gsi", tag: null as string | null, selectedId: null as string | null });
  useEffect(() => {
    filt.current = { query, category, tag, selectedId: selected?.id ?? null };
  }, [query, category, tag, selected]);

  const buildTopology = useCallback((w: number, h: number) => {
    const vendors = [...new Map(rows.map((r) => [r.vendorId, r])).values()];
    const partners = [...new Map(rows.map((r) => [r.partnerId, r])).values()];
    const nodes: GNode[] = [];

    vendors.forEach((r, i) => {
      const a = (i / vendors.length) * Math.PI * 2;
      nodes.push({
        id: `v:${r.vendorId}`, name: r.vendorName, type: "model", kind: "model",
        color: NODE_COLOR.model, radius: 24,
        x: w / 2 + Math.cos(a) * 170, y: h / 2 + Math.sin(a) * 170,
        vx: 0, vy: 0, fx: null, fy: null,
      });
    });
    partners.forEach((r, i) => {
      const a = (i / partners.length) * Math.PI * 2;
      nodes.push({
        id: `p:${r.partnerId}`, name: r.partnerName, type: "gsi", kind: r.partnerKind,
        color: NODE_COLOR[r.partnerKind] ?? C.green, radius: 17,
        x: w / 2 + Math.cos(a) * 320, y: h / 2 + Math.sin(a) * 320,
        vx: 0, vy: 0, fx: null, fy: null,
      });
    });

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: GLink[] = [];
    for (const r of rows) {
      const s = byId.get(`p:${r.partnerId}`);
      const t = byId.get(`v:${r.vendorId}`);
      if (s && t) links.push({ source: s, target: t, isElite: r.tier === "direct_named", tier: r.tier, row: r });
    }
    nodesRef.current = nodes;
    linksRef.current = links;
  }, [rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    buildTopology(W, H);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // original force constants
    const kForce = 0.04, kRepulsion = 1200, kGravity = 0.01, kDamping = 0.85;

    const matches = (n: GNode) => {
      const { query: q, category: cat, tag: tg } = filt.current;
      if (cat === "ai" && n.type !== "model") return false;
      if (cat === "gsi" && n.type !== "gsi") return false;
      if (q && !n.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (tg) {
        const hit = linksRef.current.some(
          (l) => (l.source === n || l.target === n) && l.row.industries.includes(tg),
        );
        if (!hit) return false;
      }
      return true;
    };
    const anyFilter = () => {
      const f = filt.current;
      return Boolean(f.query || f.category !== "all" || f.tag || f.selectedId);
    };
    const nodeLit = (n: GNode) => {
      const f = filt.current;
      if (f.selectedId) {
        if (n.id === f.selectedId) return true;
        return linksRef.current.some(
          (l) =>
            (l.source.id === f.selectedId && l.target === n) ||
            (l.target.id === f.selectedId && l.source === n),
        );
      }
      return matches(n);
    };

    const physics = () => {
      const nodes = nodesRef.current;
      if (dragRef.current) return;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x, dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 400) {
            const f = kRepulsion / (dist * dist);
            const fx = (dx / dist) * f, fy = (dy / dist) * f;
            n1.vx -= fx; n1.vy -= fy;
            n2.vx += fx; n2.vy += fy;
          }
        }
      }
      for (const l of linksRef.current) {
        const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desired = l.isElite ? 120 : 180;
        const f = (dist - desired) * kForce;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        l.source.vx += fx; l.source.vy += fy;
        l.target.vx -= fx; l.target.vy -= fy;
      }
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * kGravity;
        n.vy += (H / 2 - n.y) * kGravity;
        n.vx *= kDamping; n.vy *= kDamping;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.radius + 10, Math.min(W - n.radius - 10, n.x));
        n.y = Math.max(n.radius + 10, Math.min(H - n.radius - 10, n.y));
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // grid
      ctx.strokeStyle = "rgba(255,255,255,0.022)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const filtering = anyFilter();
      // links
      for (const l of linksRef.current) {
        const lit = !filtering || (nodeLit(l.source) && nodeLit(l.target));
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = l.isElite
          ? `rgba(212,175,55,${lit ? 0.5 : 0.05})`
          : l.tier === "cloud_certified"
            ? `rgba(63,157,118,${lit ? 0.38 : 0.04})`
            : `rgba(255,255,255,${lit ? 0.13 : 0.02})`;
        ctx.lineWidth = l.isElite ? 1.6 : 1;
        ctx.stroke();
      }
      // nodes
      for (const n of nodesRef.current) {
        const lit = !filtering || nodeLit(n);
        const hovered = hoverRef.current === n;
        ctx.globalAlpha = lit ? 1 : 0.16;
        if (lit) {
          ctx.shadowColor = n.color;
          ctx.shadowBlur = hovered || filt.current.selectedId === n.id ? 22 : 10;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.type === "model" ? n.color : "rgba(7,20,16,0.92)";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = n.color;
        ctx.stroke();
        // label
        ctx.globalAlpha = lit ? 1 : 0.2;
        ctx.fillStyle = n.type === "model" ? "#071410" : C.ink;
        ctx.font = n.type === "model" ? "700 10px Geist, system-ui, sans-serif" : "600 9px Geist, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = n.name.length > 11 ? `${n.name.slice(0, 10)}…` : n.name;
        if (n.type === "model") {
          ctx.fillText(label, n.x, n.y);
        } else {
          ctx.fillText(label, n.x, n.y + n.radius + 10);
        }
        ctx.globalAlpha = 1;
      }
    };

    let raf = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Under reduced motion the loop is off, so expose a settle+repaint for
    // imperative callers; otherwise the next frame paints anyway.
    repaintRef.current = reduce
      ? () => { for (let i = 0; i < 200; i++) physics(); draw(); }
      : () => {};
    if (reduce) {
      for (let i = 0; i < 260; i++) physics(); // settle instantly, then draw statically
      draw();
    } else {
      const loop = () => { physics(); draw(); raf = requestAnimationFrame(loop); };
      loop();
    }

    // ── pointer interaction ──
    const at = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pick = (x: number, y: number) =>
      nodesRef.current.find((n) => Math.hypot(n.x - x, n.y - y) <= n.radius + 4) ?? null;

    const onDown = (e: PointerEvent) => {
      const { x, y } = at(e);
      const n = pick(x, y);
      if (n) {
        dragRef.current = n;
        canvas.setPointerCapture(e.pointerId);
        setSelected(n);
        setIndicator(`${n.name} — locked`);
      } else {
        setSelected(null);
        setIndicator("Hover or click a node to begin inspection");
      }
    };
    const onMove = (e: PointerEvent) => {
      const { x, y } = at(e);
      if (dragRef.current) {
        dragRef.current.x = x; dragRef.current.y = y;
        dragRef.current.vx = 0; dragRef.current.vy = 0;
        if (reduce) draw();
        return;
      }
      const n = pick(x, y);
      if (n !== hoverRef.current) {
        hoverRef.current = n;
        canvas.style.cursor = n ? "pointer" : "grab";
        if (n) setIndicator(`${n.name} · ${n.type === "model" ? "AI vendor" : KIND_LABEL[n.kind as keyof typeof KIND_LABEL] ?? "Integrator"}`);
        else if (!filt.current.selectedId) setIndicator("Hover or click a node to begin inspection");
        if (reduce) draw();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current) { canvas.releasePointerCapture(e.pointerId); dragRef.current = null; }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);

    return () => {
      cancelAnimationFrame(raf);
      repaintRef.current = null;
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [buildTopology]);

  const stabilize = () => {
    const nodes = nodesRef.current;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width: w, height: h } = wrap.getBoundingClientRect();
    const vendors = nodes.filter((n) => n.type === "model");
    const partners = nodes.filter((n) => n.type === "gsi");
    vendors.forEach((n, i) => {
      const a = (i / vendors.length) * Math.PI * 2;
      n.x = w / 2 + Math.cos(a) * 170; n.y = h / 2 + Math.sin(a) * 170; n.vx = 0; n.vy = 0;
    });
    partners.forEach((n, i) => {
      const a = (i / partners.length) * Math.PI * 2;
      n.x = w / 2 + Math.cos(a) * 320; n.y = h / 2 + Math.sin(a) * 320; n.vx = 0; n.vy = 0;
    });
    repaintRef.current?.();
  };

  const detail = useMemo(() => {
    if (!selected) return null;
    if (selected.type === "model") {
      const vid = selected.id.slice(2);
      return { kind: "model" as const, node: selected, items: rows.filter((r) => r.vendorId === vid) };
    }
    const pid = selected.id.slice(2);
    return { kind: "gsi" as const, node: selected, items: rows.filter((r) => r.partnerId === pid) };
  }, [selected, rows]);

  const panel = { background: C.panel, borderColor: C.line };

  return (
    <div className="flex flex-col gap-4 p-4 xl:flex-row xl:p-6">
      {/* Control panel */}
      <div className="flex w-full flex-none flex-col gap-4 xl:w-80">
        <div className="rounded-xl border p-4 backdrop-blur" style={panel}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: C.dim }}>
            <Icon name="sliders" className="h-4 w-4" /> Map controls &amp; filters
          </h2>
          <p className="mb-4 text-xs" style={{ color: C.faint }}>
            Drag nodes to explore the topology. Click any vendor or integrator to lock its connections and open the alliance dossier.
          </p>

          <div className="relative mb-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search AI vendor or integrator…"
              aria-label="Search the map"
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2"
              style={{ background: C.field, borderColor: C.line, color: C.ink }}
            />
            <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.dim }}>
              Category highlight
            </label>
            <div className="flex flex-col gap-1.5">
              {([["all", "Show all nodes"], ["ai", "AI vendors only"], ["gsi", "Integrators only"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCategory(k)}
                  aria-pressed={category === k}
                  className="w-full rounded-md border px-3 py-1.5 text-left text-xs font-medium transition-colors"
                  style={{
                    background: category === k ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                    borderColor: category === k ? "rgba(212,175,55,0.3)" : "transparent",
                    color: category === k ? C.gold : C.dim,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: C.dim }}>
              Industry focus
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? null : t)}
                  aria-pressed={tag === t}
                  className="rounded border px-2 py-1 text-center text-[10px] transition-colors"
                  style={{
                    background: tag === t ? "rgba(63,157,118,0.18)" : "rgba(255,255,255,0.03)",
                    borderColor: tag === t ? "rgba(63,157,118,0.4)" : C.line,
                    color: tag === t ? C.greenLt : C.dim,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Topology legend */}
        <div className="rounded-xl border p-4 text-xs backdrop-blur" style={panel}>
          <h3 className="mb-2 font-bold uppercase tracking-wide" style={{ color: C.ink }}>Topology legend</h3>
          <div className="space-y-2" style={{ color: C.dim }}>
            {[
              [NODE_COLOR.model, "AI vendors (the stars)"],
              [NODE_COLOR.strategy_consultancy, "Strategy consultancies"],
              [NODE_COLOR.global_si, "Global systems integrators"],
              [NODE_COLOR.platform_hybrid, "Platform hybrids (own a rival platform)"],
            ].map(([col, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="block h-3 w-3 rounded-full" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
                <span>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="block h-0.5 w-3.5" style={{ background: C.gold }} />
              <span>Direct named alliance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="block h-0.5 w-3.5" style={{ background: C.green, opacity: 0.5 }} />
              <span>Cloud-certified / observed link</span>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative min-h-[440px] flex-1 overflow-hidden rounded-2xl border xl:min-h-[600px]"
        style={{ background: "#04100b", borderColor: C.line }}
      >
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <span
            className="flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] backdrop-blur"
            style={{ background: "rgba(7,20,16,0.8)", borderColor: C.line, color: C.dim }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.gold }} />
            INTERACTIVE CANVAS
          </span>
          <button
            type="button"
            onClick={stabilize}
            className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] backdrop-blur transition-colors hover:bg-white/[0.06]"
            style={{ background: "rgba(7,20,16,0.8)", borderColor: C.line, color: C.dim }}
          >
            <Icon name="refresh" className="h-3 w-3" /> Stabilise graph
          </button>
        </div>
        <div className="absolute right-4 top-4 z-10">
          <span
            className="rounded border px-2.5 py-1 font-mono text-[10px] backdrop-blur"
            style={{ background: "rgba(7,20,16,0.8)", borderColor: C.line, color: C.ink }}
          >
            {indicator}
          </span>
        </div>

        <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" role="img" aria-label={`Force-directed map of ${rows.length} delivery relationships. The same data is listed in the Directory tab.`} />

        {/* Dossier drawer */}
        {detail && (
          <div
            className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-y-auto border-t p-5 backdrop-blur-md"
            style={{ background: "rgba(7,20,16,0.96)", borderColor: C.line }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: C.line }}>
              <div className="flex items-center gap-3">
                <span className="h-8 w-2 rounded" style={{ background: detail.node.color }} />
                <div>
                  <h3 className="text-lg font-bold" style={{ color: C.ink }}>{detail.node.name}</h3>
                  <p className="text-xs uppercase tracking-wider" style={{ color: C.dim }}>
                    {detail.kind === "model"
                      ? "AI vendor · integrator coverage"
                      : `${KIND_LABEL[detail.node.kind as keyof typeof KIND_LABEL] ?? "Integrator"} · alliance targets`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close dossier" className="p-1" style={{ color: C.dim }}>
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {detail.items.map((r) => (
                <div key={r.key} className="space-y-2 rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: C.line }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: detail.kind === "model" ? C.ink : C.gold }}>
                      {detail.kind === "model" ? r.partnerName : r.vendorName}
                    </span>
                    <span className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: C.canvas, borderColor: C.line, color: C.dim }}>
                      {r.tier.replace(/_/g, " ")}
                    </span>
                  </div>
                  {r.spotlight ? (
                    <>
                      <p className="text-[11px] leading-snug" style={{ color: C.dim }}>
                        <strong style={{ color: C.ink }}>Cited:</strong> {r.spotlight.summary}
                      </p>
                      <a href={r.spotlight.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] underline underline-offset-2" style={{ color: C.greenLt }}>
                        {r.spotlight.publisher} ↗
                      </a>
                    </>
                  ) : (
                    <p className="text-[11px] leading-snug" style={{ color: C.dim }}>
                      <strong style={{ color: C.ink }}>Focus:</strong> {r.areas.slice(0, 3).join(" · ") || "—"}
                      <span className="ml-1 opacity-70">(analyst-curated, {r.evidence.replace(/_/g, " ")} evidence)</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {r.industries.slice(0, 3).map((v) => (
                      <span key={v} className="rounded border px-1.5 py-0.5 text-[8px]" style={{ background: C.canvas, borderColor: "rgba(63,157,118,0.3)", color: C.greenLt }}>
                        {v}
                      </span>
                    ))}
                  </div>
                  {r.encroachment && (
                    <div className="flex items-center gap-1 rounded border p-1.5 text-[10px]" style={{ background: "rgba(176,141,47,0.1)", borderColor: "rgba(176,141,47,0.3)", color: C.gold }}>
                      <Icon name="chip" className="h-3 w-3" /> Derived signal: delivers a rival to its own platform
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── TAB 2 — DIRECTORY ───────────────────────── */

function DirectoryTab({ rows }: { rows: AllianceRow[] }) {
  const [q, setQ] = useState("");
  const [vendor, setVendor] = useState("");
  const [region, setRegion] = useState("");

  const vendors = useMemo(
    () => [...new Map(rows.map((r) => [r.vendorId, r.vendorName])).entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [rows],
  );
  const regions = useMemo(
    () => [...new Set(rows.flatMap((r) => r.regions))].sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (vendor && r.vendorId !== vendor) return false;
    if (region && !r.regions.includes(region)) return false;
    if (q) {
      const hay = `${r.partnerName} ${r.vendorName} ${r.industries.join(" ")} ${r.areas.join(" ")}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const field = { background: C.field, borderColor: C.line, color: C.ink };

  return (
    <div className="space-y-6 p-4 xl:p-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-[var(--font-display)] text-2xl font-bold" style={{ color: C.ink }}>Ecosystem alliance registry</h2>
          <p className="text-sm" style={{ color: C.dim }}>
            Model allocations, alliance depth, industry footprints and delivery focus across the curated channel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter table…"
              aria-label="Filter the registry"
              className="w-64 rounded-lg border py-2 pl-9 pr-3 text-xs focus:outline-none"
              style={field}
            />
            <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5" />
          </div>
          <select value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Filter by AI vendor" className="rounded-lg border px-3 py-2 text-xs" style={field}>
            <option value="">All vendors</option>
            {vendors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region" className="rounded-lg border px-3 py-2 text-xs" style={field}>
            <option value="">All regions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ background: C.panel, borderColor: C.line }}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b text-xs font-bold uppercase tracking-wider" style={{ borderColor: C.line, background: "rgba(255,255,255,0.03)", color: C.dim }}>
                <th className="px-6 py-4">IT service partner</th>
                <th className="px-6 py-4">AI vendor</th>
                <th className="px-6 py-4">Alliance tier</th>
                <th className="px-6 py-4">Industry verticals</th>
                <th className="px-6 py-4">Primary geographies</th>
                <th className="px-6 py-4">Signature initiative / focus</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map((r) => (
                <tr key={r.key} className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <td className="px-6 py-3">
                    <div className="font-semibold" style={{ color: C.ink }}>{r.partnerName}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: C.faint }}>{KIND_LABEL[r.partnerKind]}</div>
                  </td>
                  <td className="px-6 py-3 font-medium" style={{ color: C.gold }}>{r.vendorName}</td>
                  <td className="px-6 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{
                      background: r.tier === "direct_named" ? "rgba(212,175,55,0.16)" : r.tier === "cloud_certified" ? "rgba(63,157,118,0.16)" : "rgba(255,255,255,0.06)",
                      color: r.tier === "direct_named" ? C.gold : r.tier === "cloud_certified" ? C.greenLt : C.dim,
                    }}>
                      {TIER_LABEL[r.tier]}
                    </span>
                    {r.encroachment && <div className="mt-1 text-[10px]" style={{ color: C.goldDim }}>▲ encroachment signal</div>}
                  </td>
                  <td className="px-6 py-3 text-xs" style={{ color: C.dim }}>{r.industries.join(", ") || "—"}</td>
                  <td className="px-6 py-3 text-xs" style={{ color: C.dim }}>{r.regions.join(", ") || "—"}</td>
                  <td className="px-6 py-3 text-xs" style={{ color: C.dim }}>
                    {r.spotlight ? (
                      <>
                        <span style={{ color: C.ink }}>{r.spotlight.summary}</span>{" "}
                        <a href={r.spotlight.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: C.greenLt }}>
                          {r.spotlight.publisher} ↗
                        </a>
                      </>
                    ) : (
                      <>
                        {r.areas.slice(0, 3).join(" · ") || "—"}
                        <span className="ml-1 opacity-60">· analyst-curated</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm" style={{ color: C.dim }}>No alliances match that filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs" style={{ color: C.faint }}>
        Showing {filtered.length} of {rows.length} curated relationships. Rows with a publisher link are source-cited; the rest are analyst-curated channel breadth.
      </p>
    </div>
  );
}

/* ───────────────────────── TAB 3 — COMPARE ───────────────────────── */

function CompareTab({ rows }: { rows: AllianceRow[] }) {
  const partners = useMemo(
    () => [...new Map(rows.map((r) => [r.partnerId, { id: r.partnerId, name: r.partnerName, kind: r.partnerKind }])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const [a, setA] = useState(partners[0]?.id ?? "");
  const [b, setB] = useState(partners[1]?.id ?? "");

  const byPartner = useMemo(() => {
    const m = new Map<string, AllianceRow[]>();
    for (const r of rows) {
      const arr = m.get(r.partnerId);
      if (arr) arr.push(r);
      else m.set(r.partnerId, [r]);
    }
    return m;
  }, [rows]);
  const rowsOf = (pid: string) => byPartner.get(pid) ?? [];
  const shared = useMemo(() => {
    const va = new Set((byPartner.get(a) ?? []).map((r) => r.vendorId));
    return (byPartner.get(b) ?? []).filter((r) => va.has(r.vendorId));
  }, [a, b, byPartner]);

  const nameOf = (id: string) => partners.find((p) => p.id === id)?.name ?? id;
  const field = { background: C.field, borderColor: C.line, color: C.ink };

  return (
    <div className="space-y-6 p-4 xl:p-6">
      <div>
        <h2 className="font-[var(--font-display)] text-2xl font-bold" style={{ color: C.ink }}>Strategic comparator</h2>
        <p className="text-sm" style={{ color: C.dim }}>Head-to-head view of two integrators&apos; AI delivery coverage.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-xl border p-4 md:grid-cols-2" style={{ background: "rgba(255,255,255,0.02)", borderColor: C.line }}>
        {[{ v: a, set: setA, label: "Select partner A" }, { v: b, set: setB, label: "Select partner B" }].map((s) => (
          <div key={s.label} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: C.dim }}>{s.label}</label>
            <select value={s.v} onChange={(e) => s.set(e.target.value)} className="w-full rounded-lg border p-2.5 text-sm" style={field}>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name} — {KIND_LABEL[p.kind]}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[a, b].map((pid, i) => {
          const list = rowsOf(pid);
          const cited = list.filter((r) => r.spotlight);
          return (
            <div key={`${pid}-${i}`} className="space-y-4 rounded-2xl border p-6 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
              <div>
                <h3 className="font-[var(--font-display)] text-xl font-extrabold" style={{ color: C.ink }}>{nameOf(pid)}</h3>
                <p className="text-xs uppercase tracking-wider" style={{ color: C.dim }}>
                  {KIND_LABEL[partners.find((p) => p.id === pid)?.kind ?? "global_si"]}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  [list.length, "vendors"],
                  [list.filter((r) => r.tier === "direct_named").length, "direct"],
                  [cited.length, "cited"],
                ].map(([n, l]) => (
                  <div key={l as string} className="rounded-lg border p-2" style={{ background: "rgba(255,255,255,0.03)", borderColor: C.line }}>
                    <div className="font-[var(--font-display)] text-lg font-bold tabular-nums" style={{ color: C.gold }}>{n as number}</div>
                    <div className="text-[10px] uppercase" style={{ color: C.faint }}>{l as string}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {list.map((r) => (
                  <div key={r.key} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2" style={{ background: "rgba(255,255,255,0.02)", borderColor: C.line }}>
                    <div>
                      <span className="text-sm font-semibold" style={{ color: C.ink }}>{r.vendorName}</span>
                      <div className="text-[11px]" style={{ color: C.dim }}>{r.spotlight ? r.spotlight.relationship : r.areas.slice(0, 2).join(" · ") || "—"}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{
                      background: r.tier === "direct_named" ? "rgba(212,175,55,0.16)" : "rgba(63,157,118,0.14)",
                      color: r.tier === "direct_named" ? C.gold : C.greenLt,
                    }}>
                      {TIER_LABEL[r.tier]}
                    </span>
                  </div>
                ))}
                {list.length === 0 && <p className="text-sm" style={{ color: C.dim }}>No curated AI relationships.</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 rounded-2xl border p-6 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: C.dim }}>
          <Icon name="scale" className="h-4 w-4" /> Delivery framework comparison
        </h3>
        <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
          {[
            ["Shared vendors", shared.length > 0 ? shared.map((r) => r.vendorName).join(", ") : "No overlap in the curated channel"],
            ["Where they overlap", shared.length > 0 ? "Dual-sourcing or bake-off territory" : "Distinct AI coverage"],
            ["Encroachment exposure", [...rowsOf(a), ...rowsOf(b)].some((r) => r.encroachment) ? "One side owns a rival platform" : "Neither is a platform hybrid"],
          ].map(([label, val]) => (
            <div key={label} className="rounded-xl border p-4" style={{ background: "rgba(255,255,255,0.03)", borderColor: C.line }}>
              <span className="block text-xs uppercase" style={{ color: C.faint }}>{label}</span>
              <span className="text-base font-bold" style={{ color: C.ink }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── TAB 4 — STATS ───────────────────────── */

function StatsTab({ summary, ventures }: { summary: Summary; ventures: VendorVenture[] }) {
  const maxCov = Math.max(...summary.vendorCoverage.map((v) => v.count), 1);
  const tiers = [
    { key: "direct_named", label: "Direct named", color: C.gold },
    { key: "cloud_certified", label: "Cloud-certified", color: C.green },
    { key: "observed_implementer", label: "Observed", color: C.greenDk },
  ];
  const total = tiers.reduce((s, t) => s + (summary.byTier[t.key] ?? 0), 0) || 1;
  let acc = 0;
  const R = 52, CIRC = 2 * Math.PI * R;
  const widest = summary.vendorCoverage[0];
  const narrowest = summary.vendorCoverage[summary.vendorCoverage.length - 1];

  return (
    <div className="space-y-6 p-4 xl:p-6">
      <div>
        <h2 className="font-[var(--font-display)] text-2xl font-bold" style={{ color: C.ink }}>Ecosystem metrics</h2>
        <p className="text-sm" style={{ color: C.dim }}>
          Counts measured directly off the alliance dataset on this page — not market estimates.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [summary.spotlit + ventures.length, "Source-cited alliances", C.gold],
          [summary.partners, "Integrators tracked", C.greenLt],
          [summary.vendors, "AI vendors covered", C.greenLt],
          [summary.links, "Curated channel links", C.greenLt],
        ].map(([n, label, col]) => (
          <div key={label as string} className="rounded-xl border p-4 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
            <div className="font-[var(--font-display)] text-3xl font-extrabold tabular-nums" style={{ color: col as string }}>{n as number}</div>
            <div className="mt-1 text-xs" style={{ color: C.dim }}>{label as string}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Coverage bars */}
        <div className="rounded-2xl border p-5 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
          <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.ink }}>
            <Icon name="link" className="h-4 w-4" /> Integrator coverage by AI vendor
          </h3>
          <p className="mb-4 text-[11px]" style={{ color: C.faint }}>How many of the tracked integrators deliver each vendor.</p>
          <div className="space-y-2.5">
            {summary.vendorCoverage.map((v) => (
              <div key={v.vendorId} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-right text-xs" style={{ color: C.dim }}>{v.vendorName}</span>
                <div className="h-4 flex-1 overflow-hidden rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="h-full rounded" style={{ width: `${(v.count / maxCov) * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.gold})` }} />
                </div>
                <span className="w-6 text-right font-mono text-xs tabular-nums" style={{ color: C.ink }}>{v.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Depth donut */}
        <div className="rounded-2xl border p-5 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
          <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.ink }}>
            <Icon name="stats" className="h-4 w-4" /> Partnership depth mix
          </h3>
          <p className="mb-4 text-[11px]" style={{ color: C.faint }}>Distribution of the {summary.links} curated links by alliance tier.</p>
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label="Partnership depth distribution">
              {tiers.map((t) => {
                const n = summary.byTier[t.key] ?? 0;
                const frac = n / total;
                const dash = `${frac * CIRC} ${CIRC}`;
                const offset = -acc * CIRC;
                acc += frac;
                return (
                  <circle
                    key={t.key}
                    cx="70" cy="70" r={R} fill="none"
                    stroke={t.color} strokeWidth="18"
                    strokeDasharray={dash} strokeDashoffset={offset}
                    transform="rotate(-90 70 70)"
                  />
                );
              })}
              <text x="70" y="66" textAnchor="middle" style={{ fill: C.ink, fontSize: 22, fontWeight: 800 }}>{summary.links}</text>
              <text x="70" y="82" textAnchor="middle" style={{ fill: C.faint, fontSize: 9 }}>LINKS</text>
            </svg>
            <div className="space-y-2">
              {tiers.map((t) => (
                <div key={t.key} className="flex items-center gap-2 text-xs">
                  <span className="h-3 w-3 rounded-sm" style={{ background: t.color }} />
                  <span style={{ color: C.dim }}>{t.label}</span>
                  <span className="font-mono tabular-nums" style={{ color: C.ink }}>{summary.byTier[t.key] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Narrative — observations true of this dataset, no market claims */}
      <div className="rounded-2xl border p-6 backdrop-blur" style={{ background: C.panel, borderColor: C.line }}>
        <h3 className="mb-3 text-lg font-bold" style={{ color: C.ink }}>What the channel shows</h3>
        <ul className="space-y-2 text-sm" style={{ color: C.dim }}>
          <li>
            <strong style={{ color: C.ink }}>{widest?.vendorName}</strong> has the widest integrator coverage
            ({widest?.count} of {summary.partners} tracked houses), and{" "}
            <strong style={{ color: C.ink }}>{narrowest?.vendorName}</strong> the narrowest ({narrowest?.count}).
          </li>
          <li>
            <strong style={{ color: C.ink }}>xAI has no evidenced GSI channel at all</strong> — it is absent from this map by design, not by
            oversight. Absence of evidence is reported as absence, never as a low score.
          </li>
          <li>
            {summary.encroaching > 0 ? (
              <>
                <strong style={{ color: C.ink }}>{summary.encroaching} links carry an encroachment signal</strong> — a platform-hybrid
                integrator delivering a rival&apos;s model, and so structurally positioned to migrate that client onto its own platform. Derived
                signal, not a stated claim.
              </>
            ) : (
              <>No encroachment signals in the current channel.</>
            )}
          </li>
          <li>
            <strong style={{ color: C.ink }}>{summary.spotlit + ventures.length} relationships are source-cited</strong>; the remaining{" "}
            {summary.links - summary.spotlit} are analyst-curated breadth — directional, confidence-tiered, and never presented as audited fact.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────── INFO MODAL ───────────────────────── */

function InfoModal({ onClose, summary, ventures }: { onClose: () => void; summary: Summary; ventures: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="presentation">
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6"
        style={{ background: C.solid, borderColor: C.line }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How to read this"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold" style={{ color: C.ink }}>How to read this</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: C.dim }}><Icon name="close" className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 text-sm" style={{ color: C.dim }}>
          <p>
            <strong style={{ color: C.gold }}>Source-cited</strong> — {summary.spotlit + ventures} alliances trace to a named press or vendor
            source, fact-checked against live reporting. Figures that couldn&apos;t be sourced were dropped, not softened.
          </p>
          <p>
            <strong style={{ color: C.greenLt }}>Analyst-curated</strong> — the {summary.links} channel links (which integrator delivers which
            vendor, to what depth) are curated breadth: directional reference, confidence-tiered, never audited fact.
          </p>
          <p>
            <strong style={{ color: C.ink }}>Encroachment</strong> is a <em>derived</em> signal: a platform-hybrid integrator that owns its own
            AI platform yet delivers a rival&apos;s model. We show it where both conditions hold — never as a measured claim.
          </p>
          <p>Nothing on this page feeds a vendor score. The delivery layer is firewalled from the rankings.</p>
        </div>
      </div>
    </div>
  );
}
