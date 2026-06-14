// Settings — data ingestion & spend.
// Hosts the ingestion cost calculator: the REAL estimated Anthropic API
// cost of a run, the staged model strategy, and the path to the admin
// run console. Built so the spend-cap decision can be made on numbers.

import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import IngestionCostPanel from "@/components/ingestion-cost-panel";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import { isRankable } from "@/lib/intelligence/roles";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const vendors = await listIntelligenceVendors();
  const vendorCount = vendors.filter(isRankable).length;

  return (
    <PageFrame
      title="Settings"
      kicker="Data ingestion & spend"
      description="Estimate the real cost of a full ingestion run before committing spend. Prices are Anthropic's published per-token rates; workload assumptions are editable and every stage line is reproducible."
    >
      <Panel title="Ingestion cost calculator">
        <IngestionCostPanel vendorCount={vendorCount} />
      </Panel>
    </PageFrame>
  );
}
