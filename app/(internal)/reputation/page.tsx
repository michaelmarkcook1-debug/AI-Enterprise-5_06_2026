import { PageFrame } from "@/components/app-shell";
import { SeedDataBadge } from "@/components/intelligence-ui";
import {
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
  REPUTATION_VENDOR_IDS,
} from "@/lib/reputation/seed";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import ReputationTabs from "@/components/reputation/ReputationTabs";

export const dynamic = "force-dynamic";

export default async function ReputationPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

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
          <strong>Five columns now carry real data</strong> (fetched 2026-05-15, marked inline):
          GitHub (<code className="font-mono text-[10px]">api.github.com</code>),
          Forum (HackerNews Algolia API),
          API reliability (Atlassian Statuspage incidents, 8 vendors with accessible pages),
          and Litigation footprint (CourtListener API) are <strong>✓ verified</strong>.
          Reddit reception is <strong>~ documented</strong> — derived from average upvote-ratio only;
          search volume was discarded because unauthenticated Reddit search is name-ambiguity
          contaminated.{" "}
          <strong>Still curated seed:</strong> documentation score, Employee work-life / culture /
          career / comp, and all Customer metrics — these need Glassdoor (paid), G2/Capterra (paid),
          or NLP work.
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
