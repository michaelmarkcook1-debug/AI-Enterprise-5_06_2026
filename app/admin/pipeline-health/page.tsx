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
  schema_drift_check: { title: "Schema-drift guard", what: "Verify the live DB has every migration this code expects (catches a lagging production database)." },
  sourcing: { title: "Sourcing", what: "Fetch + extract proposals from the manifest." },
  safe_linkage: { title: "Safe linkage", what: "Auto-attach product scope to high-confidence proposals." },
  triage: { title: "Triage", what: "Auto-approve proposals that pass the strict gate." },
  projection: { title: "Projection", what: "Project verified evidence into the dashboard read tables." },
  derive_scores: { title: "Derive scores", what: "Recompute vendor pillar + overall scores." },
  market_share_movement: { title: "Market-share movement", what: "Momentum-adjust category shares around the analyst baseline + recompute movers." },
  ranking_snapshot: { title: "Ranking snapshot", what: "Capture today's overall + momentum for the trend graphs." },
  competitive_intel: { title: "Competitive intelligence", what: "Per-vendor Anthropic web-search news monitor (Haiku→Sonnet→Opus)." },
  market_news: { title: "Market news", what: "Broad AI press / commentary / benchmark RSS, Haiku-scored + vendor-tagged." },
  sourcing_news: { title: "Vendor press releases", what: "One rotating vendor's press-release RSS feed → evidence proposals." },
  investor_tools_refresh: { title: "Investor Tools live refresh", what: "SEC XBRL financials → Stooq+SEC valuations → IPO estimator (LLM + news) → curated analyst-coverage scrape." },
  reputation_github: { title: "Reputation (GitHub)", what: "Live GitHub developer-momentum signals (no LLM)." },
  macro_signals: { title: "Macro signals", what: "FRED + GDELT macro / event signals (no LLM)." },
  watchlist_alerts: { title: "Watchlist alerts", what: "Notify on triggered watchlist conditions." },
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
          <p className="text-sm text-[#475a72]">
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

      {/* Schema-drift callout — only renders when there is something to flag */}
      <SchemaDriftCard steps={steps} />

      {/* Anthropic-dependent steps callout */}
      <div className="mb-6">
        <AnthropicDependentCard steps={steps} runAt={last.startedAt} />
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
                <tr className="border-b border-[#e6dcc3] text-left text-xs uppercase tracking-wide text-[#56657b]">
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
                    <tr key={s.step} className="border-b border-[#efe9d9]/60 align-top">
                      <td className="py-3 pr-3">
                        <StatusPill ok={s.ok} />
                      </td>
                      <td className="py-3 pr-3 font-semibold text-[#13294b] dark:text-[#eef3f8]">{meta.title}</td>
                      <td className="py-3 pr-3 text-xs text-[#475a72] dark:text-[#a7bacd]">{meta.what}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-[#56657b]">{formatDuration(s.durationMs)}</td>
                      <td className="py-3 pr-3 text-xs">
                        {stepCost > 0 ? (
                          <div>
                            <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">${stepCost.toFixed(3)}</span>
                            <div className="mt-0.5 text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">
                              {(stepTokIn / 1000).toFixed(0)}k↑ {(stepTokOut / 1000).toFixed(0)}k↓
                            </div>
                            {stepModel && (
                              <div className="mt-0.5 font-mono text-[9px] text-[#5b6b7f] dark:text-[#8fa5bb] truncate max-w-[80px]" title={stepModel}>
                                {stepModel.replace("claude-", "").replace("-latest", "")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#5b6b7f] dark:text-[#8fa5bb]">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-[#475a72] dark:text-[#a7bacd]">
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
                <tr className="border-b border-[#e6dcc3] text-left text-xs uppercase tracking-wide text-[#56657b]">
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Duration</th>
                  <th className="py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run) => (
                  <tr key={run.id} className="border-b border-[#efe9d9]/60">
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

function SchemaDriftCard({ steps }: { steps: StepSummary[] }) {
  const step = steps.find((s) => s.step === "schema_drift_check");
  if (!step) return null;
  const s = step.summary as Record<string, unknown>;
  const status = typeof s.status === "string" ? s.status : "unknown";
  const pending = Array.isArray(s.pending) ? (s.pending as string[]) : [];
  const unknown = Array.isArray(s.unknown) ? (s.unknown as string[]) : [];
  const appliedCount = Number(s.appliedCount ?? 0);
  const expectedCount = Number(s.expectedCount ?? 0);
  const message = typeof s.message === "string" ? s.message : "";

  // Healthy / no-db / unconfirmable states stay quiet — only flag real signal.
  if (status === "ok" || status === "no_database") return null;

  if (status === "behind") {
    return (
      <div className="mb-6">
        <Panel title="Database schema — DRIFT DETECTED">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            The live database is {pending.length} migration{pending.length === 1 ? "" : "s"} behind the deployed code
            ({appliedCount}/{expectedCount} applied).
          </p>
          <p className="mt-2 text-xs text-[#475a72] dark:text-[#a7bacd]">
            Features that read or write the missing tables/columns will fail silently until the production branch is
            deployed (or <code className="font-mono">prisma migrate deploy</code> is run) against this database. This is
            the exact failure mode where a preview branch looks migrated but production isn&apos;t.
          </p>
          <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-900 dark:text-rose-200">Missing migrations</div>
            <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-rose-950 dark:text-rose-100/90">
              {pending.map((m) => <li key={m}>↳ {m}</li>)}
            </ul>
          </div>
        </Panel>
      </div>
    );
  }

  // "ahead" or "check_failed" — informational amber note.
  return (
    <div className="mb-6">
      <Panel title="Database schema — note">
        <p className="text-sm text-amber-700 dark:text-amber-300">{message}</p>
        {unknown.length > 0 && (
          <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-[#475a72] dark:text-[#a7bacd]">
            {unknown.map((m) => <li key={m}>↳ {m}</li>)}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function AnthropicDependentCard({ steps, runAt }: { steps: StepSummary[]; runAt: string }) {
  // Everything below reflects the LAST PERSISTED run, not live state. Surface
  // its age so a stale error (e.g. a usage-limit response captured hours ago) is
  // never mistaken for the current key/quota state. A run older than 2h is flagged.
  const runMsAgo = Date.now() - new Date(runAt).getTime();
  const stale = runMsAgo > 2 * 60 * 60 * 1000;
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
  const compErrorCount = Number(compSummary.errorCount ?? 0);
  const compDiagnostic = typeof compSummary.diagnostic === "string" ? compSummary.diagnostic : "";
  const sourcingFailed = Number(sourcingSummary.failedExtract ?? sourcingSummary.failed ?? 0);
  const sourcingFirstError = typeof sourcingSummary.firstError === "string" ? sourcingSummary.firstError : "";
  // A CONFIGURED usage/spend limit ("specified API usage limits", "regain access
  // on …") is distinct from a depleted credit balance — adding credits won't lift
  // it. Detect it so we point at the right lever (Console → Limits), not credits.
  const usageLimitHit = /usage limit|regain access|reached your specified/i.test(`${compDiagnostic} ${sourcingFirstError}`);

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
      <div className={`mb-3 rounded-md border p-3 text-xs leading-5 ${stale
        ? "border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-[#d6c9a8] bg-[#f6f1e3] text-[#475a72] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#a7bacd]"}`}>
        <strong>Snapshot from the last pipeline run — {ago(runAt)} ({new Date(runAt).toISOString().replace("T", " ").slice(0, 16)} UTC).</strong>{" "}
        This is <strong>not live</strong>. {stale
          ? "It is over 2 hours old and may not reflect the current key, quota, or account state — re-run the pipeline before acting on any error below (e.g. don't change billing on the strength of a stale message)."
          : "Re-run the pipeline to confirm any error below is still current."}
      </div>
      <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
        Two pipeline steps depend on the Anthropic API and both returned zero data on that run.
      </p>
      <p className="mt-2 text-xs text-[#475a72] dark:text-[#a7bacd]">
        This is the most likely explanation for &quot;no fresh ingestion today&quot; — sourcing extracts new
        evidence from the manifest via Claude, then triage / projection / news / capabilities all
        depend on that evidence flowing through. When the LLM call fails or is gated, the rest of the
        pipeline still &quot;succeeds&quot; but produces no new content.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">Sourcing extractor</div>
          <div className="mt-1 font-mono text-xs text-[#475a72] dark:text-[#c2d1e0]">
            llmSource: <strong>{llmSource}</strong> · proposalsExtracted: <strong>{proposalsExtracted}</strong> · proposalsPersisted: <strong>{proposalsPersisted}</strong> · failed: <strong>{sourcingFailed}</strong>
          </div>
          <div className="mt-1 text-[11px] italic text-amber-900/80 dark:text-amber-200/80">
            {llmSource === "stub"
              ? "ANTHROPIC_API_KEY missing or unreachable; extractor fell back to stub (no LLM)."
              : sourcingFirstError
              ? "Source fetch/extract threw an API error — exact response below."
              : "No proposals extracted, but no error was recorded — likely a quiet manifest rotation this run, not a failure."}
          </div>
          {sourcingFirstError && (
            <div className="mt-1 break-words font-mono text-[10px] text-amber-950 dark:text-amber-100/90">↳ {sourcingFirstError}</div>
          )}
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">Competitive intel monitor</div>
          <div className="mt-1 font-mono text-xs text-[#475a72] dark:text-[#c2d1e0]">
            vendorsAttempted: <strong>{compAttempted}</strong> · vendorsWithFindings: <strong>{compFindings}</strong> · errors: <strong>{compErrorCount}</strong>
          </div>
          <div className="mt-1 text-[11px] italic text-amber-900/80 dark:text-amber-200/80">
            {compErrorCount > 0
              ? "Vendor lookups threw API errors — see diagnostic below for the exact response."
              : "Lookups completed without throwing but found nothing — NOT necessarily a key/billing problem. See diagnostic below."}
          </div>
          {compDiagnostic && (
            <div className="mt-1 break-words font-mono text-[10px] text-amber-950 dark:text-amber-100/90">
              ↳ {compDiagnostic}
            </div>
          )}
        </div>
      </div>
      {usageLimitHit && (
        <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-xs leading-5 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <strong>First, confirm this is current:</strong> this message is from the run above ({ago(runAt)}). A successful
          run since then clears it. If your Anthropic Console shows healthy credit and you&apos;re well under the monthly
          limit, this is almost certainly stale or a per-workspace cap on a different key — re-run before touching billing.
          <br /><br />
          <strong>If it persists on a fresh run, then it&apos;s a configured usage limit hit by whatever key/workspace the deployed{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> belongs to</strong> — not necessarily the account
          you topped up. If your credit + limits look healthy, the deployed key likely belongs to a different or
          older workspace with a low monthly cap. To confirm exactly which: copy the{" "}
          <code className="font-mono">request_id</code> from the diagnostic above and look it up in{" "}
          <strong>Anthropic Console → Logs</strong> — it names the org, workspace, and key that hit the limit.
          Then raise that workspace&apos;s limit (Settings → Limits) or rotate{" "}
          <code className="font-mono">ANTHROPIC_API_KEY</code> in Vercel to a key from the uncapped workspace.
          Note: this panel shows the <em>last persisted run</em> and doesn&apos;t auto-refresh — trigger a fresh
          run to confirm the error is current, not from before your fix.
        </div>
      )}
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
  const diagnostic = typeof s.diagnostic === "string" ? s.diagnostic : "";
  const source = typeof s.source === "string" ? s.source : "—";
  const isBlocked = vendorsAttempted > 0 && vendorsWithFindings === 0;
  // Distinguish a thrown API error (key/billing/rate-limit) from a clean run
  // that simply found nothing (web search ungated, or a genuinely quiet window).
  const threwErrors = errorCount > 0;
  // A 400 invalid-request / unsupported-tool error is a CODE/CONFIG bug (e.g. a
  // server tool the model tier can't call), NOT a key / billing / rate-limit
  // problem — so the remediation is "fix the request shape", never "rotate the key".
  const configError = /invalid_request_error|allowed_callers|programmatic tool calling|does not support|unsupported/i.test(diagnostic);

  return (
    <Panel
      title="Competitive intelligence monitor"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className={`text-sm font-semibold ${isBlocked ? "text-rose-700 dark:text-rose-300" : step.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
            {!isBlocked && step.ok
              ? "Healthy — fresh findings flowing into /query and /demonstrate."
              : threwErrors && configError
              ? "Vendor lookups threw a 400 invalid-request error — a tool/model CONFIG bug, not a key, billing, or rate-limit issue. See diagnostic."
              : threwErrors
              ? "Vendor lookups threw Anthropic API errors — likely an invalid key, hit spend cap, or rate limit."
              : isBlocked
              ? "Lookups completed without errors but found nothing — check web-search access, not the key."
              : "Partial — some vendors returned, others didn't."}
          </p>
          <p className="mt-2 text-xs text-[#475a72] dark:text-[#a7bacd]">
            Source: <code className="font-mono">{source}</code> · Attempted {vendorsAttempted} vendors,
            got findings for {vendorsWithFindings} of them, upserted {itemsUpserted} items, recorded {errorCount} errors.
          </p>
          {diagnostic && (
            <p className="mt-2 break-words rounded bg-[#0c2238]/5 px-2 py-1 font-mono text-[11px] text-[#475a72] dark:bg-white/5 dark:text-[#c2d1e0]">
              diagnostic: {diagnostic}
            </p>
          )}
          {isBlocked && threwErrors && configError && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>This is a request-config error, not billing or auth.</strong> The diagnostic is a 400
              invalid-request response (e.g. a server tool the model tier can&apos;t call). Do NOT rotate the key
              or raise the spend cap — neither will help. Fix the request shape in the sourcing code (e.g. set
              <code className="font-mono"> allowed_callers: [&quot;direct&quot;]</code> on the web_search tool, or
              use a model tier that supports it) and redeploy.
            </div>
          )}
          {isBlocked && threwErrors && !configError && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>To restore freshness:</strong> the calls are erroring. Check the diagnostic above —
              if it&apos;s a billing/credit error, raise the spend cap at
              <code className="font-mono"> console.anthropic.com/settings/limits</code>; if it&apos;s an auth
              error, rotate <code className="font-mono">ANTHROPIC_API_KEY</code> via
              <code className="font-mono"> vercel env add ANTHROPIC_API_KEY production</code> then redeploy.
            </div>
          )}
          {isBlocked && !threwErrors && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>No errors were thrown</strong> — the key is working. The web-search tool returned
              nothing for every vendor, which usually means web search isn&apos;t enabled for this API key/plan,
              or the search server-tool loop paused. The monitor now auto-resumes paused searches; if this
              persists, confirm web search is enabled for the org in the Anthropic console.
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
      : "text-[#13294b] dark:text-[#eef3f8]";
  return (
    <div className="rounded-lg border border-[#e6dcc3] bg-white p-4 dark:border-[#1d3a57] dark:bg-[#0c2238]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${colorClass}`}>{value}</div>
      {note && <div className="mt-1 text-[10px] text-[#5b6b7f] dark:text-[#8fa5bb]">{note}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "ok" | "bad" | "neutral" }) {
  const colorClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "bad"
      ? "text-rose-700 dark:text-rose-300"
      : "text-[#13294b] dark:text-[#eef3f8]";
  return (
    <div className="rounded-md border border-[#e6dcc3] bg-[#fafbf8] px-3 py-2 dark:border-[#1d3a57] dark:bg-[#0c2238]/60">
      <div className="text-[10px] uppercase tracking-wider text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
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
