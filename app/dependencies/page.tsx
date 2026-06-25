import type { Metadata } from "next";
import Link from "next/link";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";
import { EXPOSURE_NODES } from "@/lib/investing/exposure-map-data";
import { absoluteUrl } from "@/lib/site";
import {
  projectExposureToDependencyEdges,
  summariseByKind,
} from "@/lib/graph/dependency-projection";

// ISR: server-rendered + CDN-cached, revalidated hourly. The graph data is
// curated + source-backed (lib/investing/exposure-map-data.ts); zero LLM at
// request time. The interactive graph hydrates on the client; the summary below
// is server-rendered so the page is indexable and works without JS.
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

export default function DependenciesPage() {
  const edges = projectExposureToDependencyEdges();
  const byKind = summariseByKind(edges);
  const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const label = (id: string) => labelById.get(id) ?? id;

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

      <p className={`mt-6 text-sm ${MUTED}`}>
        See the underlying scores on the{" "}
        <Link href="/vendors" className="underline underline-offset-2">vendor leaderboard</Link>, or
        the <Link href="/models" className="underline underline-offset-2">model inventory</Link>.
      </p>
    </main>
  );
}
