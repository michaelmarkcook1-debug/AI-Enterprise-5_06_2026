import type { Metadata } from "next";
import Link from "next/link";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import { EXPOSURE_NODES } from "@/lib/investing/exposure-map-data";
import { absoluteUrl } from "@/lib/site";
import {
  projectExposureToDependencyEdges,
  summariseByKind,
} from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "@/lib/graph/encroachment";
import { deriveGraphTakeaway } from "@/lib/graph/takeaway";
import { HARDCODED_SURFACES_WIRED } from "@/lib/availability";
import DataUnavailable from "@/components/DataUnavailable";

// ISR: server-rendered + CDN-cached, revalidated hourly. STRICT mode: the graph
// is curated/hardcoded (lib/investing/exposure-map-data.ts) — NOT live-DB
// verified evidence — so it only renders when the portal is evidence-backed.
export const revalidate = 3600;

const TITLE = "AI Dependency & Encroachment Graph";
const DESCRIPTION =
  "Who relies on whom across the AI market — compute, models, cloud, and capital. Every edge is source-backed and confidence-tiered. The owned signal you can't get from a leaderboard.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/dependencies" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/dependencies"), type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function DependenciesPage() {
  // STRICT: hold the hardcoded graph until the portal is backed by verified
  // evidence — we never present curated relationships as if measured/live.
  if (!HARDCODED_SURFACES_WIRED) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-6">
          <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
          <p className={`mt-2 max-w-3xl text-sm ${MUTED}`}>{DESCRIPTION}</p>
        </header>
        <DataUnavailable
          title="Dependency graph unavailable"
          detail="The dependency/encroachment graph appears only when backed by reviewed, source-backed evidence in our live data store. No reviewed evidence has been ingested yet, so we hold it rather than present curated relationships as if measured."
        />
      </main>
    );
  }

  const edges = projectExposureToDependencyEdges();
  const byKind = summariseByKind(edges);
  const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const label = (id: string) => labelById.get(id) ?? id;
  const encroachments = deriveEncroachmentEdges(edges, buildRolesByNodeId());
  const takeaway = deriveGraphTakeaway(edges, label);

  const total = edges.length;
  // Three tiers that partition every edge (sum === total) — no silent omission.
  const highCount = edges.filter((e) => e.confidence >= 80).length;
  const mediumCount = edges.filter((e) => e.confidence >= 45 && e.confidence < 80).length;
  const seedCount = edges.filter((e) => e.confidence < 45).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
        <p className={`mt-2 max-w-3xl text-sm ${MUTED}`}>{DESCRIPTION}</p>
      </header>

      {/* Derived "so what" — chokepoints (compute/cloud/capital leverage) stated
          separately from model ubiquity, so open-weight integration is never
          mislabelled as pricing power. Recomputed from the live edge data. */}
      {takeaway && (
        <div className="mb-6 max-w-3xl text-sm leading-6">
          <p>
            <span className="mr-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle">
              Derived signal
            </span>
            {takeaway.chokepoints}
          </p>
          {takeaway.ubiquity && <p className={`mt-1.5 ${MUTED}`}>{takeaway.ubiquity}</p>}
        </div>
      )}

      {/* How to read it + provenance — honest about what the edges are. */}
      <section className={`${CARD} mb-6 text-sm`}>
        <p>
          Each line is a <strong>dependency</strong>: who an organisation relies on for compute,
          models, cloud, or capital. {total} relationships across the core ecosystem. Every edge
          carries its own public source and a confidence tier —{" "}
          <strong>{highCount}</strong> high-confidence (SEC filings, press, official catalogs),{" "}
          <strong>{mediumCount}</strong> medium (public, lower depth), and{" "}
          <strong>{seedCount}</strong> seed (plausible, not yet verified — shown dashed). We surface
          the confidence rather than hide it; nothing here is presented as audited fact.
        </p>
      </section>

      {/* Interactive graph (client) — the shareable hero. */}
      <section className="mb-8">
        <ExposureMapHero />
      </section>

      {/* Server-rendered summary — indexable + no-JS fallback. */}
      <section className={CARD}>
        <h2 className="mb-1 text-lg font-semibold">Most depended-upon, by layer</h2>
        <p className={`mb-4 text-xs ${MUTED}`}>
          The providers the rest of the market leans on most — concentration here is where systemic
          risk (and pricing power) lives.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byKind.map((k) => (
            <div key={k.kind} className="rounded-lg border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{k.label}</h3>
                <span className={`text-xs ${MUTED}`}>{k.edgeCount} links</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {k.topProviders.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between">
                    <span>{label(p.id)}</span>
                    <span className={`tabular-nums text-xs ${MUTED}`}>{p.dependents} rely on</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Encroachment watch — DERIVED signals, clearly labelled, never stated as fact. */}
      <section className={`${CARD} mt-6`}>
        <h2 className="mb-1 text-lg font-semibold">Encroachment watch</h2>
        <p className="mb-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
          Derived analytical signal — not a stated fact
        </p>
        <p className={`mb-4 text-xs ${MUTED}`}>
          Each line combines a <strong>source-backed dependency</strong> with a{" "}
          <strong>role overlap</strong>: a supplier that also operates in its customer&apos;s layer
          is positioned to compete. We show these only where both hold — never as a measured claim.
        </p>
        {encroachments.length === 0 ? (
          <p className={`text-sm ${MUTED}`}>No role-overlap encroachment signals in the current data.</p>
        ) : (
          <ul className="space-y-2">
            {encroachments.slice(0, 12).map((e) => (
              <li
                key={`${e.fromVendorId}->${e.toVendorId}`}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <span className="font-medium">{label(e.fromVendorId)}</span>
                <span className={MUTED}> could encroach on </span>
                <span className="font-medium">{label(e.toVendorId)}</span>
                <p className={`mt-0.5 text-xs ${MUTED}`}>{e.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className={`mt-6 text-sm ${MUTED}`}>
        See the underlying scores on the{" "}
        <Link href="/vendors" className="underline underline-offset-2">vendor leaderboard</Link>, or
        the <Link href="/models" className="underline underline-offset-2">model inventory</Link>.
      </p>
    </main>
  );
}
