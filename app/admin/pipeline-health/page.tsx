// Admin → pipeline health.
// ────────────────────────
// Surfaces the last daily-refresh run with per-step status so the
// operator can see at a glance which data sources are healthy and which
// are blocked. The page is intentionally read-only — no triggers — to
// stay safe under wide admin permissions. The "Trigger refresh" CTA
// links to the existing /admin/ingestion page which already handles
// admin-token auth for manual runs.
//
// Special-cases competitive_intel because that step is the most common
// failure point (Anthropic API limits / key rotation) and shows the
// underlying error verbatim when present.

import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import { getLastRefreshRun, listRefreshRuns } from "@/lib/system/daily-refresh-store";

export const dynamic = "force-dynamic";

interface StepSummary {
  step: string;
  ok: boolean;
  durationMs: number;
  summary: Record<string, unknown>;
  error?: string;
}

const STEP_LABELS: Record<string, { title: string; what: string }> = {
  sourcing: { title: "Sourcing", what: "Fetch + extract proposals from the manifest." },
  safe_linkage: { title: "Safe linkage", what: "Auto-attach product scope to high-confidence proposals." },
  triage: { title: "Triage", what: "Auto-approve proposals that pass the strict gate." },
  projection: { title: "Projection", what: "Project verified evidence into the dashboard read tables." },
  derive_scores: { title: "Derive scores", what: "Recompute vendor pillar + overall scores." },
  ranking_snapshot: { title: "Ranking snapshot", what: "Capture today's overall + momentum for the trend graphs." },
  competitive_intel: { title: "Competitive intelligence", what: "Refresh the 13-vendor Anthropic web-search news monitor." },
  investor_tools_refresh: { title: "Investor Tools live refresh", what: "SEC XBRL financials → Stooq+SEC valuations → IPO estimator (LLM + news) → curated analyst-coverage scrape." },
};

function parseSteps(raw: unknown): StepSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is StepSummary => typeof s === "object" && s !== null && typeof (s as StepSummary).step === "string");
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function ago(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(diffMs / 3_600_000);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(diffMs / 86_400_000);
  return `${d}d ago`;
}

export default async function PipelineHealthPage() {
  const [last, history] = await Promise.all([
    getLastRefreshRun(),
    listRefreshRuns(10),
  ]);

  if (!last) {
    return (
      <PageFrame
        title="Pipeline health"
        kicker="Daily refresh status"
        description="No refresh runs have been persisted yet. Check back after the next 03:00 UTC scheduled run."
      >
        <Panel title="No data">
          <p className="text-sm text-[#4d574b]">
            The pipeline has not written any run to <code className="font-mono">daily_refresh_runs</code> yet.
            Trigger one manually from <Link href="/admin/ingestion" className="underline font-semibold">Ingestion</Link>.
          </p>
        </Panel>
      </PageFrame>
    );
  }

  const steps = parseSteps(last.steps);
  const competitiveIntel = steps.find((s) => s.step === "competitive_intel");
  const okSteps = steps.filter((s) => s.ok).length;
  const failedSteps = steps.filter((s) => !s.ok);

  // Roll up token cost across steps that track it.
  const totalTokensIn  = steps.reduce((s, st) => s + (Number(st.summary?.tokensIn)           || 0), 0);
  const totalTokensOut = steps.reduce((s, st) => s + (Number(st.summary?.tokensOut)          || 0), 0);
  const estimatedCost  = steps.reduce((s, st) => s + (Number(st.summary?.estimatedCostUsd)   || 0), 0);

  return (
    <PageFrame
      title="Pipeline health"
      kicker={`Last run ${ago(last.startedAt)} · ${okSteps}/${steps.length} steps OK`}
      description="Read-only view of the daily-refresh pipeline. Each step is independent — one failing does not block the others. Trigger a fresh run from /admin/ingestion if you need to."
    >
      {/* Headline status */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          label="Overall"
          value={last.ok ? "OK" : "Errors"}
          tone={last.ok ? "ok" : "bad"}
          note={`Run ${formatDuration(last.durationMs)} · ${ago(last.startedAt)}`}
        />
        <StatusCard
          label="Steps OK"
          value={`${okSteps}/${steps.length}`}
          tone={okSteps === steps.length ? "ok" : "warn"}
        />
        <StatusCard
          label="Failed steps"
          value={failedSteps.length}
          tone={failedSteps.length === 0 ? "ok" : "bad"}
          note={failedSteps.map((s) => STEP_LABELS[s.step]?.title ?? s.step).join(", ") || "—"}
        />
        <StatusCard
          label="Est. Anthropic cost"
          value={estimatedCost > 0 ? `$${estimatedCost.toFixed(3)}` : "—"}
          tone="neutral"
          note={totalTokensIn > 0
            ? `${(totalTokensIn / 1000).toFixed(0)}k in · ${(totalTokensOut / 1000).toFixed(0)}k out`
            : "No LLM steps recorded"}
        />
      </div>

      {/* Anthropic-dependent steps callout */}
      <div className="mb-6">
        <AnthropicDependentCard steps={steps} />
      </div>

      {/* Competitive-intel callout when blocked */}
      {competitiveIntel && competitiveIntel.summary && (
        <div className="mb-6">
          <CompetitiveIntelCard step={competitiveIntel} />
        </div>
      )}

      {/* Per-step table */}
      <div className="mb-6">
        <Panel title="Steps">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#dfe4da] text-left text-xs uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Step</th>
                  <th className="py-2 pr-3">What it does</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s) => {
                  const meta = STEP_LABELS[s.step] ?? { title: s.step, what: "" };
                  const stepCost    = Number(s.summary?.estimatedCostUsd) || 0;
                  const stepTokIn   = Number(s.summary?.tokensIn)         || 0;
                  const stepTokOut  = Number(s.summary?.tokensOut)        || 0;
                  const stepModel   = typeof s.summary?.modelUsed === "string" ? s.summary.modelUsed : null;
                  return (
                    <tr key={s.step} className="border-b border-[#edf0ea]/60 align-top">
                      <td className="py-3 pr-3">
                        <StatusPill ok={s.ok} />
                      </td>
                      <td className="py-3 pr-3 font-semibold text-[#18201b] dark:text-zinc-100">{meta.title}</td>
                      <td className="py-3 pr-3 text-xs text-[#4d574b] dark:text-zinc-400">{meta.what}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-[#5f685a]">{formatDuration(s.durationMs)}</td>
                      <td className="py-3 pr-3 text-xs">
                        {stepCost > 0 ? (
                          <div>
                            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">${stepCost.toFixed(3)}</span>
                            <div className="mt-0.5 text-[10px] text-[#697362] dark:text-zinc-500">
                              {(stepTokIn / 1000).toFixed(0)}k↑ {(stepTokOut / 1000).toFixed(0)}k↓
                            </div>
                            {stepModel && (
                              <div className="mt-0.5 font-mono text-[9px] text-[#697362] dark:text-zinc-500 truncate max-w-[80px]" title={stepModel}>
                                {stepModel.replace("claude-", "").replace("-latest", "")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#697362] dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-[#4d574b] dark:text-zinc-400">
                        {s.error ? (
                          <span className="text-rose-700 dark:text-rose-300">{truncate(s.error, 240)}</span>
                        ) : (
                          <code className="font-mono">{summariseStep(s.summary)}</code>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Run history */}
      <div>
        <Panel title="Recent runs (last 10)">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#dfe4da] text-left text-xs uppercase tracking-wide text-[#5f685a]">
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.id} className="border-b border-[#edf0ea]/60">
                    <td className="py-2 pr-3"><StatusPill ok={run.ok} /></td>
                    <td className="py-2 pr-3 font-mono text-xs">{new Date(run.startedAt).toISOString().replace("T", " ").slice(0, 19)} UTC</td>
                    <td className="py-2 pr-3 font-mono text-xs">{formatDuration(run.durationMs)}</td>
                    <td className="py-2 text-xs text-rose-700 dark:text-rose-300">{run.errors.length > 0 ? `${run.errors.length} error${run.errors.length === 1 ? "" : "s"}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function AnthropicDependentCard({ steps }: { steps: StepSummary[] }) {
  // sourcing and competitive_intel both call Anthropic. When the API
  // is blocked (spend cap / invalid key / rate limit), both produce
  // zero output even though they "complete" successfully — this is the
  // cascade that makes the whole pipeline look like "0 ingestion today".
  const sourcing = steps.find((s) => s.step === "sourcing");
  const competitive = steps.find((s) => s.step === "competitive_intel");

  const sourcingSummary = (sourcing?.summary ?? {}) as Record<string, unknown>;
  const compSummary = (competitive?.summary ?? {}) as Record<string, unknown>;

  const proposalsExtracted = Number(sourcingSummary.proposalsExtracted ?? 0);
  const proposalsPersisted = Number(sourcingSummary.proposalsPersisted ?? 0);
  const llmSource = typeof sourcingSummary.llmSource === "string" ? sourcingSummary.llmSource : "—";
  const compAttempted = Number(compSummary.vendorsAttempted ?? 0);
  const compFindings = Number(compSummary.vendorsWithFindings ?? 0);

  const sourcingDegraded = llmSource === "stub" || proposalsExtracted === 0;
  const compDegraded = compAttempted > 0 && compFindings === 0;
  const blocked = sourcingDegraded || compDegraded;

  if (!blocked) {
    return (
      <Panel title="LLM-backed steps">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          ✓ Both Anthropic-backed steps (sourcing extractor + competitive-intel monitor) returned data this run.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="LLM-backed steps — degraded">
      <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
        Two pipeline steps depend on the Anthropic API and both are returning zero data this run.
      </p>
      <p className="mt-2 text-xs text-[#4d574b] dark:text-zinc-400">
        This is the most likely explanation for &quot;no fresh ingestion today&quot; — sourcing extracts new
        evidence from the manifest via Claude, then triage / projection / news / capabilities all
        depend on that evidence flowing through. When the LLM call fails or is gated, the rest of the
        pipeline still &quot;succeeds&quot; but produces no new content.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">Sourcing extractor</div>
          <div className="mt-1 font-mono text-xs text-[#4d574b] dark:text-zinc-300">
            llmSource: <strong>{llmSource}</strong> · proposalsExtracted: <strong>{proposalsExtracted}</strong> · proposalsPersisted: <strong>{proposalsPersisted}</strong>
          </div>
          <div className="mt-1 text-[11px] italic text-amber-900/80 dark:text-amber-200/80">
            {llmSource === "stub"
              ? "ANTHROPIC_API_KEY missing or unreachable; extractor fell back to stub (no LLM)."
              : "LLM is configured but returned no usable proposals — check sourcing logs for credit_balance / rate_limit / model_not_found."}
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">Competitive intel monitor</div>
          <div className="mt-1 font-mono text-xs text-[#4d574b] dark:text-zinc-300">
            vendorsAttempted: <strong>{compAttempted}</strong> · vendorsWithFindings: <strong>{compFindings}</strong>
          </div>
          <div className="mt-1 text-[11px] italic text-amber-900/80 dark:text-amber-200/80">
            All 13 vendor lookups returned errors — see the panel below for the exact API response.
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
        <strong>Independent of this:</strong> derive_scores, ranking_snapshot, and the 13 public-data
        connectors (SEC, FRED, GitHub, statuspages, etc.) continue to run normally. The QUAD tabs
        will keep rendering existing data, just without today&apos;s fresh news / proposals layered on.
      </div>
    </Panel>
  );
}

function CompetitiveIntelCard({ step }: { step: StepSummary }) {
  const s = step.summary as Record<string, unknown>;
  const vendorsAttempted = Number(s.vendorsAttempted ?? 0);
  const vendorsWithFindings = Number(s.vendorsWithFindings ?? 0);
  const itemsUpserted = Number(s.itemsUpserted ?? 0);
  const errorCount = Number(s.errorCount ?? 0);
  const source = typeof s.source === "string" ? s.source : "—";
  const isBlocked = vendorsAttempted > 0 && vendorsWithFindings === 0;

  return (
    <Panel
      title="Competitive intelligence monitor"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className={`text-sm font-semibold ${isBlocked ? "text-rose-700 dark:text-rose-300" : step.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {isBlocked
              ? "All vendor lookups failed — likely Anthropic API limit reached or key invalid."
              : step.ok
              ? "Healthy — fresh findings flowing into /query and /demonstrate."
              : "Partial failure — some vendors returned, others errored."}
          </p>
          <p className="mt-2 text-xs text-[#4d574b] dark:text-zinc-400">
            Source: <code className="font-mono">{source}</code> · Attempted {vendorsAttempted} vendors,
            got findings for {vendorsWithFindings} of them, upserted {itemsUpserted} items, recorded {errorCount} errors.
          </p>
          {isBlocked && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>To restore freshness:</strong> raise the spend cap on the Anthropic console
              (<code className="font-mono">https://console.anthropic.com/settings/limits</code>),
              wait for the cap window to reset, or rotate <code className="font-mono">ANTHROPIC_API_KEY</code>
              to a key with budget via <code className="font-mono">vercel env add ANTHROPIC_API_KEY production</code>.
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 self-start md:grid-cols-1 md:gap-3">
          <MiniStat label="Attempted" value={vendorsAttempted} />
          <MiniStat label="With findings" value={vendorsWithFindings} tone={vendorsWithFindings > 0 ? "ok" : "bad"} />
          <MiniStat label="Items upserted" value={itemsUpserted} tone={itemsUpserted > 0 ? "ok" : "bad"} />
          <MiniStat label="Errors" value={errorCount} tone={errorCount === 0 ? "ok" : "bad"} />
        </div>
      </div>
    </Panel>
  );
}

function StatusCard({ label, value, tone, note }: { label: string; value: string | number; tone: "ok" | "warn" | "bad" | "neutral"; note?: string }) {
  const colorClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "bad"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#18201b] dark:text-zinc-100";
  return (
    <div className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${colorClass}`}>{value}</div>
      {note && <div className="mt-1 text-[10px] text-[#697362] dark:text-zinc-500">{note}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "ok" | "bad" | "neutral" }) {
  const colorClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "bad"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#18201b] dark:text-zinc-100";
  return (
    <div className="rounded-md border border-[#dfe4da] bg-[#fafbf8] px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-[10px] uppercase tracking-wider text-[#697362] dark:text-zinc-500">{label}</div>
      <div className={`font-mono text-base font-semibold ${colorClass}`}>{value}</div>
    </div>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
      OK
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
      FAIL
    </span>
  );
}

function summariseStep(summary: Record<string, unknown>): string {
  if (!summary || Object.keys(summary).length === 0) return "—";
  return Object.entries(summary)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
