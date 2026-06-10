import Link from "next/link";
import { dashboardSummary, listConnectorHealth } from "@/lib/connectors/registry";

export const dynamic = "force-dynamic";

/**
 * Connector status console.
 *
 * Read-only view of every data-source connector + its env-config state.
 * Each row is honest: configured / not_configured / not_implemented / error /
 * rate_limited. Nothing fakes "live" — env-vars not present == not_configured,
 * full stop.
 */
export default function DataSourcesPage() {
  const summary = dashboardSummary();
  const connectors = listConnectorHealth();

  // Group by category for easier scanning
  const byGroup = connectors.reduce<Record<string, typeof connectors>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f6f1e3] text-[#15263c] dark:bg-[#071827] dark:text-[#eef3f8]">
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Link href="/admin" className="text-sm text-[#4c5d75] hover:underline">← Admin</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Data sources</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#3f5068] dark:text-[#a7bacd]">
          One row per official-data connector. Configured connectors fetch real data on demand;
          unconfigured ones surface the env vars needed to enable them. No connector ever fakes
          a successful status — &quot;ok&quot; means the env-check passed and the source is reachable.
        </p>

        {/* Summary chips */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Total connectors" value={summary.total} />
          <Stat label="Configured" value={summary.configured} tone="ok" />
          <Stat label="Not configured" value={summary.notConfigured} tone="warn" />
          <Stat label="Status: ok" value={summary.okStatus} tone="ok" />
          <Stat label="Status: error" value={summary.errorStatus} tone="bad" />
          <Stat label="Rate limited" value={summary.rateLimited} tone="warn" />
        </div>

        {/* Per-group panels */}
        <div className="mt-8 space-y-6">
          {Object.entries(byGroup).map(([group, items]) => (
            <section key={group} className="rounded-2xl border border-[#e3d9c0] bg-white p-5 dark:border-[#1d3a57] dark:bg-[#0c2238]">
              <h2 className="text-base font-semibold capitalize">{group.replace(/_/g, " ")}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-[#4c5d75]">
                    <tr>
                      <th className="py-2 pr-4">Connector</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Configured?</th>
                      <th className="py-2 pr-4">Env vars</th>
                      <th className="py-2 pr-4">Tier</th>
                      <th className="py-2 pr-4">Rate limit</th>
                      <th className="py-2 pr-4">Last fetch</th>
                      <th className="py-2 pr-4">Records</th>
                      <th className="py-2">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece4d0] dark:divide-[#1d3a57]">
                    {items.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 pr-4">
                          <div className="font-semibold">{c.label}</div>
                          <div className="mt-0.5 text-xs text-[#4c5d75]">{c.description}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="py-3 pr-4">
                          {c.configured ? (
                            <span className="text-emerald-700 dark:text-emerald-400">✓ yes</span>
                          ) : (
                            <span className="text-rose-700 dark:text-rose-400">✗ no</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-[#3f5068] dark:text-[#a7bacd]">
                          {c.envVars.length === 0 ? <span className="text-[#6b7d93]">—</span> : c.envVars.join(", ")}
                          {c.requiresKey && <span className="ml-1 text-rose-500">*</span>}
                        </td>
                        <td className="py-3 pr-4 text-xs capitalize">{c.tier.replace(/_/g, " ")}</td>
                        <td className="py-3 pr-4 text-xs text-[#3f5068] dark:text-[#a7bacd]">{c.rateLimitNotes ?? "—"}</td>
                        <td className="py-3 pr-4 text-xs">
                          {c.lastFetchAt ? (
                            <span className={c.lastFetchOk ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                              {c.lastFetchOk ? "✓" : "✗"} {new Date(c.lastFetchAt).toISOString().slice(0, 16).replace("T", " ")}
                              {c.lastFetchError && <span className="ml-1 italic text-[#4c5d75]">({c.lastFetchError.slice(0, 60)})</span>}
                            </span>
                          ) : (
                            <span className="text-[#6b7d93]">never</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums text-xs">{c.lastFetchRecordCount ?? "—"}</td>
                        <td className="py-3">
                          <a href={c.apiDocsUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300">
                            API docs
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">How to enable a connector</p>
          <ol className="mt-2 list-decimal pl-5 leading-6">
            <li>Get the API key from the source&apos;s docs (link in the row).</li>
            <li>Run <code className="rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/40">vercel env add &lt;ENV_VAR&gt; production</code> and paste the key.</li>
            <li>Repeat for <code>preview</code> and <code>development</code>.</li>
            <li>Redeploy. The status will flip to <code>ok</code>.</li>
          </ol>
          <p className="mt-3">
            Test a connector after configuring: <code>POST /api/data-sources/refresh</code> with body
            <code className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-xs dark:bg-amber-900/40">{`{"connectorId":"fred","query":{"seriesId":"FEDFUNDS"}}`}</code>.
          </p>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "ok" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "ok"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : tone === "bad"
        ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
        : "border-[#e3d9c0] bg-white text-[#2e3f57] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#c2d1e0]";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "ok"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "not_configured"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : status === "rate_limited"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>{status.replace(/_/g, " ")}</span>;
}
