"use client";

// Peer tab DEFAULT view — "what is the whole tracked enterprise base doing with
// AI", aggregated across every cited peer BEFORE the user narrows to their own
// segment (redesign 2026-07-06). Pure props from the server (lib/peer/aggregate-
// usage); the only client state is the use-case dropdown, which filters in-memory.
// Two honest layers per industry: cited BTOS adoption breadth + disclosed, cited
// vendor usage. Nothing synthesised; absence reads as "not cited yet", never zero-use.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { IndustryUsageRow, UseCaseOption, VendorUsageCell } from "@/lib/peer/aggregate-usage";
import { SimpleBarChart, StackedUsageBarChart, VendorColorLegend, assignVendorColors } from "./UsageBarChart";

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5";

export interface PeerUsageOverviewProps {
  rows: IndustryUsageRow[];
  topVendors: VendorUsageCell[];
  useCases: UseCaseOption[];
  asOf: string | null;
  coverage: { verticalsWithBenchmark: number; verticalsWithVendorUsage: number; companies: number };
  /** Bare vendorId → display name (TRACKED_VENDOR_NAMES). Link is /vendors/{id}. */
  vendorNames: Record<string, string>;
}

function prettyVendor(id: string): string {
  return id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PeerUsageOverview({
  rows,
  topVendors,
  useCases,
  asOf,
  coverage,
  vendorNames,
}: PeerUsageOverviewProps) {
  const [useCase, setUseCase] = useState<string>("");

  const filtered = useMemo(() => {
    if (!useCase) return rows;
    const match = useCases.find((u) => u.label === useCase);
    if (!match) return rows;
    const set = new Set(match.verticals);
    return rows.filter((r) => set.has(r.verticalId));
  }, [rows, useCases, useCase]);

  // Industries the USE-CASE VOCABULARY itself covers (has ANY cited top-use-case
  // for) — distinct from industries with disclosed vendor usage. Today this is
  // thin (compiled for financial services first), so a use-case filter can drop
  // industries — e.g. pharma — that DO have real disclosed vendor data but no
  // cited use-case label yet. Surfaced explicitly so that absence never reads as
  // "this industry doesn't do this" when the honest reading is "not catalogued yet".
  const useCaseCoveredVerticals = useMemo(() => {
    const set = new Set<string>();
    for (const u of useCases) for (const v of u.verticals) set.add(v);
    return set;
  }, [useCases]);
  const uncoveredWithVendorUsage = useMemo(
    () => rows.filter((r) => !useCaseCoveredVerticals.has(r.verticalId) && r.vendorUsage.length > 0),
    [rows, useCaseCoveredVerticals],
  );

  const vendorLink = (id: string) => (
    <Link
      key={id}
      href={`/vendors/${id}`}
      className="inline-flex items-baseline gap-1 rounded-full border border-black/10 px-2 py-0.5 text-[11px] hover:border-[#b08d2f] dark:border-white/10"
    >
      <span className="font-medium">{vendorNames[id] ?? prettyVendor(id)}</span>
    </Link>
  );

  // ONE color per vendor, stable across the whole-base chart AND every
  // industry's stacked bar — assigned in whole-base usage order (topVendors is
  // already sorted desc) so the biggest, most-recurring vendors get the most
  // distinguishable colors first.
  const vendorColors = useMemo(() => assignVendorColors(topVendors.map((v) => v.vendorId)), [topVendors]);
  const stackedRows = useMemo(
    () =>
      rows
        .filter((r) => r.vendorUsage.length > 0)
        .map((r) => ({
          key: r.verticalId,
          label: r.label,
          segments: r.vendorUsage.map((v) => ({
            vendorId: v.vendorId,
            vendorName: vendorNames[v.vendorId] ?? prettyVendor(v.vendorId),
            count: v.adopters,
          })),
        })),
    [rows, vendorNames],
  );

  return (
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            AI adoption across the tracked enterprise base
          </h2>
          <p className={`mt-1 max-w-2xl text-xs ${MUTED}`}>
            The whole cited peer base at a glance, before you narrow to your own segment. Two honest
            layers per industry: how widely the industry adopts AI (cited government survey), and
            which AI vendors named peers have <strong>publicly disclosed</strong> adopting.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className={`text-xs font-medium ${MUTED}`}>Use-case</span>
          <select
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            className="rounded-md border border-black/15 bg-white/80 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-[#0a1f38]"
          >
            <option value="">All use-cases</option>
            {useCases.map((u) => (
              <option key={u.label} value={u.label}>{u.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Most-adopted vendors across the disclosed base — colored bar chart */}
      {topVendors.length > 0 && !useCase && (
        <div className="mt-4 rounded-lg border border-black/5 p-3 dark:border-white/10">
          <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>
            Most-adopted across disclosed peers
          </div>
          <SimpleBarChart
            data={topVendors.map((v) => ({ vendorId: v.vendorId, label: vendorNames[v.vendorId] ?? prettyVendor(v.vendorId), value: v.adopters }))}
            colors={vendorColors}
            vendorHref={(id) => `/vendors/${id}`}
          />
        </div>
      )}

      {/* Industry usage BY vendor — stacked colored bar chart, one bar per
          industry, segmented by vendor. The visual answer to "who's used where". */}
      {stackedRows.length > 0 && !useCase && (
        <div className="mt-4 rounded-lg border border-black/5 p-3 dark:border-white/10">
          <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>
            Disclosed AI-vendor usage by industry
          </div>
          <StackedUsageBarChart rows={stackedRows} colors={vendorColors} vendorHref={(id) => `/vendors/${id}`} />
          <VendorColorLegend
            vendors={topVendors.map((v) => ({ vendorId: v.vendorId, name: vendorNames[v.vendorId] ?? prettyVendor(v.vendorId) }))}
            colors={vendorColors}
          />
        </div>
      )}

      {useCase && (
        <div className="mt-3 space-y-1">
          <p className={`text-[11px] ${MUTED}`}>
            Showing industries where <strong className="text-[#13294b] dark:text-[#eef3f8]">{useCase}</strong> is a
            top cited deployed use-case. This filters industries — it is not a claim that a specific vendor
            is used for this use-case.
          </p>
          <p className="text-[11px] leading-4 text-amber-700 dark:text-amber-300">
            Use-case labels are currently catalogued for {useCaseCoveredVerticals.size === 1 ? "one industry" : `${useCaseCoveredVerticals.size} industries`} only
            {uncoveredWithVendorUsage.length > 0 && (
              <>
                {" "}— {uncoveredWithVendorUsage.map((r) => r.label).join(", ")} has real disclosed AI-vendor
                adoption but no cited use-case label yet, so it drops out of this filter. Absence here means
                &quot;not catalogued yet,&quot; never &quot;this industry doesn&apos;t do this.&quot;
              </>
            )}
          </p>
        </div>
      )}

      {/* Industry rows: adoption breadth + disclosed vendor usage */}
      <div className="mt-4 space-y-2.5">
        {filtered.map((row) => (
          <IndustryRow key={row.verticalId} row={row} vendorLink={vendorLink} />
        ))}
        {filtered.length === 0 && (
          <p className={`text-sm ${MUTED}`}>No cited data for this use-case yet.</p>
        )}
      </div>

      <p className={`mt-4 text-[11px] leading-4 ${MUTED}`}>
        Breadth = cited US-Census BTOS AI-adoption rates ({coverage.verticalsWithBenchmark} industries).
        Vendor usage = publicly <strong>disclosed</strong>, cited adoptions by {coverage.companies} named
        peers ({coverage.verticalsWithVendorUsage} industries covered so far) — absence means no peer has
        disclosed it, never that no one uses it. {asOf ? `As of ${asOf}. ` : ""}Grows as new cited
        disclosures are ingested.
      </p>
    </section>
  );
}

function IndustryRow({
  row,
  vendorLink,
}: {
  row: IndustryUsageRow;
  vendorLink: (id: string) => ReactNode;
}) {
  return (
    <div className="rounded-lg border border-black/5 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{row.label}</span>
        {row.adoptionStat && (
          <span className={`text-[11px] ${MUTED}`}>
            {row.adoptionStat.headline}
            {row.adoptionStat.source?.url && (
              <>
                {" "}
                <a
                  href={row.adoptionStat.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[#13294b] dark:hover:text-[#eef3f8]"
                >
                  {row.adoptionStat.source.publisher}
                </a>
              </>
            )}
          </span>
        )}
      </div>
      <div className="mt-2">
        {row.vendorUsage.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>Disclosed vendors</span>
            {row.vendorUsage.map((v) => (
              <span key={v.vendorId} className="inline-flex items-center gap-1" title={v.companies.join(", ")}>
                {vendorLink(v.vendorId)}
                <span className={`text-[11px] tabular-nums ${MUTED}`}>{v.adopters}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className={`text-[11px] ${MUTED}`}>
            {row.companyCount > 0
              ? `${row.companyCount} named peer${row.companyCount === 1 ? "" : "s"} tracked — no disclosed AI-vendor adoption cited yet.`
              : "No named adopters cited yet — industry-adoption benchmark only."}
          </p>
        )}
      </div>
    </div>
  );
}
