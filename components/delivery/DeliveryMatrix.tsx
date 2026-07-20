import Link from "next/link";
import type { DeliveryGraphEdge } from "@/lib/graph/delivery-projection";
import { DELIVERY_PARTNERS } from "@/lib/delivery/seed";

// partnerId → organizational kind (global SI / consultancy / hybrid). The edge's
// own `kind` is the relationship type ("delivery_partnership"), not this.
const PARTNER_KIND = new Map(DELIVERY_PARTNERS.map((p) => [p.id, p.kind as string]));

// GSI × AI-vendor delivery matrix — "which SIs deliver which vendors, to what depth".
// ─────────────────────────────────────────────────────────────────────────────
// Curated analyst data (the delivery-partnership layer — firewalled from scores).
// Cell = the partnership EXTENT (partnershipTier); ▲ marks an encroachment edge (a
// platform-hybrid SI delivering a RIVAL vendor — migration risk). Full detail
// (evidence tier + rationale + source) on hover. No red↔green — a single green
// intensity ramp encodes depth. Every edge traces to the seed source; nothing here
// feeds a vendor score.

const TIER: Record<string, { label: string; fill: string; ink: string; rank: number }> = {
  direct_named: { label: "Direct named partner", fill: "#123d2c", ink: "#f6f3ea", rank: 3 },
  cloud_certified: { label: "Cloud-certified", fill: "#3f9d76", ink: "#08150f", rank: 2 },
  observed_implementer: { label: "Observed implementer", fill: "rgba(63,157,118,0.32)", ink: "#123d2c", rank: 1 },
};

const KIND_ORDER = ["global_si", "platform_hybrid", "strategy_consultancy", "regional_si"] as const;
const KIND_LABEL: Record<string, string> = {
  global_si: "Global SIs",
  platform_hybrid: "Platform hybrids",
  strategy_consultancy: "Strategy consultancies",
  regional_si: "Regional SIs",
};

export default function DeliveryMatrix({
  edges,
  vendorNames,
}: {
  edges: DeliveryGraphEdge[];
  vendorNames: Record<string, string>;
}) {
  if (edges.length === 0) return null;

  // Vendors as columns — ordered by breadth of SI coverage (most-covered first).
  const vendorPartners = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!vendorPartners.has(e.vendorId)) vendorPartners.set(e.vendorId, new Set());
    vendorPartners.get(e.vendorId)!.add(e.partnerId);
  }
  const vendors = [...vendorPartners.entries()].sort((a, b) => b[1].size - a[1].size).map(([v]) => v);

  // Partners as rows — grouped by kind, then by depth-weighted coverage.
  const partnerMeta = new Map<string, { name: string; kind: string; score: number }>();
  for (const e of edges) {
    const m = partnerMeta.get(e.partnerId) ?? { name: e.partnerName, kind: PARTNER_KIND.get(e.partnerId) ?? "global_si", score: 0 };
    m.score += TIER[e.partnershipTier]?.rank ?? 1;
    partnerMeta.set(e.partnerId, m);
  }
  const partners = [...partnerMeta.entries()].sort((a, b) => {
    const ka = KIND_ORDER.indexOf(a[1].kind as (typeof KIND_ORDER)[number]);
    const kb = KIND_ORDER.indexOf(b[1].kind as (typeof KIND_ORDER)[number]);
    if (ka !== kb) return ka - kb;
    return b[1].score - a[1].score;
  });

  const cell = new Map<string, DeliveryGraphEdge>();
  for (const e of edges) cell.set(`${e.partnerId}|${e.vendorId}`, e);

  const cols = `minmax(140px,1.4fr) repeat(${vendors.length}, minmax(2.1rem,1fr))`;
  let lastKind = "";

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* header */}
        <div className="grid items-end gap-px" style={{ gridTemplateColumns: cols }}>
          <div className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-[#123d2c]/55 dark:text-[#eef3ee]/55">
            {partners.length} integrators · {vendors.length} vendors
          </div>
          {vendors.map((v) => (
            <Link
              key={v}
              href={`/vendors/${v}`}
              className="truncate pb-2 text-center text-[11px] font-semibold text-[#123d2c] hover:underline dark:text-[#eef3ee]"
              title={vendorNames[v] ?? v}
            >
              {vendorNames[v] ?? v}
            </Link>
          ))}
        </div>

        {partners.map(([pid, meta]) => {
          const groupHeader = meta.kind !== lastKind ? (lastKind = meta.kind) : null;
          return (
            <div key={pid}>
              {groupHeader && (
                <div className="mt-2 mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b08d2f]">
                  {KIND_LABEL[groupHeader] ?? groupHeader}
                </div>
              )}
              <div className="grid items-stretch gap-px" style={{ gridTemplateColumns: cols }}>
                <div className="flex items-center truncate py-1 pr-2 text-[13px] text-[#123d2c] dark:text-[#eef3ee]">
                  <Link href={`/vendors`} className="truncate hover:underline" title={meta.name}>
                    {meta.name}
                  </Link>
                </div>
                {vendors.map((v) => {
                  const e = cell.get(`${pid}|${v}`);
                  if (!e) {
                    return (
                      <div
                        key={v}
                        className="min-h-[26px] rounded-[3px] border border-[#123d2c]/10 bg-[#123d2c]/[0.04] dark:border-white/10 dark:bg-white/[0.03]"
                      />
                    );
                  }
                  const t = TIER[e.partnershipTier];
                  const faint = e.evidenceTier === "plausible_unverified";
                  return (
                    <div
                      key={v}
                      className="relative min-h-[26px] rounded-[3px] border border-[#123d2c]/10 dark:border-white/10"
                      style={{ background: t.fill, opacity: faint ? 0.72 : 1 }}
                      title={`${meta.name} → ${vendorNames[v] ?? v}\n${t.label} · ${e.evidenceTier.replace(/_/g, " ")} evidence${e.encroachment ? " · ENCROACHMENT (delivers a rival to its own platform)" : ""}\n${e.rationale}`}
                    >
                      {e.encroachment && (
                        <span className="absolute right-0.5 top-0 text-[9px] font-bold leading-none text-[#b08d2f]" aria-hidden>▲</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#123d2c]/70 dark:text-[#eef3ee]/65">
          <span className="font-semibold uppercase tracking-wide">Extent:</span>
          {(["direct_named", "cloud_certified", "observed_implementer"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: TIER[k].fill }} />
              {TIER[k].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1"><span className="text-[#b08d2f]">▲</span> encroachment (hybrid delivers a rival)</span>
          <span className="opacity-70">fainter = plausible / unverified evidence</span>
        </div>
      </div>
    </div>
  );
}
