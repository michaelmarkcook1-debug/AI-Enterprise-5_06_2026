import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import { listPublishedArticles } from "@/lib/articles/repository";
import FrameworkCrosswalk from "@/components/insights/FrameworkCrosswalk";

export const revalidate = 3600;

const TITLE = "Insights";
const DESCRIPTION =
  "Analysis and education on the enterprise-AI market — dependencies, encroachment, and what the rankings mean for buyers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/insights" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/insights"), type: "website" },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function MethodCard({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className={`mt-1.5 text-xs leading-5 ${MUTED}`}>{children}</p>
      {href && hrefLabel && (
        <Link href={href} className="mt-2 inline-block text-xs font-medium underline-offset-2 hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

export default async function InsightsPage() {
  const articles = await listPublishedArticles().catch(() => []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
        <p className={`mt-2 text-sm ${MUTED}`}>{DESCRIPTION}</p>
      </header>

      {articles.length > 0 ? (
        <ul className="mb-12 space-y-5">
          {articles.map((a) => (
            <li key={a.slug} className={CARD}>
              <Link href={`/insights/${a.slug}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                {a.title}
              </Link>
              {a.summary && <p className={`mt-1 text-sm ${MUTED}`}>{a.summary}</p>}
              <p className={`mt-2 text-xs ${MUTED}`}>
                {a.authorName ? `${a.authorName} · ` : ""}
                {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${CARD} mb-12`}>
          <p className="text-sm">
            No analyst articles are published yet — explainers are in progress. In the meantime, here&apos;s
            exactly how the platform works and where to dig in. (We publish only real, source-honest
            analysis — never filler.)
          </p>
        </div>
      )}

      {/* Methodology — education about OUR OWN system, always shown. No market data. */}
      <section className="mb-10">
        <h2 className="mb-1 font-[var(--font-display)] text-xl font-extrabold tracking-tight">How this works</h2>
        <p className={`mb-4 max-w-2xl text-sm ${MUTED}`}>
          Independent, evidence-based, and explicit about confidence. The three things worth understanding
          before you rely on anything here:
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MethodCard title="Rankings — within category, never across" href="/vendors" hrefLabel="See the rankings">
            Vendors are ranked inside each of 13 market categories by a coverage-discounted, multi-pillar
            composite of reviewed, source-backed evidence — not a market-share proxy. Market Share Est. is just
            one input (via Market Strength), never the rank. We never put a chip foundry, a VC, and a model lab
            on one leaderboard — they aren&apos;t comparable.
          </MethodCard>
          <MethodCard title="The graph — every edge is sourced" href="/dependencies" hrefLabel="Explore the graph">
            Each edge (who relies on whom for compute, models, cloud, capital) carries its own public source
            and a confidence tier. Encroachment edges are a derived analytical signal, clearly labelled —
            never presented as a stated fact.
          </MethodCard>
          <MethodCard title="Confidence tiers — what they mean" href="/models" hrefLabel="See the model inventory">
            High (≥80): SEC filings, official catalogs, press. Medium (45–79): public, lower depth. Seed
            (&lt;45): plausible, not yet verified — shown dashed. We surface confidence rather than hide it;
            absence of evidence is reported, never estimated upward.
          </MethodCard>
        </div>
        <p id="market-share-est" className={`mt-5 max-w-3xl scroll-mt-24 text-xs leading-5 ${MUTED}`}>
          <strong>On &ldquo;Market Share Est.&rdquo;:</strong> there is no measured market-share feed for these
          largely-private vendors. Each figure is an <strong>estimate</strong> derived from real cited signals
          (reviewed evidence depth, dependency/delivery reach, adoption, momentum), normalised within a category
          and recalculated every refresh. It is directional context — <strong>not</strong> measured revenue or
          audited share — and never the basis of the rank. Vendors we cannot map to a category show
          &ldquo;mapping insufficient&rdquo; rather than a guessed number.
        </p>
      </section>

      {/* C2 — framework-mapping / credibility crosswalk (NIST AI RMF · ISO/IEC 42001 · EU AI Act) */}
      <FrameworkCrosswalk />

      <p className={`text-sm ${MUTED}`}>
        Coming soon: explainers on reading the dependency graph, why we rank within categories (never
        across), and what &ldquo;confidence-tiered&rdquo; means for your procurement decisions.
      </p>
    </main>
  );
}
