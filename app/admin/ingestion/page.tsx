import IngestionConsole from "./IngestionConsole";
import ManifestPatchesPanel from "@/components/admin/ManifestPatchesPanel";
import { listIngestionJobs } from "@/lib/ingestion/ingest-service";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { SOURCE_MANIFEST } from "@/lib/sourcing/manifest";
import { getLatestAdminRun } from "@/lib/system/admin-run-log";
import { listActiveJobs, type AdminJob } from "@/lib/system/admin-job-store";
import Link from "next/link";

import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  trust_center: "Trust centre",
  vendor_docs: "Vendor docs",
  pricing_page: "Pricing page",
  status_page: "Status page",
  changelog: "Changelog",
  public_filing: "Public filing",
  job_posting: "Job posting",
  review_platform: "Review platform",
  marketplace: "Marketplace",
  github: "GitHub",
  analyst_report: "Analyst report",
  press_release: "Press release / News",
};

async function listPendingManifestPatches() {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().manifestPatch.findMany({
      where: { status: "pending" },
      orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      category: r.category,
      deadUrl: r.deadUrl,
      httpStatus: r.httpStatus,
      candidateUrl: r.candidateUrl,
      candidateTitle: r.candidateTitle,
      confidenceScore: r.confidenceScore,
      rationale: r.rationale,
      citations: r.citations,
      searchesUsed: r.searchesUsed,
      retryAttempted: r.retryAttempted,
      retryOk: r.retryOk,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Summary of SOURCE_MANIFEST grouped by category. */
function buildManifestSummary() {
  const byCategory: Record<string, { count: number; vendors: Set<string> }> = {};
  for (const entry of SOURCE_MANIFEST) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = { count: 0, vendors: new Set() };
    }
    byCategory[entry.category].count += 1;
    byCategory[entry.category].vendors.add(entry.vendorId);
  }
  return byCategory;
}

/** All entries for the press_release category. */
const pressReleaseEntries = SOURCE_MANIFEST.filter((e) => e.category === "press_release");

/**
 * Count of verified evidence signals a recompute will project. This is the EXACT
 * set the projector scans (reviewStatus = "analyst_verified"), so the number
 * shown on the Recompute card matches `scannedEvidenceRows` in the run result.
 * The projector caps each run at 5,000 rows — the UI flags that ceiling if hit.
 */
async function countVerifiedSignals(): Promise<number | null> {
  if (!hasDatabase()) return null;
  try {
    return await getPrisma().evidenceRecord.count({
      where: { reviewStatus: "analyst_verified" },
    });
  } catch {
    return null;
  }
}

export default async function IngestionPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const [jobs, patches, lastRun, activeJobList, verifiedSignals] = await Promise.all([
    hasDatabase() ? listIngestionJobs() : Promise.resolve([]),
    listPendingManifestPatches(),
    hasDatabase() ? getLatestAdminRun() : Promise.resolve(null),
    hasDatabase() ? listActiveJobs() : Promise.resolve([] as AdminJob[]),
    countVerifiedSignals(),
  ]);
  // In-flight background jobs keyed by kind, so the console re-attaches to a run
  // that started before the user navigated back (the "survive tab switch" path).
  const activeJobs: Record<string, AdminJob | null> = {};
  for (const j of activeJobList) if (!activeJobs[j.kind]) activeJobs[j.kind] = j;

  const manifestSummary = buildManifestSummary();
  // The console operates on the SOURCE_MANIFEST (that's what sourcing iterates),
  // so derive selectable vendors from the manifest itself — NOT the vendor-profiles
  // table. The manifest keys vendors as `vendor_openai` while the profile table
  // uses bare `openai`, so intersecting them produced an EMPTY list (the "0 news
  // vendors / can't select a vendor" bug). Manifest ids are also exactly what
  // runSourcing / runNewsSourcing expect, so the buttons resolve correctly.
  const vendors = [...new Set(SOURCE_MANIFEST.map((e) => e.vendorId))]
    .sort()
    .map((id) => ({ id, name: id.replace(/^vendor_/, "") }));
  const newsVendors = [...new Set(pressReleaseEntries.map((e) => e.vendorId))]
    .sort()
    .map((id) => ({ id, name: id.replace(/^vendor_/, "") }));

  return (
    <>
      <IngestionConsole
        hasDatabase={hasDatabase()}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
        initialJobs={jobs.map((j) => ({
          id: j.id,
          vendorId: j.vendorId,
          status: j.status,
          proposalsCount: j.proposalsCount,
          createdAt: j.createdAt.toISOString(),
          error: j.error ?? undefined,
        }))}
        newsVendors={newsVendors}
        lastRun={lastRun}
        activeJobs={activeJobs}
        verifiedSignals={verifiedSignals}
      />

      {/* ── Manifest sources breakdown ─────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="text-xl font-semibold text-[#15263c] dark:text-[#eef3f8]">Source manifest</h2>
        <p className="mt-1 text-sm text-[#3f5068] dark:text-[#a7bacd]">
          {SOURCE_MANIFEST.length} configured sources across {Object.keys(manifestSummary).length} categories.
          Press-release entries are processed by the news pipeline (daily 05:05 UTC), all others by the rolling pipeline (03:05 UTC).
        </p>

        {/* Category summary cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(manifestSummary)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, info]) => (
              <div
                key={cat}
                className={`rounded-xl border px-4 py-3 ${
                  cat === "press_release"
                    ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
                    : "border-[#e3d9c0] bg-white dark:border-[#1d3a57] dark:bg-[#0c2238]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4c5d75] dark:text-[#7a9bb8]">
                  {CATEGORY_LABELS[cat] ?? cat}
                  {cat === "press_release" && (
                    <span className="ml-1 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>
                  )}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[#15263c] dark:text-[#eef3f8]">
                  {info.count}
                </div>
                <div className="text-xs text-[#4c5d75] dark:text-[#7a9bb8]">
                  {info.vendors.size} vendor{info.vendors.size !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
        </div>

        {/* Press-release sources detail table */}
        <h3 className="mt-8 text-base font-semibold text-[#15263c] dark:text-[#eef3f8]">
          Press release &amp; news sources
          <span className="ml-2 text-sm font-normal text-[#4c5d75]">— processed by the news pipeline</span>
        </h3>
        <div className="mt-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-[#0c2238] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sky-50 dark:bg-sky-950/30">
              <tr className="text-left text-xs uppercase text-sky-700 dark:text-sky-400">
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Listing URL</th>
                <th className="px-4 py-2 font-medium">Freshness</th>
                <th className="px-4 py-2 font-medium">Expected domains</th>
              </tr>
            </thead>
            <tbody>
              {pressReleaseEntries.map((e) => (
                <tr key={e.url} className="border-t border-sky-100 dark:border-sky-900/40">
                  <td className="px-4 py-2 font-mono text-xs text-[#4c5d75]">
                    {e.vendorId.replace("vendor_", "")}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.label}</td>
                  <td className="px-4 py-2 max-w-xs">
                    <Link
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 dark:text-sky-400 hover:underline truncate block text-xs font-mono"
                    >
                      {e.url}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-[#4c5d75] tabular-nums">
                    {e.freshnessHorizonDays}d
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {e.expectedDomains.map((d) => (
                        <span key={d} className="inline-block rounded bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* All other sources — collapsed summary */}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-[#4c5d75] hover:text-[#15263c] dark:hover:text-[#eef3f8] select-none">
            ▸ View all {SOURCE_MANIFEST.filter((e) => e.category !== "press_release").length} standard sources
          </summary>
          <div className="mt-3 rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f1e3] dark:bg-[#071827]">
                <tr className="text-left text-xs uppercase text-[#4c5d75]">
                  <th className="px-4 py-2 font-medium">Vendor</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">URL</th>
                  <th className="px-4 py-2 font-medium">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_MANIFEST.filter((e) => e.category !== "press_release").map((e) => (
                  <tr key={e.url} className="border-t border-[#ece4d0] dark:border-[#1d3a57]">
                    <td className="px-4 py-2 font-mono text-xs text-[#4c5d75]">
                      {e.vendorId.replace("vendor_", "")}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className="inline-block rounded bg-[#ece3cb] dark:bg-[#143049] px-1.5 py-0.5 text-[10px] text-[#3f5068] dark:text-[#a7bacd]">
                        {CATEGORY_LABELS[e.category as string] ?? e.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">{e.label}</td>
                    <td className="px-4 py-2 max-w-xs">
                      <Link
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#4c5d75] hover:underline truncate block text-xs font-mono"
                      >
                        {e.url}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs tabular-nums text-[#4c5d75]">{e.freshnessHorizonDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <ManifestPatchesPanel patches={patches} />
    </>
  );
}
