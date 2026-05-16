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
      <div className="mb-4 flex flex-wrap items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        <SeedDataBadge label="Mixed sources" provenance="live" reason="GitHub column is live (real API fetches with timestamps); other columns are curated until their connectors are wired." />
        <span>
          <strong>GitHub and Forum columns are real.</strong> GitHub values fetched from{" "}
          <code className="font-mono text-[10px]">api.github.com/repos/&#123;repo&#125;</code>; Forum values
          from the HackerNews Algolia API (12-month story window) — both fetched 2026-05-15, marked
          &ldquo;✓ live&rdquo; inline.{" "}
          <strong>Remaining columns (Reddit sentiment, API reliability, docs; all Employee + Customer
          metrics) are still curated seed</strong> with cited source domains — next to wire are
          Reddit (free API, sentiment needs NLP), Glassdoor (paid), CourtListener (free, litigation),
          and status-page archives.
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
