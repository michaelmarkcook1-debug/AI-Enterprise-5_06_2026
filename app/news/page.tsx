import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listNewsItems, listIntelligenceVendors } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const [news, vendors] = await Promise.all([listNewsItems(), listIntelligenceVendors()]);
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  return (
    <PageFrame title="News and functionality intelligence" kicker="Classified signals" description="A decision feed, not a generic feed. Each item includes impact, confidence, pillar impact, why it matters, and score implications.">
      <Panel title="Intelligence stream">
        <div className="mb-4">
          <OwnershipLegend />
        </div>
        <div className="divide-y divide-[#edf0ea]">
          {news.map((item) => (
            <article key={item.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_180px]">
              <div>
                <div className="flex flex-wrap gap-2">
                  {item.categories.map((category) => <span key={category} className="rounded bg-[#eef2e8] px-2 py-1 text-xs text-[#455044]">{category}</span>)}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#18201b]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#4d574b]">{item.summary}</p>
                <p className="mt-2 text-sm leading-6 text-[#596151]"><strong>Why it matters:</strong> {item.whyItMatters}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#66705f]">
                  <span className="font-semibold uppercase tracking-wide">Vendors</span>
                  {item.vendors.map((id) => {
                    const vendor = vendorById.get(id);
                    return (
                      <span key={id} className="rounded border border-[#d8ded0] px-2 py-1 dark:border-zinc-700">
                        {vendor ? <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /> : id}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-[#66705f]">
                  Pillars: {item.affectedPillars.map((pillar) => pillar.replace(/_/g, " ")).join(", ")}
                </div>
              </div>
              <div className="space-y-2 lg:text-right">
                <div className="font-mono text-2xl font-semibold">{item.impactScore}</div>
                <Confidence value={item.confidenceScore} />
                <div className="text-xs text-[#66705f]">{item.sourceName}</div>
                <div className="text-xs text-[#66705f]">{new Date(item.publishedAt).toLocaleDateString("en-GB")}</div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
