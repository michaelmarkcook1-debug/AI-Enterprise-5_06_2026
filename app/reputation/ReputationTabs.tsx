"use client";

import { useState } from "react";
import type {
  CustomerReputation,
  DeveloperReputation,
  EmployeeReputation,
} from "@/lib/reputation/seed";

type Pillar = "developer" | "employee" | "customer";

interface VendorRow {
  id: string;
  name: string;
  slug: string;
  ownershipType?: string;
}

const PILLARS: { id: Pillar; label: string; hint: string }[] = [
  { id: "developer", label: "Developer", hint: "GitHub · Reddit · forums — devs USING the vendor" },
  { id: "employee", label: "Employee", hint: "Glassdoor · LinkedIn · tribunal filings" },
  { id: "customer", label: "Customer", hint: "G2 · Capterra · TrustRadius · status-page archive" },
];

export default function ReputationTabs({
  vendors, developer, employee, customer,
}: {
  vendors: VendorRow[];
  developer: DeveloperReputation[];
  employee: EmployeeReputation[];
  customer: CustomerReputation[];
}) {
  const [active, setActive] = useState<Pillar>("developer");
  const [sortBy, setSortBy] = useState<string>("overall");
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const activeHint = PILLARS.find((p) => p.id === active)?.hint ?? "";

  return (
    <div>
      {/* Pillar tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {PILLARS.map((p) => {
          const isActive = p.id === active;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { setActive(p.id); setSortBy("overall"); setSortDesc(true); }}
              className={`relative -mb-px px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-zinc-500">{activeHint}</span>
      </div>

      {active === "developer" && (
        <DeveloperTable
          vendors={vendors}
          rows={developer}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSort={(key) => {
            if (sortBy === key) setSortDesc((d) => !d);
            else { setSortBy(key); setSortDesc(true); }
          }}
        />
      )}
      {active === "employee" && (
        <EmployeeTable
          vendors={vendors}
          rows={employee}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSort={(key) => {
            if (sortBy === key) setSortDesc((d) => !d);
            else { setSortBy(key); setSortDesc(true); }
          }}
        />
      )}
      {active === "customer" && (
        <CustomerTable
          vendors={vendors}
          rows={customer}
          sortBy={sortBy}
          sortDesc={sortDesc}
          onSort={(key) => {
            if (sortBy === key) setSortDesc((d) => !d);
            else { setSortBy(key); setSortDesc(true); }
          }}
        />
      )}
    </div>
  );
}

// ──────────────── Shared cell renderers ────────────────

function ScoreCell({ value, suffix }: { value: number; suffix?: string }) {
  const tone =
    value >= 80 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : value >= 65 ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <span className={`inline-block min-w-[42px] rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold tabular-nums ${tone}`}>
      {value.toFixed(suffix === "%" ? 1 : 0)}{suffix ?? ""}
    </span>
  );
}

function VendorCell({ vendor, slug }: { vendor: string; slug?: string }) {
  if (!slug) return <span className="font-semibold text-zinc-900 dark:text-zinc-100">{vendor}</span>;
  return (
    <a href={`/vendors/${slug}`} className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
      {vendor}
    </a>
  );
}

// Stable rank badge — ranks each vendor by overall score within the
// pillar. Stays fixed even when the table is sorted by another column.
function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
      : rank === 2
        ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
        : rank === 3
          ? "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${tone}`}
      title={`Rank ${rank} by overall score in this pillar`}
    >
      {rank}
    </span>
  );
}

/** Build a vendorId → rank map, ranked by overall score descending. */
function rankMap<T extends { vendorId: string; overall: number }>(rows: T[]): Map<string, number> {
  const m = new Map<string, number>();
  [...rows].sort((a, b) => b.overall - a.overall).forEach((r, i) => m.set(r.vendorId, i + 1));
  return m;
}

function ThemesCell({ themes }: { themes: string[] }) {
  return (
    <ul className="space-y-0.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
      {themes.map((t) => <li key={t}>· {t}</li>)}
    </ul>
  );
}

function SourcesCell({ sources }: { sources: string[] }) {
  return (
    <ul className="space-y-0.5 text-[10px] text-zinc-500">
      {sources.slice(0, 3).map((s) => <li key={s} className="truncate">{s.replace(/^https?:\/\//, "").replace(/\/$/, "")}</li>)}
    </ul>
  );
}

function SortHeader({ label, active, desc, onClick, align = "right" }: { label: string; active: boolean; desc: boolean; onClick: () => void; align?: "left" | "right" }) {
  return (
    <th className={`whitespace-nowrap px-2 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${active ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
      >
        {label}
        {active && <span aria-hidden>{desc ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}

// ──────────────── Developer table ────────────────

function DeveloperTable({
  vendors, rows, sortBy, sortDesc, onSort,
}: {
  vendors: VendorRow[];
  rows: DeveloperReputation[];
  sortBy: string; sortDesc: boolean; onSort: (key: string) => void;
}) {
  type Joined = VendorRow & DeveloperReputation;
  const byId = new Map(rows.map((r) => [r.vendorId, r]));
  const joined: Joined[] = vendors
    .map((v) => {
      const r = byId.get(v.id);
      return r ? { ...v, ...r } : null;
    })
    .filter((x): x is Joined => x !== null);
  const ranks = rankMap(joined);
  const sorted = [...joined].sort((a, b) => {
    const av = (a as unknown as Record<string, number | string>)[sortBy] ?? a.overall;
    const bv = (b as unknown as Record<string, number | string>)[sortBy] ?? b.overall;
    if (typeof av === "number" && typeof bv === "number") {
      return sortDesc ? bv - av : av - bv;
    }
    return 0;
  });
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">#</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Vendor</th>
            <SortHeader label="GitHub" active={sortBy === "githubScore"} desc={sortDesc} onClick={() => onSort("githubScore")} />
            <SortHeader label="Reddit" active={sortBy === "redditSentiment"} desc={sortDesc} onClick={() => onSort("redditSentiment")} />
            <SortHeader label="Forums" active={sortBy === "forumScore"} desc={sortDesc} onClick={() => onSort("forumScore")} />
            <SortHeader label="API rel." active={sortBy === "apiReliability"} desc={sortDesc} onClick={() => onSort("apiReliability")} />
            <SortHeader label="Docs" active={sortBy === "documentationScore"} desc={sortDesc} onClick={() => onSort("documentationScore")} />
            <SortHeader label="Overall" active={sortBy === "overall"} desc={sortDesc} onClick={() => onSort("overall")} />
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">What devs talk about</th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Sources</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2.5 align-top"><RankBadge rank={ranks.get(r.vendorId) ?? 0} /></td>
              <td className="px-3 py-2.5 align-top"><VendorCell vendor={r.name} slug={r.slug} /></td>
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <ScoreCell value={r.githubScore} />
                  {r.cellStatus?.github === "verified" && r.githubRepo && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                      title={`Real-time GitHub API fetch · ${r.githubRepo} · ${r.githubStars?.toLocaleString() ?? "?"} stars · fetched ${r.githubLastFetched}`}
                    >
                      ✓ live · {r.githubStars && r.githubStars >= 1000 ? `${(r.githubStars / 1000).toFixed(1)}k★` : `${r.githubStars}★`}
                    </span>
                  )}
                  {r.cellStatus?.github === "seed" && !r.githubRepo && (
                    <span className="text-[9px] italic text-zinc-500" title="No public flagship repo">no repo</span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <ScoreCell value={r.redditSentiment} />
                  {r.cellStatus?.reddit === "documented" && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400"
                      title={`Reddit search API · score derived from average upvote-ratio ${r.redditUpvoteRatio ?? "?"} · volume discarded (name-ambiguity contamination) · fetched ${r.redditLastFetched}`}
                    >
                      ~ documented
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <ScoreCell value={r.forumScore} />
                  {r.cellStatus?.forum === "verified" && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                      title={`Live HackerNews API fetch · ${r.forumHnHits?.toLocaleString() ?? "?"} stories in the last 12 months · fetched ${r.forumLastFetched}`}
                    >
                      ✓ live · {r.forumHnHits?.toLocaleString() ?? "?"} HN
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <ScoreCell value={r.apiReliability} />
                  {r.cellStatus?.api === "verified" && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                      title={`Atlassian Statuspage incidents.json · ${r.apiIncidents90d ?? "?"} incidents in 90d (${r.apiMajorIncidents90d ?? "?"} major) · fetched ${r.apiLastFetched}`}
                    >
                      ✓ live · {r.apiIncidents90d ?? "?"}/90d
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.documentationScore} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.overall} /></td>
              <td className="max-w-xs px-2 py-2.5 align-top"><ThemesCell themes={r.primaryThemes} /></td>
              <td className="px-2 py-2.5 align-top"><SourcesCell sources={r.sources} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────── Employee table ────────────────

function EmployeeTable({
  vendors, rows, sortBy, sortDesc, onSort,
}: {
  vendors: VendorRow[];
  rows: EmployeeReputation[];
  sortBy: string; sortDesc: boolean; onSort: (key: string) => void;
}) {
  type Joined = VendorRow & EmployeeReputation;
  const byId = new Map(rows.map((r) => [r.vendorId, r]));
  const joined: Joined[] = vendors
    .map((v) => {
      const r = byId.get(v.id);
      return r ? { ...v, ...r } : null;
    })
    .filter((x): x is Joined => x !== null);
  const ranks = rankMap(joined);
  const sorted = [...joined].sort((a, b) => {
    const av = (a as unknown as Record<string, number | string>)[sortBy] ?? a.overall;
    const bv = (b as unknown as Record<string, number | string>)[sortBy] ?? b.overall;
    if (typeof av === "number" && typeof bv === "number") {
      return sortDesc ? bv - av : av - bv;
    }
    return 0;
  });
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[1000px] text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">#</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Vendor</th>
            <SortHeader label="Work / life" active={sortBy === "workLifeBalance"} desc={sortDesc} onClick={() => onSort("workLifeBalance")} />
            <SortHeader label="Culture" active={sortBy === "culture"} desc={sortDesc} onClick={() => onSort("culture")} />
            <SortHeader label="Litigation" active={sortBy === "litigationScore"} desc={sortDesc} onClick={() => onSort("litigationScore")} />
            <SortHeader label="Mission fit" active={sortBy === "missionAlignment"} desc={sortDesc} onClick={() => onSort("missionAlignment")} />
            <SortHeader label="Career growth" active={sortBy === "careerGrowth"} desc={sortDesc} onClick={() => onSort("careerGrowth")} />
            <SortHeader label="Comp" active={sortBy === "compensation"} desc={sortDesc} onClick={() => onSort("compensation")} />
            <SortHeader label="Overall" active={sortBy === "overall"} desc={sortDesc} onClick={() => onSort("overall")} />
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">What employees say</th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Sources</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2.5 align-top"><RankBadge rank={ranks.get(r.vendorId) ?? 0} /></td>
              <td className="px-3 py-2.5 align-top"><VendorCell vendor={r.name} slug={r.slug} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.workLifeBalance} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.culture} /></td>
              {/* Litigation cell — the primary number is the 0-100
                  litigation SCORE (consistent with every other column).
                  Higher = less litigation exposure. The score now
                  derives from the per-1,000-employee rate, so colour,
                  score, footprint and rate all agree. Footprint + rate
                  shown below as the real-data evidence. */}
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <span title={`Litigation score ${r.litigationScore}/100 — higher = lower litigation exposure per employee.`}>
                    <ScoreCell value={r.litigationScore} />
                  </span>
                  {r.cellStatus?.litigation === "verified" && r.litigationFootprint !== undefined && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                      title={`CourtListener — ${r.litigationFootprint.toLocaleString()} employment-related court records filed in the last 24 months. Fetched ${r.litigationLastFetched}.`}
                    >
                      ✓ {r.litigationFootprint >= 1000 ? `${(r.litigationFootprint / 1000).toFixed(1)}k` : r.litigationFootprint} CL
                    </span>
                  )}
                  {r.litigationPerThousand !== undefined && r.approxHeadcount !== undefined && (
                    <span
                      className="text-[9px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-400"
                      title={`Score basis: ${r.litigationFootprint?.toLocaleString()} records (last 24 months) ÷ ~${r.approxHeadcount.toLocaleString()} employees × 1000 = ${r.litigationPerThousand} per 1,000. Headcount is a current estimate — directional, not exact.`}
                    >
                      {r.litigationPerThousand}/1k emp
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top">
                <div className="inline-flex flex-col items-end gap-0.5">
                  <ScoreCell value={r.missionAlignment} />
                  <span
                    className="text-[9px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600"
                    title="Alignment between stated mission and lived employee experience. Curated seed — no free API exists for this metric."
                  >
                    seed
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.careerGrowth} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.compensation} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.overall} /></td>
              <td className="max-w-xs px-2 py-2.5 align-top"><ThemesCell themes={r.primaryThemes} /></td>
              <td className="px-2 py-2.5 align-top"><SourcesCell sources={r.sources} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────── Customer table ────────────────

function CustomerTable({
  vendors, rows, sortBy, sortDesc, onSort,
}: {
  vendors: VendorRow[];
  rows: CustomerReputation[];
  sortBy: string; sortDesc: boolean; onSort: (key: string) => void;
}) {
  type Joined = VendorRow & CustomerReputation;
  const byId = new Map(rows.map((r) => [r.vendorId, r]));
  const joined: Joined[] = vendors
    .map((v) => {
      const r = byId.get(v.id);
      return r ? { ...v, ...r } : null;
    })
    .filter((x): x is Joined => x !== null);
  const ranks = rankMap(joined);
  const sorted = [...joined].sort((a, b) => {
    const av = (a as unknown as Record<string, number | string>)[sortBy] ?? a.overall;
    const bv = (b as unknown as Record<string, number | string>)[sortBy] ?? b.overall;
    if (typeof av === "number" && typeof bv === "number") {
      return sortDesc ? bv - av : av - bv;
    }
    return 0;
  });
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full min-w-[1000px] text-left text-xs">
        <thead className="border-b border-zinc-200 bg-zinc-50/60 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">#</th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Vendor</th>
            <SortHeader label="Uptime" active={sortBy === "averageUptimePct"} desc={sortDesc} onClick={() => onSort("averageUptimePct")} />
            <SortHeader label="Value / $" active={sortBy === "valueForMoney"} desc={sortDesc} onClick={() => onSort("valueForMoney")} />
            <SortHeader label="Cust. svc." active={sortBy === "customerService"} desc={sortDesc} onClick={() => onSort("customerService")} />
            <SortHeader label="Resp." active={sortBy === "responsiveness"} desc={sortDesc} onClick={() => onSort("responsiveness")} />
            <SortHeader label="Quality" active={sortBy === "qualityOfService"} desc={sortDesc} onClick={() => onSort("qualityOfService")} />
            <SortHeader label="Overall" active={sortBy === "overall"} desc={sortDesc} onClick={() => onSort("overall")} />
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">What customers say</th>
            <th className="whitespace-nowrap px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Sources</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2.5 align-top"><RankBadge rank={ranks.get(r.vendorId) ?? 0} /></td>
              <td className="px-3 py-2.5 align-top"><VendorCell vendor={r.name} slug={r.slug} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.averageUptimePct} suffix="%" /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.valueForMoney} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.customerService} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.responsiveness} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.qualityOfService} /></td>
              <td className="px-2 py-2.5 text-right align-top"><ScoreCell value={r.overall} /></td>
              <td className="max-w-xs px-2 py-2.5 align-top"><ThemesCell themes={r.primaryThemes} /></td>
              <td className="px-2 py-2.5 align-top"><SourcesCell sources={r.sources} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
