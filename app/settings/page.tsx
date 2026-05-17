import { PageFrame } from "@/components/app-shell";
import { listIntelligenceVendors, listWatchlists } from "@/lib/intelligence/repository";
import { WatchlistManager } from "../watchlists/WatchlistManager";

export const dynamic = "force-dynamic";

// Settings — the user's own configuration surface. Watchlists live
// here (moved out of the top nav in the May-2026 4-tab restructure):
// a watchlist is personal monitoring config, not a market-intelligence
// surface, so it belongs in Settings rather than as a primary tab.
export default async function SettingsPage() {
  const [watchlists, vendors] = await Promise.all([listWatchlists(), listIntelligenceVendors()]);

  return (
    <PageFrame
      title="Settings"
      kicker="Your workspace configuration"
      description="Personal configuration for the portal — watchlists, monitored vendors, and alert rules."
    >
      <section>
        <h2 className="text-base font-semibold text-[#18201b] dark:text-zinc-100">Watchlists & alerts</h2>
        <p className="mt-1 mb-4 max-w-3xl text-sm leading-6 text-[#596151] dark:text-zinc-400">
          Create watchlists for vendors, industries, capability areas, risks, news types,
          market-share movement, and regulation. Alerts are mock/generated in the MVP.
        </p>
        <WatchlistManager
          initialWatchlists={watchlists}
          vendorOptions={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, ownershipType: vendor.ownershipType }))}
        />
      </section>
    </PageFrame>
  );
}
