import Link from "next/link";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { getQueueHealthSummary, EMPTY_QUEUE_HEALTH } from "@/lib/services/queue-health";
import { listConnectorHealth, dashboardSummary } from "@/lib/connectors/registry";
import { getLastRefreshRun, listRefreshRuns, type StoredRefreshRun } from "@/lib/system/daily-refresh-store";
import IngestionTrigger from "@/components/admin/IngestionTrigger";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  // Pull the headline numbers in parallel so the page renders the
  // operator's actual queue state — not generic marketing copy.
  const [provenance, queueHealth, lastRun, recentRuns] = await Promise.all([
    getDataProvenance(),
    hasDatabase() ? getQueueHealthSummary(getPrisma()) : Promise.resolve(EMPTY_QUEUE_HEALTH),
    getLastRefreshRun(),
    listRefreshRuns(5),
  ]);
  const connSummary = dashboardSummary();
  const connectors = listConnectorHealth();
  const okConnectors = connectors.filter((c) => c.status === "ok").length;

  // Headline action: one of five states based on real DB counts.
  const headline = pickHeadline({
    provenance: provenance.source,
    pending: queueHealth.totalPending,
    fresh: queueHealth.freshActionableCount,
    deferred: queueHealth.deferredCount,
    stale: queueHealth.staleCount,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Operate the data pipeline that feeds the scoring engine.
        </p>

        {/* Headline action — single big primary CTA + plain-English
            description of what to do next. */}
        <div className="mt-6 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-6 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Do this next
          </div>
          <h2 className="mt-1 text-xl font-semibold text-emerald-900 dark:text-emerald-100">{headline.title}</h2>
          <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-200/80">{headline.body}</p>
          <div className="mt-4">
            <Link
              href={headline.href}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {headline.cta}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Manual ingestion control — automated ingestion is suspended; this
            is the only path that spends Anthropic credits, gated by a cost card. */}
        <div className="mt-6">
          <IngestionTrigger />
        </div>

        {/* Ingestion health — % completeness + failures from last run. */}
        <IngestionHealthPanel lastRun={lastRun} recentRuns={recentRuns} />

        {/* Snapshot row: 4 numbers operators check daily. */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Provenance"      value={provenance.source.toUpperCase()} tone={provenance.source === "live" ? "green" : "amber"} hint={provenance.reason} />
          <Stat label="Pending queue"   value={queueHealth.totalPending}        tone={queueHealth.totalPending === 0 ? "green" : "neutral"} hint="Proposals awaiting your review" href="/admin/evidence" />
          <Stat label="Connectors live" value={`${okConnectors} / ${connSummary.total}`} tone={connSummary.notConfigured === 0 ? "green" : "amber"} hint={connSummary.notConfigured > 0 ? `${connSummary.notConfigured} not configured` : "every connector is configured"} href="/admin/data-sources" />
          <Stat label="Verified evidence" value={provenance.evidenceCount}      tone="neutral" hint="Analyst-verified rows feeding the scoring engine" />
        </div>

        {/* Map of the rest of admin — secondary nav. */}
        <h2 className="mt-10 text-base font-semibold">All admin surfaces</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AdminCard
            href="/admin/evidence/batch"
            title="Batch review"
            body="20 rows at a time with bulk approve, filters, and the inline product linkage picker. The fast path."
            stat={queueHealth.freshActionableCount > 0 ? `${queueHealth.freshActionableCount} fresh` : "all caught up"}
            primary
          />
          <AdminCard
            href="/admin/evidence"
            title="Evidence review (single row)"
            body="One proposal at a time. Use for risky / contested rows."
            stat={queueHealth.totalPending > 0 ? `${queueHealth.totalPending} pending` : "queue empty"}
          />
          <AdminCard
            href="/admin/ingestion"
            title="Ingestion"
            body="Trigger public-data fetches and inspect job status."
          />
          <AdminCard
            href="/admin/data-sources"
            title="Data sources"
            body="Per-connector health (SEC, FRED, BLS, EIA, …)."
            stat={`${okConnectors} / ${connSummary.total} ok`}
          />
          <AdminCard
            href="/admin/production-status"
            title="Production status"
            body="Env-var gates and the production readiness contract."
          />
          <AdminCard
            href="/admin/pipeline-health"
            title="Pipeline health"
            body="Last daily-refresh run, per-step status, and competitive-intel monitor health. Shows whether the Anthropic-backed news refresh is alive."
          />
          <AdminCard
            href="/admin/exposure-edits"
            title="Exposure-map edits"
            body="Propose adds / updates / removals to the indirect-exposure graph. Append-only JSONL audit; nothing live until a reviewer folds it in."
          />
        </div>

        {/* Bottom strip: dev-mode note. */}
        <div className="mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Auth:</strong> set <code className="font-mono">ADMIN_API_OPEN=1</code> for local dev,
          or send the <code className="font-mono">x-admin-token</code> header. Do NOT set{" "}
          <code className="font-mono">ADMIN_API_OPEN</code> in Vercel Production — it makes every{" "}
          <code className="font-mono">/api/admin/*</code> route public.
        </div>
      </main>
    </div>
  );
}

function pickHeadline(args: {
  provenance: "live" | "seed";
  pending: number;
  fresh: number;
  deferred: number;
  stale: number;
}): { title: string; body: string; cta: string; href: string } {
  if (args.provenance === "seed") {
    return {
      title: "Flip to LIVE",
      body: "The dashboard is rendering seed data. Run ingestion, then approve at least one proposal to flip the global banner to live.",
      cta: "Start ingestion",
      href: "/admin/ingestion",
    };
  }
  if (args.fresh > 0) {
    return {
      title: `Review ${args.fresh} fresh proposal${args.fresh === 1 ? "" : "s"}`,
      body: `Batch review handles the recommend_approve cohort fastest — 20 rows at a time with bulk approve and the inline product picker.${args.stale > 0 ? ` ${args.stale} rows are stale and need attention.` : ""}`,
      cta: "Open batch review",
      href: "/admin/evidence/batch",
    };
  }
  if (args.stale > 0) {
    return {
      title: `${args.stale} stale row${args.stale === 1 ? "" : "s"} overdue`,
      body: "These rows have been pending more than 30 days. Decide each one — approve, defer with a reason, or reject.",
      cta: "Open single review",
      href: "/admin/evidence",
    };
  }
  if (args.deferred > 0) {
    return {
      title: `${args.deferred} deferred row${args.deferred === 1 ? "" : "s"} parked`,
      body: "Nothing else needs immediate attention. Revisit deferred rows when you have a moment.",
      cta: "View deferred rows",
      href: "/admin/evidence/batch?includeDeferred=1",
    };
  }
  return {
    title: "Queue is clear",
    body: "No pending proposals. Optionally trigger another ingestion run or open the data-source health page.",
    cta: "Trigger ingestion",
    href: "/admin/ingestion",
  };
}

const STAT_TONE: Record<"neutral" | "green" | "amber" | "red", { card: string; value: string }> = {
  neutral: { card: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",                                 value: "text-zinc-900 dark:text-zinc-100" },
  green:   { card: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",             value: "text-emerald-900 dark:text-emerald-200" },
  amber:   { card: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",                     value: "text-amber-900 dark:text-amber-200" },
  red:     { card: "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",                             value: "text-red-900 dark:text-red-200" },
};

function Stat({
  label, value, tone, hint, href,
}: { label: string; value: string | number; tone: keyof typeof STAT_TONE; hint?: string; href?: string }) {
  const inner = (
    <div className={`rounded-xl border px-4 py-3 ${STAT_TONE[tone].card} ${href ? "transition-colors hover:brightness-95" : ""}`} title={hint}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${STAT_TONE[tone].value}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      {hint && <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block no-underline">{inner}</Link> : inner;
}

// ── Ingestion Health Panel ────────────────────────────────────────
// Shows % completion of the most-recent pipeline run, which steps
// failed, and a mini-history of recent runs.

const FULL_PIPELINE_STEPS = [
  "sourcing", "safe_linkage", "triage", "projection", "derive_scores",
  "ranking_snapshot", "competitive_intel", "investor_tools_refresh",
  "reputation_github", "macro_signals",
];

const STEP_FRIENDLY: Record<string, string> = {
  sourcing: "Sourcing",
  safe_linkage: "Safe linkage",
  triage: "Triage",
  projection: "Projection",
  derive_scores: "Derive scores",
  ranking_snapshot: "Ranking snapshot",
  competitive_intel: "Competitive intel",
  investor_tools_refresh: "Investor tools",
  reputation_github: "GitHub reputation",
  macro_signals: "Macro signals",
  admin_ingestion: "Admin ingestion",
  sourcing_rolling: "Rolling sourcing",
};

interface StepRaw {
  step: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

function parseSteps(raw: unknown): StepRaw[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is StepRaw =>
      typeof s === "object" && s !== null && typeof (s as StepRaw).step === "string",
  );
}

function classifyRunType(steps: StepRaw[]): string {
  if (steps.length === 1) {
    const name = steps[0].step;
    if (name === "admin_ingestion") return "Admin ingestion";
    if (name === "sourcing_rolling") return "Rolling sourcing";
    return "Lightweight";
  }
  const knownHits = steps.filter((s) => FULL_PIPELINE_STEPS.includes(s.step)).length;
  return knownHits >= 5 ? "Full pipeline" : "Partial";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(diffMs / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(diffMs / 86_400_000);
  return `${d}d ago`;
}

function IngestionHealthPanel({
  lastRun,
  recentRuns,
}: {
  lastRun: StoredRefreshRun | null;
  recentRuns: StoredRefreshRun[];
}) {
  if (!lastRun) {
    return (
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ingestion health</div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No pipeline runs recorded yet.</p>
      </div>
    );
  }

  const steps = parseSteps(lastRun.steps);
  const okSteps = steps.filter((s) => s.ok);
  const failedSteps = steps.filter((s) => !s.ok);
  const pct = steps.length > 0 ? Math.round((okSteps.length / steps.length) * 100) : 0;
  const runType = classifyRunType(steps);
  // Detect crashed runs: ok=false + fewer steps than a full pipeline expects.
  const isFullPipeline = steps.length > 1 && steps.filter((s) => FULL_PIPELINE_STEPS.includes(s.step)).length >= 5;
  const crashed = !lastRun.ok && isFullPipeline && steps.length < FULL_PIPELINE_STEPS.length;
  const isHealthy = pct === 100 && !crashed;
  const isDegraded = !crashed && pct >= 70 && pct < 100;

  // Ring colour for the circular % indicator.
  const ringColor = crashed
    ? "text-rose-500 dark:text-rose-400"
    : isHealthy
    ? "text-emerald-500 dark:text-emerald-400"
    : isDegraded
    ? "text-amber-500 dark:text-amber-400"
    : "text-rose-500 dark:text-rose-400";
  const ringTrack = "text-zinc-200 dark:text-zinc-700";

  // SVG circular progress — 100px diameter, 8px stroke.
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - pct / 100);

  return (
    <div className={`mt-6 rounded-2xl border p-6 ${
      crashed
        ? "border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20"
        : isHealthy
        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
        : isDegraded
        ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20"
        : "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20"
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Ingestion health
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Last refresh: {timeAgo(lastRun.finishedAt)}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {new Date(lastRun.finishedAt).toLocaleString()} · {runType} · {formatDuration(lastRun.durationMs)}
          </p>
        </div>

        {/* Circular percentage indicator */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50" cy="50" r={radius}
              fill="none" strokeWidth="8"
              className={`stroke-current ${ringTrack}`}
            />
            <circle
              cx="50" cy="50" r={radius}
              fill="none" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              className={`stroke-current ${ringColor} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold tabular-nums ${ringColor}`}>{pct}%</span>
          </div>
        </div>
      </div>

      {/* Crash banner */}
      {crashed && (
        <div className="mt-4 rounded-lg border-2 border-rose-300 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">⚠️</span>
            <div>
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Pipeline crashed — only {steps.length} of {FULL_PIPELINE_STEPS.length} steps recorded
              </h3>
              <p className="mt-1 text-xs text-rose-800/80 dark:text-rose-300/80">
                The run started but did not complete all steps before the process was killed
                (likely a Vercel function timeout at {600}s or an unhandled exception).
                Steps that completed may have consumed Anthropic credits without the run
                being logged. With progressive persistence now enabled, future crashes will
                preserve partial progress.
              </p>
              <div className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">
                Missing steps:{" "}
                {FULL_PIPELINE_STEPS
                  .filter((s) => !steps.some((st) => st.step === s))
                  .map((s) => STEP_FRIENDLY[s] ?? s)
                  .join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed steps detail */}
      {failedSteps.length > 0 && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Failed steps ({failedSteps.length})
          </div>
          <ul className="mt-2 space-y-1.5">
            {failedSteps.map((s) => (
              <li key={s.step} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
                <div>
                  <span className="font-semibold text-rose-900 dark:text-rose-200">
                    {STEP_FRIENDLY[s.step] ?? s.step}
                  </span>
                  {s.error && (
                    <span className="ml-1 text-rose-700/80 dark:text-rose-300/80">
                      — {s.error.length > 120 ? s.error.slice(0, 119) + "…" : s.error}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step breakdown bar — visual indication of which steps passed/failed */}
      {steps.length > 1 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
            Step breakdown ({okSteps.length}/{steps.length} OK)
          </div>
          <div className="flex gap-0.5 rounded overflow-hidden">
            {steps.map((s) => (
              <div
                key={s.step}
                className={`h-2 flex-1 ${
                  s.ok
                    ? "bg-emerald-400 dark:bg-emerald-500"
                    : "bg-rose-400 dark:bg-rose-500"
                }`}
                title={`${STEP_FRIENDLY[s.step] ?? s.step}: ${s.ok ? "OK" : "FAILED"}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500">
            {steps.map((s) => (
              <span key={s.step} className="flex-1 truncate text-center" title={STEP_FRIENDLY[s.step] ?? s.step}>
                {(STEP_FRIENDLY[s.step] ?? s.step).slice(0, 6)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mini run history */}
      {recentRuns.length > 1 && (
        <div className="mt-4 border-t border-zinc-200/60 pt-3 dark:border-zinc-700/40">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Recent runs
            </div>
            <Link href="/admin/pipeline-health" className="text-[10px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Full history →
            </Link>
          </div>
          <div className="mt-2 flex gap-1.5">
            {recentRuns.slice(0, 5).map((run) => {
              const runSteps = parseSteps(run.steps);
              const runOk = runSteps.filter((s) => s.ok).length;
              const runPct = runSteps.length > 0 ? Math.round((runOk / runSteps.length) * 100) : 0;
              const dot = runPct === 100
                ? "bg-emerald-400 dark:bg-emerald-500"
                : runPct >= 70
                ? "bg-amber-400 dark:bg-amber-500"
                : "bg-rose-400 dark:bg-rose-500";
              return (
                <div
                  key={run.id}
                  className="flex flex-col items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  title={`${timeAgo(run.finishedAt)} · ${runPct}% · ${runOk}/${runSteps.length} steps OK`}
                >
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-[9px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{runPct}%</span>
                  <span className="text-[8px] text-zinc-400 dark:text-zinc-500">{timeAgo(run.finishedAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminCard({
  href, title, body, stat, primary,
}: { href: string; title: string; body: string; stat?: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 transition-colors ${
        primary
          ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/30 dark:hover:border-emerald-400"
          : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className={`text-base font-semibold ${primary ? "text-emerald-900 dark:text-emerald-100" : ""}`}>{title}</div>
        {stat && <span className={`font-mono text-[10px] ${primary ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500"}`}>{stat}</span>}
      </div>
      <p className={`mt-1 text-sm ${primary ? "text-emerald-900/80 dark:text-emerald-200/80" : "text-zinc-600 dark:text-zinc-400"}`}>{body}</p>
    </Link>
  );
}
