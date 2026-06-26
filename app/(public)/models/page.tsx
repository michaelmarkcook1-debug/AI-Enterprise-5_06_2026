import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import {
  getAllVendorSummaries,
  getDashboardSummary,
} from "@/lib/model-inventory/repository";
import { isLiveData } from "@/lib/intelligence/provenance";
import DataUnavailable from "@/components/DataUnavailable";

// ISR: server-rendered + CDN-cached, revalidated hourly. STRICT mode: the model
// inventory is hardcoded (lib/model-inventory/seed.ts), NOT live-DB verified
// evidence, so it only renders when the portal is evidence-backed.
export const revalidate = 3600;

const TITLE = "AI Model Inventory";
const DESCRIPTION =
  "The commercial model inventory across enterprise AI vendors — first-party vs hosted, with explicit data-freshness and verification labels. No unlabelled estimates.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/models" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/models"), type: "website" },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-1 text-xs ${MUTED}`}>{label}</div>
    </div>
  );
}

export default async function ModelsPage() {
  // STRICT: hold the hardcoded model inventory until evidence-backed.
  if (!(await isLiveData())) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
          <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>{DESCRIPTION}</p>
        </header>
        <DataUnavailable
          title="Model inventory unavailable"
          detail="The commercial model inventory appears only when backed by analyst-verified evidence in our live data store. No verified evidence has been ingested yet, so we hold it rather than show a hardcoded inventory as if current."
        />
      </main>
    );
  }

  const summary = getDashboardSummary();
  const vendors = getAllVendorSummaries()
    .slice()
    .sort((a, b) => b.firstPartyActiveCount - a.firstPartyActiveCount || a.vendorName.localeCompare(b.vendorName));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>{DESCRIPTION}</p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Vendors tracked" value={summary.totalTrackedVendors} />
        <Stat label="With first-party models" value={summary.vendorsWithFirstPartyModels} />
        <Stat label="Hosting third-party models" value={summary.vendorsWithHostedThirdPartyModels} />
        <Stat label="Unknown / unverified" value={summary.vendorsUnknownOrUnverified} />
        <Stat label="Stale inventories" value={summary.staleInventoryCount} />
      </section>

      <section className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={`text-left ${MUTED}`}>
                <th className="py-2 pr-4 font-medium">Vendor</th>
                <th className="py-2 pr-4 font-medium tabular-nums">First-party</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Hosted 3P</th>
                <th className="py-2 pr-4 font-medium">Primary families</th>
                <th className="py-2 pr-4 font-medium">Data status</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendorId} className="border-t border-black/5 dark:border-white/10 align-top">
                  <td className="py-2 pr-4 font-medium">
                    {v.vendorName}
                    {v.uncertaintyBadge ? (
                      <span className={`ml-2 text-xs ${MUTED}`}>· {v.uncertaintyBadge}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{v.firstPartyActiveCount}</td>
                  <td className="py-2 pr-4 tabular-nums">{v.hostedThirdPartyCount}</td>
                  <td className="py-2 pr-4">{v.primaryModelFamilies.slice(0, 3).join(", ") || "—"}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded-full border border-black/10 dark:border-white/15 px-2 py-0.5 text-xs">
                      {v.dataStatus}
                    </span>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{Math.round(v.confidenceScore)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-4 text-xs ${MUTED}`}>
          Counts reflect source-backed records only. Vendors marked seed/unknown have insufficient
          verified evidence and are reported as such rather than estimated upward.
        </p>
      </section>

      <p className={`mt-6 text-sm ${MUTED}`}>
        Looking for vendor rankings? See the{" "}
        <Link href="/vendors" className="underline underline-offset-2">
          full vendor leaderboard
        </Link>
        .
      </p>
    </main>
  );
}
