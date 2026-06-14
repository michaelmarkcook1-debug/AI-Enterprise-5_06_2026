// Settings — backend control hub.
// Central view linking every backend function: pipeline health, evidence
// queue, sourcing manifest, data connectors, and the cost calculator.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import IngestionCostPanel from "@/components/ingestion-cost-panel";
import { listIntelligenceVendors } from "@/lib/intelligence/repository";
import { isRankable } from "@/lib/intelligence/roles";
import { SOURCE_MANIFEST } from "@/lib/sourcing/manifest";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { getQueueHealthSummary, EMPTY_QUEUE_HEALTH } from "@/lib/services/queue-health";
import { getLastRefreshRun } from "@/lib/system/daily-refresh-store";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  trust_center: "Trust centre",
  vendor_docs: "Vendor docs",
  pricing_page: "Pricing",
  status_page: "Status",
  changelog: "Changelog",
  public_filing: "Filings",
  job_posting: "Jobs",
  review_platform: "Reviews",
  marketplace: "Marketplace",
  github: "GitHub",
  analyst_report: "Analyst reports",
  press_release: "Press releases",
};

function buildCategorySummary() {
  const out: Record<string, { count: number; vendors: number }> = {};
  const vendorsByCategory: Record<string, Set<string>> = {};
  for (const e of SOURCE_MANIFEST) {
    out[e.category] = out[e.category] ?? { count: 0, vendors: 0 };
    out[e.category].count++;
    vendorsByCategory[e.category] ??= new Set();
    vendorsByCategory[e.category].add(e.vendorId);
  }
  for (const cat of Object.keys(out)) {
    out[cat].vendors = vendorsByCategory[cat].size;
  }
  return out;
}

export default async function SettingsPage() {
  const [vendors, queueHealth, lastRefresh] = await Promise.all([
    listIntelligenceVendors(),
    hasDatabase() ? getQueueHealthSummary(getPrisma()) : Promise.resolve(EMPTY_QUEUE_HEALTH),
    getLastRefreshRun(),
  ]);

  const vendorCount = vendors.filter(isRankable).length;
  const categorySummary = buildCategorySummary();
  const pressReleaseCount = categorySummary["press_release"]?.count ?? 0;
  const pressReleaseVendors = categorySummary["press_release"]?.vendors ?? 0;

  const lastRefreshOk = lastRefresh
    ? Object.values(lastRefresh.steps ?? {}).every((s: { ok?: boolean }) => s.ok !== false)
    : null;
  const lastRefreshAge = lastRefresh
    ? Math.floor((Date.now() - new Date(lastRefresh.startedAt).getTime()) / (1000 * 60 * 60))
    : null;

  return (
    <PageFrame
      title="Settings"
      kicker="Backend control hub"
      description="Monitor pipeline health, review the evidence queue, inspect sourcing sources, and estimate ingestion costs before committing spend."
    >
      {/* ── Quick action grid ─────────────────────────────────────────── */}
      <Panel title="Backend functions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/admin/ingestion"
            title="Ingestion"
            description="Trigger rolling or news-sourcing pipelines, view recent jobs, inspect the source manifest."
            badge={null}
            badgeColor="emerald"
            icon="⚙"
          />
          <ActionCard
            href="/admin/evidence/batch"
            title="Evidence review"
            description="Approve or reject pending evidence proposals in bulk. The fast path for clearing the queue."
            badge={queueHealth.freshActionableCount > 0 ? `${queueHealth.freshActionableCount} to review` : null}
            badgeColor="amber"
            icon="✓"
          />
          <ActionCard
            href="/admin/pipeline-health"
            title="Pipeline health"
            description="Daily-refresh step status, competitive-intel monitor, and last-run diagnostics."
            badge={
              lastRefreshAge !== null
                ? lastRefreshOk
                  ? `Last run ${lastRefreshAge}h ago · OK`
                  : `Last run ${lastRefreshAge}h ago · issues`
                : "No runs yet"
            }
            badgeColor={lastRefreshOk === false ? "red" : "emerald"}
            icon="◎"
          />
          <ActionCard
            href="/admin/data-sources"
            title="Data sources"
            description="Per-connector health for programmatic sources (SEC, FRED, BLS, EIA, GitHub…)."
            badge={null}
            badgeColor="sky"
            icon="⬡"
          />
          <ActionCard
            href="/admin/production-status"
            title="Production status"
            description="Env-var gates and the production readiness contract. Check before a deploy."
            badge={null}
            badgeColor="violet"
            icon="▲"
          />
          <ActionCard
            href="/admin/exposure-edits"
            title="Exposure-map edits"
            description="Propose adds / updates / removals to the indirect-exposure graph."
            badge={null}
            badgeColor="slate"
            icon="◈"
          />
        </div>
      </Panel>

      {/* ── Evidence queue snapshot ───────────────────────────────────── */}
      <Panel title="Evidence queue">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Total pending" value={queueHealth.totalPending} />
          <Stat label="Actionable" value={queueHealth.freshActionableCount} highlight={queueHealth.freshActionableCount > 0} />
          <Stat label="Deferred" value={queueHealth.deferredCount} />
          <Stat label="Stale (>30d)" value={queueHealth.staleCount} highlight={queueHealth.staleCount > 0} warn />
        </div>
        {queueHealth.freshActionableCount > 0 && (
          <div className="mt-4">
            <Link
              href="/admin/evidence/batch"
              className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
            >
              Review {queueHealth.freshActionableCount} actionable proposals →
            </Link>
          </div>
        )}
      </Panel>

      {/* ── Source manifest summary ───────────────────────────────────── */}
      <Panel title={`Source manifest — ${SOURCE_MANIFEST.length} sources`}>
        <p className="text-sm text-[#4c5d75] dark:text-[#a7bacd] mb-4">
          {vendorCount} rankable vendors · {Object.keys(categorySummary).length} source categories.
          Press-release sources ({pressReleaseCount} URLs across {pressReleaseVendors} vendors) are processed
          by the news discovery pipeline at 05:05 UTC daily — relevance-filtered and deduplicated before ingestion.
        </p>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(categorySummary)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cat, info]) => (
              <div
                key={cat}
                className={`rounded-lg border px-3 py-2 ${
                  cat === "press_release"
                    ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
                    : "border-[#e3d9c0] bg-[#f9f5ec] dark:border-[#1d3a57] dark:bg-[#0c2238]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[#3f5068] dark:text-[#a7bacd] truncate">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  {cat === "press_release" && (
                    <span className="shrink-0 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">NEWS</span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums text-[#15263c] dark:text-[#eef3f8]">{info.count}</span>
                  <span className="text-[10px] text-[#4c5d75] dark:text-[#7a9bb8]">{info.vendors}v</span>
                </div>
              </div>
            ))}
        </div>
        <div className="mt-4 flex gap-3">
          <Link href="/admin/ingestion" className="text-sm text-[#4c5d75] hover:underline dark:text-[#a7bacd]">
            Trigger ingestion →
          </Link>
          <span className="text-[#ccc]">·</span>
          <Link href="/admin/ingestion#manifest" className="text-sm text-[#4c5d75] hover:underline dark:text-[#a7bacd]">
            View full manifest →
          </Link>
        </div>
      </Panel>

      {/* ── Cron schedule ─────────────────────────────────────────────── */}
      <Panel title="Automated pipeline schedule">
        <div className="space-y-3 text-sm">
          <CronRow
            time="03:05 UTC daily"
            label="Rolling evidence sourcing"
            description="Fetches trust centres, pricing pages, docs, status pages for today's rotation vendor. Cycles through all vendors over ~20 days."
            endpoint="/api/cron/sourcing-rolling"
          />
          <CronRow
            time="05:05 UTC daily"
            label="News & press-release sourcing"
            description="Discovers and scores articles from vendor news listing pages. Relevance ≥ 60 and importance ≥ 40 required before ingestion. Max 5 articles per vendor."
            endpoint="/api/cron/sourcing-news"
            highlight
          />
          <CronRow
            time="After sourcing"
            label="Safe-actions promotion"
            description="Promotes high-confidence pending proposals to approved evidence records automatically."
            endpoint="/api/cron/safe-actions"
          />
          <CronRow
            time="Daily"
            label="Daily refresh"
            description="Recomputes scores, snapshots rankings, refreshes competitive intel and investor tools."
            endpoint="/api/cron/daily-refresh"
          />
        </div>
      </Panel>

      {/* ── Ingestion cost calculator ─────────────────────────────────── */}
      <Panel title="Ingestion cost calculator">
        <IngestionCostPanel vendorCount={vendorCount} />
      </Panel>
    </PageFrame>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionCard({
  href, title, description, badge, badgeColor, icon,
}: {
  href: string;
  title: string;
  description: string;
  badge: string | null;
  badgeColor: string;
  icon: string;
}) {
  const badgeColors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  };
  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] p-4 hover:border-[#c5b99a] dark:hover:border-[#2d5078] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl leading-none select-none">{icon}</span>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeColors[badgeColor] ?? badgeColors.slate}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#15263c] dark:text-[#eef3f8]">{title}</div>
      <div className="mt-1 text-xs text-[#4c5d75] dark:text-[#a7bacd] leading-relaxed">{description}</div>
    </Link>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e3d9c0] dark:border-[#1d3a57] bg-[#f9f5ec] dark:bg-[#0c2238] px-4 py-3">
      <div className="text-xs text-[#4c5d75] dark:text-[#7a9bb8]">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${
        warn && value > 0 ? "text-amber-600 dark:text-amber-400"
        : highlight && value > 0 ? "text-emerald-600 dark:text-emerald-400"
        : "text-[#15263c] dark:text-[#eef3f8]"
      }`}>{value}</div>
    </div>
  );
}

function CronRow({
  time, label, description, endpoint, highlight,
}: {
  time: string;
  label: string;
  description: string;
  endpoint: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex gap-4 rounded-lg border px-4 py-3 ${
      highlight
        ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30"
        : "border-[#e3d9c0] bg-white dark:border-[#1d3a57] dark:bg-[#0c2238]"
    }`}>
      <div className="w-36 shrink-0">
        <div className="text-xs font-semibold tabular-nums text-[#15263c] dark:text-[#eef3f8]">{time}</div>
        <div className="mt-0.5 font-mono text-[10px] text-[#4c5d75] dark:text-[#7a9bb8]">{endpoint}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-[#15263c] dark:text-[#eef3f8]">
          {label}
          {highlight && <span className="ml-2 rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>}
        </div>
        <div className="mt-0.5 text-xs text-[#4c5d75] dark:text-[#a7bacd] leading-relaxed">{description}</div>
      </div>
    </div>
  );
}
