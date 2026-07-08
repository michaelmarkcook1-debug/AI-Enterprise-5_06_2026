import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import {
  getIntelligenceVendor,
  listVendorPillarScores,
  listVendorMomentum,
} from "@/lib/intelligence/repository";
import { isLiveData } from "@/lib/intelligence/provenance";
import { getVendorCategoryStandings, type VendorCategoryStanding } from "@/lib/ranking/category-composite";
import DataUnavailable from "@/components/DataUnavailable";

// force-dynamic: comparisons are DB-backed (real pillar scores), so reflect the
// live/recalculated data immediately rather than serve a stale render.
export const dynamic = "force-dynamic";

type Params = { comparison: string };

/** Parse a "slug-a-vs-slug-b" segment into its two vendor slugs. */
function parsePair(comparison: string): [string, string] | null {
  const parts = comparison.split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

const PILLAR_LABEL = (p: string) =>
  p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { comparison } = await params;
  const pair = parsePair(comparison);
  if (!pair) return { title: "Comparison not found" };
  const [a, b] = await Promise.all([getIntelligenceVendor(pair[0]), getIntelligenceVendor(pair[1])]);
  if (!a || !b) return { title: "Comparison not found" };
  const title = `${a.name} vs ${b.name}`;
  const description = `Side-by-side: ${a.name} and ${b.name} on overall score, confidence, and every capability pillar — evidence-based, no vendor input.`;
  return {
    title,
    description,
    alternates: { canonical: `/compare/${comparison}` },
    openGraph: { title, description, url: absoluteUrl(`/compare/${comparison}`), type: "website" },
  };
}

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function VendorColumn({
  name,
  slug,
  standing,
  category,
  position,
  momentum,
}: {
  name: string;
  slug: string;
  standing: VendorCategoryStanding | null;
  category: string;
  position: string;
  momentum: number | null;
}) {
  const s = standing?.standing;
  const ranked = s?.state === "ranked";
  return (
    <div className={CARD}>
      <Link href={`/vendors/${slug}`} className="text-lg font-semibold underline underline-offset-2">
        {name}
      </Link>
      <div className={`mt-1 text-xs ${MUTED}`}>{category} · {position}</div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className={MUTED}>{standing ? `Composite in ${standing.categoryName}` : "In-category composite"}</dt>
          <dd className="tabular-nums font-medium">
            {ranked && s?.assessmentComposite != null ? `${s.assessmentComposite.toFixed(2)}/5` : "insufficient evidence"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className={MUTED}>Rank</dt>
          <dd className="tabular-nums">{ranked && standing ? `#${s!.rank} of ${standing.rankedCount}` : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className={MUTED}>Confidence</dt>
          <dd className="tabular-nums">{ranked && s?.compositeConfidence != null ? `${Math.round(s.compositeConfidence)}%` : "—"}</dd>
        </div>
        <div className="flex justify-between"><dt className={MUTED}>Momentum</dt><dd className="tabular-nums">{momentum == null ? "—" : Math.round(momentum)}</dd></div>
      </dl>
    </div>
  );
}

export default async function ComparePage({ params }: { params: Promise<Params> }) {
  const { comparison } = await params;
  const pair = parsePair(comparison);
  if (!pair) notFound();

  // STRICT: overall/confidence/momentum/pillar scores are seed-derived unless
  // backed by verified evidence — hold the comparison until the portal is live.
  if (!(await isLiveData())) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <DataUnavailable
          title="Vendor comparison unavailable"
          detail="Side-by-side scores appear only when backed by reviewed, source-backed evidence in our live data store. No reviewed evidence has been ingested yet, so we hold comparisons rather than compare hardcoded scores as if measured."
        />
      </main>
    );
  }

  const [a, b] = await Promise.all([getIntelligenceVendor(pair[0]), getIntelligenceVendor(pair[1])]);
  if (!a || !b) notFound();

  const [pillars, momentum, aStandings, bStandings] = await Promise.all([
    listVendorPillarScores(),
    listVendorMomentum(),
    getVendorCategoryStandings(a.id),
    getVendorCategoryStandings(b.id),
  ]);
  const momentumBy = new Map(momentum.map((m) => [m.vendorId, m.momentumScore]));

  // Composite unification: both columns must show the SAME basis (the unified
  // 0-5 assessmentComposite) the category/homepage/vendor-list pages use — never
  // the raw vendor.overallScore this page used to show. Prefer a category BOTH
  // vendors compete in (a real head-to-head); prefer one where both are actually
  // ranked over one where either is held. With no shared category, fall back to
  // each vendor's own best standing — each carries its own category label so two
  // different contexts never read as a false head-to-head.
  const bByCategory = new Map(bStandings.map((s) => [s.categoryId, s]));
  const shared = aStandings
    .filter((s) => bByCategory.has(s.categoryId))
    .map((s) => [s, bByCategory.get(s.categoryId)!] as const);
  const bothRanked = shared.find(([sa, sb]) => sa.standing.state === "ranked" && sb.standing.state === "ranked");
  const sharedPair = bothRanked ?? shared[0] ?? null;
  const bestOwn = (list: VendorCategoryStanding[]) => list.find((s) => s.standing.state === "ranked") ?? list[0] ?? null;
  const aStanding = sharedPair ? sharedPair[0] : bestOwn(aStandings);
  const bStanding = sharedPair ? sharedPair[1] : bestOwn(bStandings);

  const aPillars = new Map(pillars.filter((p) => p.vendorId === a.id).map((p) => [p.pillar, p.capabilityScore]));
  const bPillars = new Map(pillars.filter((p) => p.vendorId === b.id).map((p) => [p.pillar, p.capabilityScore]));
  const pillarKeys = [...new Set([...aPillars.keys(), ...bPillars.keys()])].sort();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/vendors" className="underline underline-offset-2">Vendors</Link> · Compare
      </nav>
      <header className="mb-8">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">
          {a.name} <span className={MUTED}>vs</span> {b.name}
        </h1>
        <p className={`mt-2 text-sm ${MUTED}`}>
          Evidence-based capability comparison. Scores are computed from cited evidence by a fixed
          rubric — neither vendor can influence them.
        </p>
      </header>

      <section className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <VendorColumn name={a.name} slug={a.slug} standing={aStanding} category={a.category} position={a.marketPosition} momentum={momentumBy.get(a.id) ?? null} />
        <VendorColumn name={b.name} slug={b.slug} standing={bStanding} category={b.category} position={b.marketPosition} momentum={momentumBy.get(b.id) ?? null} />
      </section>
      <div className="mb-8">
        {!sharedPair && (aStanding || bStanding) && (
          <p className={`text-xs ${MUTED}`}>
            {a.name} and {b.name} don&apos;t share a ranked market category, so each composite above is shown in
            that vendor&apos;s own category — not a direct head-to-head.
          </p>
        )}
      </div>

      {pillarKeys.length > 0 ? (
        <section className={CARD}>
          <h2 className="mb-3 text-sm font-semibold">Capability pillars</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={`text-left ${MUTED}`}>
                  <th className="py-2 pr-4 font-medium">Pillar</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">{a.name}</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">{b.name}</th>
                </tr>
              </thead>
              <tbody>
                {pillarKeys.map((p) => {
                  const av = aPillars.get(p);
                  const bv = bPillars.get(p);
                  return (
                    <tr key={p} className="border-t border-black/5 dark:border-white/10">
                      <td className="py-2 pr-4">{PILLAR_LABEL(p)}</td>
                      <td className="py-2 pr-4 tabular-nums">{av == null ? "—" : av.toFixed(0)}</td>
                      <td className="py-2 pr-4 tabular-nums">{bv == null ? "—" : bv.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={`mt-4 text-xs ${MUTED}`}>A “—” means insufficient evidence for that pillar — not a zero score.</p>
        </section>
      ) : (
        <div className={CARD}>
          <p className="text-sm">No pillar-level evidence is available yet for either vendor to compare.</p>
        </div>
      )}
    </main>
  );
}
