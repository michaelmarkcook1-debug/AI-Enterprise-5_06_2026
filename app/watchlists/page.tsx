import { PageFrame } from "@/components/app-shell";
import { listIntelligenceVendors, listWatchlists } from "@/lib/intelligence/repository";
import { WatchlistManager } from "./WatchlistManager";

export const dynamic = "force-dynamic";

export default async function WatchlistsPage() {
  const [watchlists, vendors] = await Promise.all([listWatchlists(), listIntelligenceVendors()]);
  return (
    <PageFrame title="Watchlists and alerts" kicker="Monitoring setup" description="Create watchlists for vendors, industries, capability areas, risks, news types, market share movement, and regulation. Alerts are mock/generated in the MVP.">
      <WatchlistManager initialWatchlists={watchlists} vendorOptions={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, ownershipType: vendor.ownershipType }))} />
    </PageFrame>
  );
}
