import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import {
  listMarketCategories,
  listMarketShareEstimates,
  listIntelligenceVendors,
} from "@/lib/intelligence/repository";

// ISR: server-rendered + CDN-cached, revalidated hourly; DB reads only.
export const revalidate = 3600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await listMarketCategories().catch(() => []);
  return categories.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const categories = await listMarketCategories().catch(() => []);
  const category = categories.find((c) => c.id === slug);
  if (!category) return { title: "Category not found" };
  const title = `${category.name} — vendor rankings`;
  return {
    title,
    description: category.description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: { title, description: category.description, url: absoluteUrl(`/category/${slug}`), type: "website" },
  };
}

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [categories, estimates, vendors] = await Promise.all([
    listMarketCategories(),
    listMarketShareEstimates(),
    listIntelligenceVendors(),
  ]);

  const category = categories.find((c) => c.id === slug);
  if (!category) notFound();

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const rows = estimates
    .flatMap((est) => {
      if (est.categoryId !== slug) return [];
      const vendor = vendorById.get(est.vendorId);
      return vendor ? [{ est, vendor }] : [];
    })
    .sort((a, b) => b.est.estimatedShare - a.est.estimatedShare);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/vendors" className="underline underline-offset-2">Vendors</Link> · Category
      </nav>
      <header className="mb-8">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{category.name}</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>{category.description}</p>
      </header>

      {rows.length === 0 ? (
        <div className={CARD}>
          <p className="text-sm">
            Insufficient verified market-share evidence for this category yet. We report the absence
            of data rather than estimate upward — check back as sourcing fills in, or browse the{" "}
            <Link href="/vendors" className="underline underline-offset-2">full vendor leaderboard</Link>.
          </p>
        </div>
      ) : (
        <section className={CARD}>
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <strong>Directional estimates, not measured market data.</strong> Every share figure
            below is an analyst estimate from spend/signal proxies — each row carries its own source
            and method. Indicative, not audited.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className={`text-left ${MUTED}`}>
                  <th className="py-2 pr-4 font-medium">Vendor</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Est. share</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Confidence</th>
                  <th className="py-2 pr-4 font-medium">Source / method</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ est, vendor }) => (
                  <tr key={vendor.id} className="border-t border-black/5 dark:border-white/10 align-top">
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/vendors/${vendor.slug}`} className="underline underline-offset-2">
                        {vendor.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{est.estimatedShare.toFixed(1)}%</td>
                    <td className="py-2 pr-4 tabular-nums">{Math.round(est.confidence)}%</td>
                    <td className={`py-2 pr-4 text-xs ${MUTED}`}>
                      {est.source} · {est.methodology}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`mt-4 text-xs ${MUTED}`}>
            Market-share figures are directional estimates, each labelled with its source and
            method. They are not audited financials.
          </p>
        </section>
      )}
    </main>
  );
}
