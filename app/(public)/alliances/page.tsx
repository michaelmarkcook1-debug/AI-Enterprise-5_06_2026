import type { Metadata } from "next";
import Link from "next/link";
import { TRACKED_VENDOR_NAMES } from "@/lib/sourcing/ai-news-manifest";
import { buildAllianceRows, summariseRows, citedOffChannel } from "@/lib/delivery/alliance-rows";
import { VENDOR_VENTURES, ALLIANCE_SPOTLIGHTS } from "@/lib/delivery/alliance-highlights";
import AllianceWorkspace from "@/components/alliances/AllianceWorkspace";
import { absoluteUrl } from "@/lib/site";

// ISR: server-rendered + CDN-cached, revalidated hourly. (Next 16 here runs in
// legacy cache mode — no cacheComponents — so revalidate/force-dynamic is the
// correct control, NOT 'use cache'.)
//
// Two provenance classes render here, each labelled in the UI: (1) source-cited
// alliance spotlights (named press/vendor sources, fact-checked 2026-07-24) and
// (2) the analyst-curated GSI×AI delivery channel (directional breadth, never
// audited fact). Same firewalled "curated reference" class as the dependency
// graph — nothing on this page feeds a vendor score.
export const revalidate = 3600;

const TITLE = "AI × GSI Alliance Explorer";
const DESCRIPTION =
  "Which system integrators deliver which AI models into the enterprise — an interactive map, the full delivery registry, a partner comparator, and the marquee alliances with sources.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alliances" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/alliances"), type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function AlliancesPage() {
  const rows = buildAllianceRows(TRACKED_VENDOR_NAMES);
  // `spotlit` counts channel rows carrying a citation; `citedTotal` is the true
  // number of cited alliances published here. They differ because a cited
  // alliance can sit outside the curated roster (EY isn't a tracked integrator;
  // the curated edge set carries no Capgemini×Mistral link). Report the real
  // total and name the gap — never let a join silently shrink the count.
  const summary = {
    ...summariseRows(rows),
    citedTotal: ALLIANCE_SPOTLIGHTS.length + VENDOR_VENTURES.length,
    offChannel: citedOffChannel(rows),
  };

  return (
    <main className="py-8">
      {/* The page owns the title, so the workspace below is a tool on this page
          rather than a second app with its own branded header bar. */}
      <header className="mx-auto mb-5 max-w-4xl px-4">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-[#123d2c] dark:text-[#eef3f8]">
          {TITLE}
        </h1>
        <p className="mt-2 text-base text-[#123d2c]/65 dark:text-[#eef3f8]/60">{DESCRIPTION}</p>
      </header>

      {/* Full-bleed: the map wants the width. */}
      <AllianceWorkspace rows={rows} summary={summary} ventures={VENDOR_VENTURES} />

      {/* Server-rendered cited spotlights — indexable, readable without JS, and
          the canonical statement of what is source-backed vs analyst-curated. */}
      <section className="mx-auto mt-10 max-w-4xl">
        <h2 className="font-[var(--font-display)] text-xl font-bold text-[#123d2c] dark:text-[#eef3f8]">
          Source-cited alliances
        </h2>
        <p className="mt-1 text-sm text-[#123d2c]/65 dark:text-[#eef3f8]/60">
          Every figure below traces to a named press or vendor source. Widely-repeated claims that could not be
          sourced were dropped rather than softened.
        </p>

        <div className="mt-5 space-y-3">
          {VENDOR_VENTURES.map((v) => (
            <article
              key={v.id}
              className="rounded-xl border border-[#123d2c]/12 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-[#123d2c] dark:text-[#eef3f8]">{v.title}</h3>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#1f6f4f] underline underline-offset-2 dark:text-[#7fd3ac]"
                >
                  {v.publisher} ↗ · {v.asOf}
                </a>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-[#123d2c]/70 dark:text-[#eef3f8]/65">{v.summary}</p>
              <ul className="mt-2 space-y-1">
                {v.proofPoints.map((p) => (
                  <li key={p.label} className="text-[12px] text-[#123d2c]/75 dark:text-[#eef3f8]/70">
                    <span className="font-semibold uppercase tracking-wide text-[#b08d2f]">{p.label}:</span> {p.value}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {ALLIANCE_SPOTLIGHTS.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-[#123d2c]/12 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-[#123d2c] dark:text-[#eef3f8]">
                  {s.partnerName} <span className="text-[#b08d2f]">×</span> {s.vendorName}
                  <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-[#123d2c]/50 dark:text-[#eef3f8]/50">
                    {s.relationship}
                  </span>
                </h3>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-[#1f6f4f] underline underline-offset-2 dark:text-[#7fd3ac]"
                >
                  {s.publisher} ↗ · {s.asOf}
                </a>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-[#123d2c]/70 dark:text-[#eef3f8]/65">{s.summary}</p>
              <ul className="mt-2 space-y-1">
                {s.proofPoints.map((p) => (
                  <li key={p.label} className="text-[12px] text-[#123d2c]/75 dark:text-[#eef3f8]/70">
                    <span className="font-semibold uppercase tracking-wide text-[#b08d2f]">{p.label}:</span> {p.value}
                  </li>
                ))}
              </ul>
              {s.evidence === "partial" && (
                <p className="mt-2 text-[11px] text-[#123d2c]/55 dark:text-[#eef3f8]/50">
                  Alliance verified; at least one widely-repeated claim about it was corrected or dropped against the source.
                </p>
              )}
            </article>
          ))}
        </div>

        <p className="mt-6 text-sm text-[#123d2c]/65 dark:text-[#eef3f8]/60">
          The {summary.links} channel links in the explorer above are analyst-curated breadth — directional and
          confidence-tiered, never audited fact. See the underlying scores on the{" "}
          <Link href="/vendors" className="underline underline-offset-2">vendor leaderboard</Link>, or the market&apos;s
          supply chain on the{" "}
          <Link href="/dependencies" className="underline underline-offset-2">dependency &amp; encroachment graph</Link>.
        </p>
      </section>
    </main>
  );
}
