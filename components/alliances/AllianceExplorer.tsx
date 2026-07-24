"use client";

// Directory + comparator over the curated GSI×AI delivery channel (seed data).
// ───────────────────────────────────────────────────────────────────────────
// Companion to the server-rendered spotlights + DeliveryMatrix on /alliances.
// Pure client-side filtering of props the server already computed from
// buildDeliveryGraph() — no fetch, no new data. A ★ marks a relationship that
// also has a source-cited spotlight. Green intensity encodes partnership extent
// (no red↔green); nothing here feeds a vendor score.

import { useMemo, useState } from "react";

export interface ExplorerEdge {
  partnerId: string;
  partnerName: string;
  kind: string;
  vendorId: string;
  vendorName: string;
  tier: "direct_named" | "cloud_certified" | "observed_implementer";
  evidence: "strong" | "moderate" | "plausible_unverified";
  encroachment: boolean;
  spotlit: boolean;
}

export interface ExplorerParty {
  id: string;
  name: string;
  kind: string;
}

const TIER_STYLE: Record<ExplorerEdge["tier"], { label: string; bg: string; ink: string }> = {
  direct_named: { label: "Direct named", bg: "#123d2c", ink: "#f6f3ea" },
  cloud_certified: { label: "Cloud-certified", bg: "#3f9d76", ink: "#08150f" },
  observed_implementer: { label: "Observed", bg: "rgba(63,157,118,0.32)", ink: "#123d2c" },
};

const KIND_LABEL: Record<string, string> = {
  global_si: "Global SI",
  platform_hybrid: "Platform hybrid",
  strategy_consultancy: "Strategy consultancy",
  regional_si: "Regional SI",
};

function TierChip({ edge }: { edge: ExplorerEdge }) {
  const t = TIER_STYLE[edge.tier];
  const faint = edge.evidence === "plausible_unverified";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: t.bg, color: t.ink, opacity: faint ? 0.72 : 1 }}
      title={`${edge.partnerName} → ${edge.vendorName} · ${t.label} · ${edge.evidence.replace(/_/g, " ")} evidence${
        edge.encroachment ? " · encroachment" : ""
      }`}
    >
      {edge.vendorName}
      {edge.spotlit && <span aria-hidden className="text-[#b08d2f]">★</span>}
      {edge.encroachment && <span aria-hidden className="text-[#b08d2f]">▲</span>}
    </span>
  );
}

export default function AllianceExplorer({
  edges,
  partners,
  vendors,
}: {
  edges: ExplorerEdge[];
  partners: ExplorerParty[];
  vendors: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"directory" | "compare">("directory");

  // ── Directory state ──
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return edges.filter((e) => {
      if (vendorFilter && e.vendorId !== vendorFilter) return false;
      if (!q) return true;
      return e.partnerName.toLowerCase().includes(q) || e.vendorName.toLowerCase().includes(q);
    });
  }, [edges, query, vendorFilter]);

  // Group filtered relationships under their partner, preserving the incoming
  // (kind-then-coverage) partner order.
  const grouped = useMemo(() => {
    const byPartner = new Map<string, ExplorerEdge[]>();
    for (const e of filtered) {
      const arr = byPartner.get(e.partnerId) ?? [];
      arr.push(e);
      byPartner.set(e.partnerId, arr);
    }
    return partners
      .filter((p) => byPartner.has(p.id))
      .map((p) => ({ partner: p, rels: byPartner.get(p.id)! }));
  }, [filtered, partners]);

  // ── Compare state ──
  const [a, setA] = useState(partners[0]?.id ?? "");
  const [b, setB] = useState(partners[1]?.id ?? "");
  const compare = useMemo(() => {
    const rel = (pid: string) => new Map(edges.filter((e) => e.partnerId === pid).map((e) => [e.vendorId, e]));
    const ma = rel(a);
    const mb = rel(b);
    const rows = vendors
      .map((v) => ({ vendor: v, a: ma.get(v.id) ?? null, b: mb.get(v.id) ?? null }))
      .filter((r) => r.a || r.b);
    const shared = rows.filter((r) => r.a && r.b).length;
    return { rows, shared };
  }, [a, b, edges, vendors]);

  const nameOf = (id: string) => partners.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      {/* segmented control */}
      <div
        role="tablist"
        aria-label="Alliance explorer views"
        className="mb-4 inline-flex rounded-full border border-[#123d2c]/15 bg-[#123d2c]/[0.03] p-0.5 text-sm dark:border-white/15 dark:bg-white/[0.04]"
      >
        {(["directory", "compare"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 font-medium capitalize transition-colors ${
              view === v
                ? "bg-[#123d2c] text-white dark:bg-[#3f9d76] dark:text-[#08150f]"
                : "text-[#123d2c]/70 hover:text-[#123d2c] dark:text-[#eef3ee]/70 dark:hover:text-[#eef3ee]"
            }`}
          >
            {v === "directory" ? "Directory" : "Compare two"}
          </button>
        ))}
      </div>

      {view === "directory" ? (
        <div>
          {/* controls */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="alliance-search">
              Search integrators or vendors
            </label>
            <input
              id="alliance-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search integrator or vendor…"
              className="w-full max-w-xs rounded-lg border border-[#123d2c]/20 bg-white/70 px-3 py-1.5 text-sm text-[#123d2c] placeholder:text-[#123d2c]/45 focus:border-[#3f9d76] focus:outline-none focus:ring-2 focus:ring-[#3f9d76]/30 dark:border-white/20 dark:bg-white/5 dark:text-[#eef3ee] dark:placeholder:text-[#eef3ee]/40"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setVendorFilter(null)}
                aria-pressed={vendorFilter === null}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  vendorFilter === null
                    ? "border-[#123d2c] bg-[#123d2c] text-white dark:border-[#3f9d76] dark:bg-[#3f9d76] dark:text-[#08150f]"
                    : "border-[#123d2c]/20 text-[#123d2c]/70 hover:border-[#3f9d76] dark:border-white/20 dark:text-[#eef3ee]/70"
                }`}
              >
                All vendors
              </button>
              {vendors.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVendorFilter(vendorFilter === v.id ? null : v.id)}
                  aria-pressed={vendorFilter === v.id}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    vendorFilter === v.id
                      ? "border-[#123d2c] bg-[#123d2c] text-white dark:border-[#3f9d76] dark:bg-[#3f9d76] dark:text-[#08150f]"
                      : "border-[#123d2c]/20 text-[#123d2c]/70 hover:border-[#3f9d76] dark:border-white/20 dark:text-[#eef3ee]/70"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#123d2c]/60 dark:text-[#eef3ee]/60">
              No integrators match that filter.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {grouped.map(({ partner, rels }) => (
                <li
                  key={partner.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#123d2c]/10 bg-white/50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3ee]">{partner.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-[#123d2c]/45 dark:text-[#eef3ee]/45">
                      {KIND_LABEL[partner.kind] ?? partner.kind}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rels
                      .slice()
                      .sort((x, y) => y.tier.localeCompare(x.tier))
                      .map((e) => (
                        <TierChip key={e.vendorId} edge={e} />
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { val: a, set: setA, label: "Integrator A" },
              { val: b, set: setB, label: "Integrator B" },
            ].map((sel) => (
              <div key={sel.label}>
                <label className="mb-1 block text-xs font-medium text-[#123d2c]/60 dark:text-[#eef3ee]/60">
                  {sel.label}
                </label>
                <select
                  value={sel.val}
                  onChange={(e) => sel.set(e.target.value)}
                  className="w-full rounded-lg border border-[#123d2c]/20 bg-white/70 px-3 py-1.5 text-sm font-medium text-[#123d2c] focus:border-[#3f9d76] focus:outline-none focus:ring-2 focus:ring-[#3f9d76]/30 dark:border-white/20 dark:bg-[#0d271c] dark:text-[#eef3ee]"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {KIND_LABEL[p.kind] ?? p.kind}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <p className="mb-3 text-xs text-[#123d2c]/60 dark:text-[#eef3ee]/60">
            {compare.shared > 0 ? (
              <>
                <span className="font-semibold text-[#123d2c] dark:text-[#eef3ee]">{compare.shared}</span> AI vendor
                {compare.shared === 1 ? "" : "s"} delivered by both {nameOf(a)} and {nameOf(b)} — overlap is where a
                dual-sourcing or bake-off conversation lives.
              </>
            ) : (
              <>No AI vendor is delivered by both {nameOf(a)} and {nameOf(b)} in the curated channel.</>
            )}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#123d2c]/15 text-left text-xs uppercase tracking-wide text-[#123d2c]/55 dark:border-white/15 dark:text-[#eef3ee]/55">
                  <th className="py-2 pr-3 font-semibold">AI vendor</th>
                  <th className="py-2 pr-3 font-semibold">{nameOf(a)}</th>
                  <th className="py-2 font-semibold">{nameOf(b)}</th>
                </tr>
              </thead>
              <tbody>
                {compare.rows.map((r) => (
                  <tr
                    key={r.vendor.id}
                    className={`border-b border-[#123d2c]/8 dark:border-white/8 ${
                      r.a && r.b ? "bg-[#3f9d76]/[0.08]" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-3 font-medium text-[#123d2c] dark:text-[#eef3ee]">{r.vendor.name}</td>
                    <td className="py-1.5 pr-3">{r.a ? <TierChip edge={r.a} /> : <Dash />}</td>
                    <td className="py-1.5">{r.b ? <TierChip edge={r.b} /> : <Dash />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#123d2c]/60 dark:text-[#eef3ee]/60">
        <span className="inline-flex items-center gap-1">
          <span className="text-[#b08d2f]">★</span> source-cited spotlight below
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-[#b08d2f]">▲</span> encroachment (hybrid delivers a rival)
        </span>
        <span>fainter chip = plausible / unverified evidence</span>
      </p>
    </div>
  );
}

function Dash() {
  return <span className="text-[#123d2c]/30 dark:text-[#eef3ee]/25">—</span>;
}
