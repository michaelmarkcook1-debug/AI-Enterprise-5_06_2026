import { PageFrame } from "@/components/app-shell";
import DataSourceRail from "@/components/data-source-rail";
import { Confidence, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listNewsItems, listIntelligenceVendors } from "@/lib/intelligence/repository";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { newsCategoryClasses } from "@/lib/ui/semantic-colors";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const [news, vendors, provenance] = await Promise.all([
    listNewsItems(),
    listIntelligenceVendors(),
    getDataProvenance(),
  ]);
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const seedCount = news.filter((n) => n.sourceKind !== "real").length;
  const liveCount = news.length - seedCount;

  return (
    <PageFrame aside={<DataSourceRail tab="news" />} title="News and functionality intelligence" kicker="Classified signals" description="A decision feed, not a generic feed. Each item includes impact, confidence, pillar impact, why it matters, and score implications.">
      {/* Honest banner — until verified evidence is promoted into the
          IntelligenceNewsItem table, every story shown here is seed.
          Counts let the operator see at a glance how much is live. */}
      {seedCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex flex-wrap items-center gap-2">
            <SeedDataBadge label={liveCount === 0 ? "All items are seed" : `${seedCount} seed · ${liveCount} live`} provenance={liveCount > 0 ? "live" : "seed"} reason={provenance.reason} />
            <span>
              {liveCount === 0
                ? "Every story below is illustrative seed copy. Approve proposals in /admin/evidence — and once a recompute step projects verified evidence into the news table, real items will replace these."
                : `${liveCount} story${liveCount === 1 ? " is" : " are"} source-backed; the rest are seed.`}
            </span>
          </div>
        </div>
      )}

      <Panel title="Intelligence stream">
        <div className="mb-4">
          <OwnershipLegend />
        </div>
        <div className="divide-y divide-[#efe9d9] dark:divide-[#16314c]">
          {news.map((item) => (
            <article key={item.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_180px]">
              <div>
                <div className="flex flex-wrap gap-2">
                  {item.categories.map((category) => <span key={category} className={`rounded px-2 py-0.5 text-xs font-medium ${newsCategoryClasses(category)}`}>{category}</span>)}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#13294b] dark:text-[#eef3f8]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#475a72] dark:text-[#a7bacd]">{item.summary}</p>
                <p className="mt-2 text-sm leading-6 text-[#54647a] dark:text-[#a7bacd]"><strong>Why it matters:</strong> {item.whyItMatters}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#5d6b80] dark:text-[#7a9bb8]">
                  <span className="font-semibold uppercase tracking-wide">Vendors</span>
                  {item.vendors.map((id) => {
                    const vendor = vendorById.get(id);
                    return (
                      <span key={id} className="rounded border border-[#e0d6ba] px-2 py-1 dark:border-[#2a4a6b]">
                        {vendor ? <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /> : id}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-[#5d6b80] dark:text-[#7a9bb8]">
                  Pillars: {item.affectedPillars.map((pillar) => pillar.replace(/_/g, " ")).join(", ")}
                </div>
              </div>
              <div className="space-y-2 lg:text-right">
                <div className="flex items-baseline gap-1.5 lg:justify-end">
                  <span className={`font-mono text-2xl font-semibold tabular-nums ${item.impactScore >= 80 ? "text-rose-600 dark:text-rose-400" : item.impactScore >= 65 ? "text-amber-600 dark:text-amber-400" : "text-sky-700 dark:text-sky-400"}`}>{item.impactScore}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a98a8]">impact</span>
                </div>
                <Confidence value={item.confidenceScore} />
                <div className="flex justify-start lg:justify-end">
                  <SeedDataBadge
                    label={item.sourceKind === "real" ? "Source linked" : "Seed item"}
                    provenance={item.sourceKind === "real" ? "live" : "seed"}
                  />
                </div>
                {/* Strip the noisy "[MOCK]" prefix from rendered source
                    text — the badge above carries the seed signal honestly,
                    no need to shout it twice. */}
                <div className="text-xs text-[#5d6b80] dark:text-[#7a9bb8]">{item.sourceName.replace(/^\[MOCK\]\s*/i, "")}</div>
                <div className="text-xs text-[#5d6b80] dark:text-[#7a9bb8]">{new Date(item.publishedAt).toLocaleDateString("en-GB")}</div>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
