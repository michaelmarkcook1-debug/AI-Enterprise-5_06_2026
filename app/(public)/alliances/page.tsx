import type { Metadata } from "next";
import Link from "next/link";
import { buildDeliveryGraph } from "@/lib/graph/delivery-projection";
import { DELIVERY_PARTNERS } from "@/lib/delivery/seed";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import {
  ALLIANCE_SPOTLIGHTS,
  VENDOR_VENTURES,
  SPOTLIT_EDGE_KEYS,
  type AllianceSpotlight,
  type VendorVenture,
  type AllianceProofPoint,
} from "@/lib/delivery/alliance-highlights";
import DeliveryMatrix from "@/components/delivery/DeliveryMatrix";
import AllianceExplorer, {
  type ExplorerEdge,
  type ExplorerParty,
} from "@/components/alliances/AllianceExplorer";
import { absoluteUrl } from "@/lib/site";

// ISR: server-rendered + CDN-cached, revalidated hourly. Two provenance classes
// render here, each labelled: (1) source-cited alliance spotlights (named press /
// vendor sources, fact-checked 2026-07-24) and (2) the analyst-curated delivery
// channel map (the GSI×AI seed — directional breadth, never audited fact). Same
// firewalled "curated reference" class as the dependency graph; nothing feeds a
// vendor score.
export const revalidate = 3600;

const TITLE = "AI × GSI Alliance Explorer";
const DESCRIPTION =
  "Which system integrators deliver which AI models into the enterprise — the marquee alliances with sources, plus the full curated delivery channel. The partner-channel view a leaderboard can't give you.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alliances" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/alliances"), type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CARD = "rounded-xl border border-[#123d2c]/12 dark:border-white/10 bg-white/60 dark:bg-white/5";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const KIND_ORDER = ["global_si", "platform_hybrid", "strategy_consultancy", "regional_si"];
const KIND_OF = new Map(DELIVERY_PARTNERS.map((p) => [p.id, p.kind as string]));
const vendorName = (id: string) => TRACKED_VENDOR_NAMES[id] ?? id;

// Fixed, sensible vendor order for the spotlight sections.
const SPOTLIGHT_VENDOR_ORDER = ["openai", "anthropic", "google", "microsoft", "mistral", "cohere"];

function ProofRow({ p }: { p: AllianceProofPoint }) {
  return (
    <li className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#b08d2f]">{p.label}</span>
      <span className="text-[13px] leading-snug text-[#123d2c] dark:text-[#eef3f8]">{p.value}</span>
    </li>
  );
}

function EvidenceBadge({ evidence }: { evidence: "verified" | "partial" }) {
  const verified = evidence === "verified";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        verified
          ? "bg-[#3f9d76]/15 text-[#1f6f4f] dark:text-[#7fd3ac]"
          : "bg-[#b08d2f]/15 text-[#8a6d18] dark:text-[#d4af37]"
      }`}
      title={verified ? "Every figure source-verified against a named source." : "Alliance is real; at least one prototype claim was corrected or dropped against the source."}
    >
      {verified ? "Source-verified" : "Verified · claims corrected"}
    </span>
  );
}

function SourceLink({ publisher, url, asOf }: { publisher: string; url: string; asOf: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-[#1f6f4f] underline underline-offset-2 hover:text-[#123d2c] dark:text-[#7fd3ac] dark:hover:text-[#a7e6c8]"
      >
        {publisher}
        <span aria-hidden>↗</span>
      </a>
      <span className={MUTED}>· {asOf}</span>
    </div>
  );
}

function VentureCard({ v }: { v: VendorVenture }) {
  return (
    <article className={`${CARD} flex flex-col p-5`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#123d2c]/50 dark:text-[#eef3f8]/50">
          {v.vendorName} · delivery venture
        </span>
        <EvidenceBadge evidence={v.evidence} />
      </div>
      <h3 className="text-[15px] font-bold leading-snug text-[#123d2c] dark:text-[#eef3f8]">{v.title}</h3>
      <p className={`mt-1.5 text-[13px] leading-relaxed ${MUTED}`}>{v.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {v.proofPoints.map((p) => (
          <ProofRow key={p.label} p={p} />
        ))}
      </ul>
      <SourceLink publisher={v.publisher} url={v.url} asOf={v.asOf} />
    </article>
  );
}

function SpotlightCard({ s }: { s: AllianceSpotlight }) {
  return (
    <article className={`${CARD} flex flex-col p-5`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#123d2c]/50 dark:text-[#eef3f8]/50">
          {s.relationship}
        </span>
        <EvidenceBadge evidence={s.evidence} />
      </div>
      <h3 className="text-[15px] font-bold leading-snug text-[#123d2c] dark:text-[#eef3f8]">
        {s.partnerName} <span className="text-[#b08d2f]">×</span> {s.vendorName}
      </h3>
      <p className={`mt-1.5 text-[13px] leading-relaxed ${MUTED}`}>{s.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {s.proofPoints.map((p) => (
          <ProofRow key={p.label} p={p} />
        ))}
      </ul>
      <SourceLink publisher={s.publisher} url={s.url} asOf={s.asOf} />
    </article>
  );
}

export default function AlliancesPage() {
  const graph = buildDeliveryGraph();

  // Explorer edges: enrich each seed edge with partner kind, vendor name, spotlight flag.
  const explorerEdges: ExplorerEdge[] = graph.edges.map((e) => ({
    partnerId: e.partnerId,
    partnerName: e.partnerName,
    kind: KIND_OF.get(e.partnerId) ?? "global_si",
    vendorId: e.vendorId,
    vendorName: vendorName(e.vendorId),
    tier: e.partnershipTier,
    evidence: e.evidenceTier,
    encroachment: e.encroachment,
    spotlit: SPOTLIT_EDGE_KEYS.has(`${e.partnerId}|${e.vendorId}`),
  }));

  // Partners ordered by kind group, then by how many vendors they deliver.
  const partnerCount = new Map<string, number>();
  for (const e of explorerEdges) partnerCount.set(e.partnerId, (partnerCount.get(e.partnerId) ?? 0) + 1);
  const partners: ExplorerParty[] = [...new Map(explorerEdges.map((e) => [e.partnerId, e])).values()]
    .map((e) => ({ id: e.partnerId, name: e.partnerName, kind: e.kind }))
    .sort((x, y) => {
      const kx = KIND_ORDER.indexOf(x.kind);
      const ky = KIND_ORDER.indexOf(y.kind);
      if (kx !== ky) return kx - ky;
      return (partnerCount.get(y.id) ?? 0) - (partnerCount.get(x.id) ?? 0) || x.name.localeCompare(y.name);
    });

  // Vendors ordered by breadth of SI coverage.
  const vendorCount = new Map<string, number>();
  for (const e of explorerEdges) vendorCount.set(e.vendorId, (vendorCount.get(e.vendorId) ?? 0) + 1);
  const vendors = [...new Set(explorerEdges.map((e) => e.vendorId))]
    .map((id) => ({ id, name: vendorName(id) }))
    .sort((x, y) => (vendorCount.get(y.id) ?? 0) - (vendorCount.get(x.id) ?? 0) || x.name.localeCompare(y.name));

  const spotlightsByVendor = SPOTLIGHT_VENDOR_ORDER.map((vid) => ({
    vendorId: vid,
    vendorName: vendorName(vid),
    items: ALLIANCE_SPOTLIGHTS.filter((s) => s.vendorId === vid),
  })).filter((g) => g.items.length > 0);

  const citedCount = VENDOR_VENTURES.length + ALLIANCE_SPOTLIGHTS.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-[#123d2c] dark:text-[#eef3f8]">
          {TITLE}
        </h1>
        <p className={`mt-2 max-w-3xl text-base ${MUTED}`}>{DESCRIPTION}</p>
        {/* Real-data strip — every count is measured from the datasets on this page. */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {[
            [citedCount, "source-cited alliances"],
            [partners.length, "integrators"],
            [vendors.length, "AI vendors"],
            [graph.edges.length, "curated channel links"],
          ].map(([n, label]) => (
            <span key={label as string} className="inline-flex items-baseline gap-1.5">
              <span className="font-[var(--font-display)] text-lg font-bold tabular-nums text-[#123d2c] dark:text-[#eef3f8]">
                {n as number}
              </span>
              <span className={`text-[13px] ${MUTED}`}>{label as string}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Provenance — two labelled classes, no over-claim. */}
      <section className={`${CARD} mb-8 p-5 text-sm leading-6`}>
        <p>
          <span className="mr-1.5 font-semibold text-[#1f6f4f] dark:text-[#7fd3ac]">Source-cited —</span>
          the <strong>{citedCount} alliance spotlights</strong> below each trace to a named press or vendor source,
          fact-checked against live reporting. Figures that couldn&apos;t be sourced were dropped, not softened.
        </p>
        <p className={`mt-2 ${MUTED}`}>
          <span className="mr-1.5 font-semibold text-[#b08d2f]">Analyst-curated —</span>
          the delivery channel map and directory are curated breadth (which SIs deliver which vendors, to what depth):
          directional reference, confidence-tiered, never presented as audited fact. Nothing on this page feeds a
          vendor score.
        </p>
      </section>

      {/* 1 — Cited spotlights (the research payload; server-rendered + indexable). */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold text-[#123d2c] dark:text-[#eef3f8]">Alliance spotlights</h2>
        <p className={`mb-4 max-w-3xl text-sm ${MUTED}`}>
          The marquee moves — the delivery ventures the model vendors are standing up, and the named GSI alliances with
          verified reach.
        </p>

        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b08d2f]">
          Vendor delivery ventures
        </h3>
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {VENDOR_VENTURES.map((v) => (
            <VentureCard key={v.id} v={v} />
          ))}
        </div>

        {spotlightsByVendor.map((group) => (
          <div key={group.vendorId} className="mb-8">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b08d2f]">
              {group.vendorName} · GSI alliances
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((s) => (
                <SpotlightCard key={s.id} s={s} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 2 — The curated delivery channel map (reused DeliveryMatrix). */}
      <section className={`${CARD} mb-8 p-5`}>
        <h2 className="mb-1 text-lg font-semibold text-[#123d2c] dark:text-[#eef3f8]">The delivery channel map</h2>
        <p className={`mb-4 max-w-3xl text-sm ${MUTED}`}>
          Which integrators deliver which AI vendors, and to what depth. Curated analyst breadth — ★ in the directory
          marks the cells that also have a source-cited spotlight above.
        </p>
        <DeliveryMatrix edges={graph.edges} vendorNames={TRACKED_VENDOR_NAMES} />
      </section>

      {/* 3 — Directory + comparator (client). */}
      <section className={`${CARD} mb-8 p-5`}>
        <h2 className="mb-1 text-lg font-semibold text-[#123d2c] dark:text-[#eef3f8]">Directory & comparison</h2>
        <p className={`mb-4 max-w-3xl text-sm ${MUTED}`}>
          Filter the channel by vendor, or line up two integrators to see where their AI coverage overlaps.
        </p>
        <AllianceExplorer edges={explorerEdges} partners={partners} vendors={vendors} />
      </section>

      <p className={`mt-6 text-sm ${MUTED}`}>
        See the underlying scores on the{" "}
        <Link href="/vendors" className="underline underline-offset-2">vendor leaderboard</Link>, or the market&apos;s
        supply chain on the{" "}
        <Link href="/dependencies" className="underline underline-offset-2">dependency &amp; encroachment graph</Link>.
      </p>
    </main>
  );
}
