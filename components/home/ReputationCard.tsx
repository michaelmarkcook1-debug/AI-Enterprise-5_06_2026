import Link from "next/link";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import {
  CUSTOMER_REPUTATION,
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
  REPUTATION_VENDOR_IDS,
} from "@/lib/reputation/seed";
import ReputationTabs from "@/components/reputation/ReputationTabs";

// The complete three-pillar reputation tracker, embedded on Market watch (2026-07-10,
// un-buried from app/(internal)/reputation). Developer / Employee / Customer, each a
// sortable table with per-cell provenance. HONESTY: this is MIXED data — several
// columns are live (real API fetches, marked "✓ live" / "~ documented" per cell), and
// several are still curated seed (marked "seed"). Shown the same way the dependency
// graph, delivery channel and legislation register are: curated analyst reference,
// clearly labelled, never presented as live-DB fact. The per-cell labels + the banner
// below do the honesty work.

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default async function ReputationCard() {
  const vendors = await listIntelligenceVendors().catch(() => []);
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const rows = REPUTATION_VENDOR_IDS.map((id) => ({
    id,
    name: byId.get(id)?.name ?? id,
    slug: byId.get(id)?.slug ?? id,
    ownershipType: byId.get(id)?.ownershipType,
  }));

  return (
    <section className="mb-9 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">Reputation tracker</h2>
        <span className={`text-xs ${MUTED}`}>Developer · Employee · Customer — sortable, per-vendor</span>
      </div>
      <p className={`mb-3 max-w-3xl text-xs leading-5 ${MUTED}`}>
        Reputation across the three audiences that decide whether a vendor sticks. Several columns are
        live (GitHub, HackerNews, Statuspage incident feeds, CourtListener litigation records — marked
        <span className="mx-1 font-semibold text-emerald-700 dark:text-emerald-400">✓ live</span>per cell);
        employee and customer columns are curated analyst estimates (marked
        <span className="mx-1 font-semibold text-[#6b7d93] dark:text-[#7d93aa]">seed</span>) until their
        paid connectors (Glassdoor, G2) are wired — never presented as measured fact.
      </p>

      <ReputationTabs
        vendors={rows}
        developer={DEVELOPER_REPUTATION}
        employee={EMPLOYEE_REPUTATION}
        customer={CUSTOMER_REPUTATION}
      />

      <p className={`mt-3 text-[11px] ${MUTED}`}>
        Litigation &amp; API-reliability columns are the risk signals. Full methodology on each{" "}
        <Link href="/vendors" className="underline underline-offset-2 hover:no-underline">
          vendor profile
        </Link>
        .
      </p>
    </section>
  );
}
