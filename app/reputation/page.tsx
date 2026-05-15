import { PageFrame } from "@/components/app-shell";
import { SeedDataBadge } from "@/components/intelligence-ui";
import {
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
  REPUTATION_VENDOR_IDS,
} from "@/lib/reputation/seed";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import ReputationTabs from "./ReputationTabs";

export const dynamic = "force-dynamic";

export default async function ReputationPage() {
  const vendors = await listIntelligenceVendors();
  // Build a lookup of vendor metadata for the rows; fall back to a
  // bare label when no curated vendor exists yet (defensive).
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const rows = REPUTATION_VENDOR_IDS.map((id) => ({
    id,
    name: byId.get(id)?.name ?? id,
    slug: byId.get(id)?.slug ?? id,
    ownershipType: byId.get(id)?.ownershipType,
  }));

  return (
    <PageFrame
      title="Reputation tracker"
      kicker="Three-pillar reputation across developers, employees, and customers"
      description="Per-vendor reputation aggregated from public sources. Developer signals come from GitHub, Reddit, and developer forums (devs USING the vendor, not employees of it). Employee signals come from Glassdoor, LinkedIn, and tribunal-filing records. Customer signals come from G2, Capterra, TrustRadius, and status-page archives."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
        <SeedDataBadge label="Seed scores" provenance="seed" reason="Until reputation ingestion is wired (Glassdoor / GitHub API / Reddit / status-page history), every cell renders from curated seed data with cited source domains." />
        <span>
          Every cell is curated from public signals but not yet machine-verified.
          Source domains are listed per row; cells flip to <strong>documented</strong> once a connector emits a verifiable extract.
        </span>
      </div>

      <ReputationTabs
        vendors={rows}
        developer={DEVELOPER_REPUTATION}
        employee={EMPLOYEE_REPUTATION}
        customer={CUSTOMER_REPUTATION}
      />
    </PageFrame>
  );
}
