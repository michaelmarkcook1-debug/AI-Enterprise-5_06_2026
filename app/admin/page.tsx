import Link from "next/link";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { getDataProvenance } from "@/lib/intelligence/provenance";
import { getQueueHealthSummary, EMPTY_QUEUE_HEALTH } from "@/lib/services/queue-health";
import { listConnectorHealth, dashboardSummary } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  // Pull the headline numbers in parallel so the page renders the
  // operator's actual queue state — not generic marketing copy.
  const [provenance, queueHealth] = await Promise.all([
    getDataProvenance(),
    hasDatabase() ? getQueueHealthSummary(getPrisma()) : Promise.resolve(EMPTY_QUEUE_HEALTH),
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
