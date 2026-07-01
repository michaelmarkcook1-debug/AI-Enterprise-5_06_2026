import { PageFrame } from "@/components/app-shell";
import DataSourceRail from "@/components/data-source-rail";
import { Confidence, EstimatedNote, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listMarketCategories, listMarketShareEstimates, listVendorMomentum, listIntelligenceVendors } from "@/lib/intelligence/repository";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  const [categories, shares, momentum, vendors] = await Promise.all([
    listMarketCategories(),
    listMarketShareEstimates(),
    listVendorMomentum(),
    listIntelligenceVendors(),
  ]);
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  // Surface the freshest estimate date so directional figures are honestly dated.
  const asOf = shares.map((s) => s.sourceDate).filter(Boolean).sort().at(-1);
  const asOfLabel = asOf
    ? ` Figures as of ${new Date(asOf).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} (analyst estimate).`
    : "";

  return (
    <PageFrame aside={<DataSourceRail tab="market" />} title="Market share and momentum tracker" kicker="Category-specific market movement" description={`Market share is modelled by category. A vendor can lead one segment and be weak in another. Estimates are directional and confidence-labelled.${asOfLabel}`}>
      <div className="mb-5">
        <OwnershipLegend />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <Panel title="Category market share estimates">
          <div className="space-y-6">
            {categories.map((category) => {
              const rows = shares.filter((share) => share.categoryId === category.id).sort((a, b) => b.estimatedShare - a.estimatedShare).slice(0, 5);
              return (
                <section key={category.id}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{category.name}</div>
                      <div className="text-xs text-[#5d6b80]">{category.description}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {rows.map((share) => {
                      const vendor = vendorById.get(share.vendorId);
                      return (
                        <div key={`${share.vendorId}_${category.id}`} className="grid gap-2 md:grid-cols-[180px_1fr_80px] md:items-center">
                          <div className="text-sm">
                            {vendor ? <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /> : share.vendorId}
                          </div>
                          <ScoreBar value={share.estimatedShare} />
                          <div className="text-right text-xs"><Confidence value={share.confidence} /></div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </Panel>

        <Panel title="Momentum scores">
          <div className="space-y-4">
            {momentum.slice(0, 12).map((row) => {
              const vendor = vendorById.get(row.vendorId);
              return (
              <div key={row.vendorId}>
                <div className="mb-1 text-xs font-medium">
                  {vendor ? <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /> : row.vendorId}
                </div>
                <ScoreBar value={row.momentumScore} />
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-[#5d6b80]">
                  <span>Product {row.productVelocity}</span>
                  <span>Adoption {row.adoptionSignal}</span>
                  <span>Risk drag {row.riskSignal}</span>
                </div>
              </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <div className="mt-5 rounded-lg border border-[#e6dcc3] bg-[#f3ead2] p-4 dark:border-[#1d3a57] dark:bg-[#0c2238]"><EstimatedNote /></div>
    </PageFrame>
  );
}
