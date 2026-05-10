import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listIntelligenceVendors, listVendorMomentum } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const [vendors, momentum] = await Promise.all([listIntelligenceVendors(), listVendorMomentum()]);
  const momentumByVendor = new Map(momentum.map((item) => [item.vendorId, item]));

  return (
    <PageFrame
      title="Provider intelligence"
      kicker="Vendor universe"
      description="Executive profiles for the enterprise AI providers that matter. Scores are directional and confidence-labelled."
    >
      <Panel title="Tracked providers">
        <div className="mb-4">
          <OwnershipLegend />
        </div>
        <div className="divide-y divide-[#edf0ea]">
          {vendors.sort((a, b) => b.overallScore - a.overallScore).map((vendor, index) => (
            <Link key={vendor.id} href={`/vendors/${vendor.slug}`} className="grid gap-4 py-4 md:grid-cols-[36px_1fr_160px_160px] md:items-center">
              <div className="font-mono text-sm text-[#697362]">{index + 1}</div>
              <div>
                <div className="text-base font-semibold text-[#18201b] dark:text-zinc-100">
                  <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} compactBadge={false} />
                </div>
                <div className="mt-1 text-sm text-[#596151]">{vendor.category} - {vendor.marketPosition}</div>
                <div className="mt-2 text-xs leading-5 text-[#66705f]">{vendor.description}</div>
              </div>
              <div>
                <ScoreBar label="Overall" value={vendor.overallScore} />
              </div>
              <div className="md:text-right">
                <Confidence value={vendor.confidenceScore} />
                <div className="mt-2 text-xs text-[#66705f]">Momentum {momentumByVendor.get(vendor.id)?.momentumScore ?? 0}/100</div>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
