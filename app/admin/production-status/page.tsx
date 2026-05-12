import Link from "next/link";
import { ENV_SPEC, getReadiness, hasDatabase, hasLLM } from "@/lib/env";
import { manifestSummary } from "@/lib/sourcing/manifest";

// Server-rendered readiness panel. Reads the same gates as /api/admin/production-status
// so the admin can audit what's wired without the LLM/DB needing to be reachable
// (the page degrades gracefully when DB is missing).

export const dynamic = "force-dynamic";

interface Gate {
  label: string;
  ok: boolean;
  detail: string;
  remediation?: string;
  severity: "required" | "recommended";
}

async function buildGates(): Promise<Gate[]> {
  const gates: Gate[] = [];
  const readiness = getReadiness();

  for (const r of readiness.reports) {
    if (r.spec.severity === "optional") continue;
    gates.push({
      label: `env: ${r.spec.key}`,
      ok: r.status === "set",
      detail: r.status === "set"
        ? `${r.displayValue} — ${r.spec.enables[0] ?? ""}`
        : r.status === "invalid" ? `invalid: ${r.validationError}` : "missing",
      remediation: r.status === "set" ? undefined : r.spec.remediation,
      severity: r.spec.severity === "required" ? "required" : "recommended",
    });
  }

  if (hasDatabase()) {
    try {
      const { getPrisma } = await import("@/lib/prisma");
      const prisma = getPrisma();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verified = await (prisma as any).evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = await (prisma as any).evidenceProposal.count({ where: { status: "pending" } });
      gates.push({ label: "database: reachable", ok: true, detail: `connected · ${verified} verified · ${pending} pending`, severity: "required" });
      gates.push({
        label: "evidence: live data flowing",
        ok: verified > 0,
        detail: verified > 0 ? `${verified} verified rows in scoring` : "0 verified — dashboard remains in 'seed' mode",
        remediation: "Run the ingestion pipeline (admin → ingestion) and approve a proposal in admin → evidence.",
        severity: "recommended",
      });
    } catch (err) {
      gates.push({
        label: "database: reachable",
        ok: false,
        detail: err instanceof Error ? err.message.split("\n")[0] : String(err),
        remediation: "Check DATABASE_URL credentials, run `npx prisma migrate deploy`.",
        severity: "required",
      });
    }
  } else {
    gates.push({
      label: "database: reachable",
      ok: false,
      detail: "DATABASE_URL not set",
      remediation: "Provision Postgres (Vercel Marketplace → Neon / Supabase) and set DATABASE_URL.",
      severity: "required",
    });
  }

  gates.push({
    label: "llm: extractor + classifier",
    ok: hasLLM(),
    detail: hasLLM() ? "live (Anthropic key valid)" : "stub mode (deterministic placeholders)",
    remediation: "Set ANTHROPIC_API_KEY (must start with sk-ant-).",
    severity: "required",
  });

  const summary = manifestSummary();
  gates.push({
    label: "manifest: source URLs",
    ok: summary.totalSources > 0,
    detail: `${summary.totalSources} URLs across ${Object.keys(summary.byVendor).length} vendors`,
    severity: "required",
  });

  return gates;
}

export default async function ProductionStatusPage() {
  const gates = await buildGates();
  const requiredFails = gates.filter((g) => !g.ok && g.severity === "required");
  const ready = requiredFails.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-zinc-900 dark:text-zinc-100">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← Admin</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Production readiness</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Live gate status. The same checks run from the CLI via <code className="font-mono text-xs">npm run prod:check</code>.
      </p>

      <div className={`mt-6 rounded-xl border px-5 py-4 ${
        ready
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
          : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
      }`}>
        <div className="text-base font-semibold">{ready ? "READY to deploy" : "NOT READY"}</div>
        <div className="mt-1 text-xs">
          {gates.filter((g) => g.severity === "required" && g.ok).length} / {gates.filter((g) => g.severity === "required").length} required gates passing ·{" "}
          {gates.filter((g) => g.severity === "recommended" && g.ok).length} / {gates.filter((g) => g.severity === "recommended").length} recommended gates passing
        </div>
      </div>

      <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0e2435]">
        {gates.map((g) => (
          <li key={g.label} className="flex items-start gap-3 px-5 py-3 text-sm">
            <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              g.ok ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                   : g.severity === "required" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                               : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}>{g.ok ? "✓" : g.severity === "required" ? "✗" : "·"}</span>
            <div className="flex-1">
              <div className="font-mono text-xs font-semibold">{g.label}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{g.detail}</div>
              {!g.ok && g.remediation && (
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">→ {g.remediation}</div>
              )}
            </div>
            <span className={`text-[10px] uppercase tracking-wider ${
              g.ok
                ? "text-emerald-700 dark:text-emerald-400"
                : g.severity === "required"
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-amber-700 dark:text-amber-400"
            }`}>
              {g.ok ? `${g.severity} ✓` : g.severity}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold">Environment contract</h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Single source of truth at <code className="font-mono">lib/env.ts</code>. Every gate reads from this contract.
      </p>
      <div className="mt-3 grid gap-2">
        {ENV_SPEC.filter((s) => s.severity !== "optional").map((s) => {
          // Each env contract row reflects the LIVE state of the env
          // var. Set + required → emerald with ✓. Missing + required
          // → red. Set + recommended → emerald. Missing + recommended
          // → amber.
          const isSet = Boolean(process.env[s.key]);
          const tagClass = isSet
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : s.severity === "required"
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
          const borderClass = isSet
            ? "border-emerald-200 dark:border-emerald-900/50"
            : "border-zinc-200 dark:border-zinc-800";
          return (
            <div key={s.key} className={`rounded-lg border ${borderClass} p-3 text-xs`}>
              <div className="flex items-baseline gap-2">
                <code className="font-mono font-semibold">{s.key}</code>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${tagClass}`}>
                  {isSet ? `${s.severity} ✓` : s.severity}
                </span>
                {!isSet && (
                  <span className="text-[10px] text-rose-700 dark:text-rose-400">not set in this environment</span>
                )}
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{s.description}</p>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-zinc-500">
                {s.enables.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#071827] p-4 text-xs">
        <strong>Quick start to flip to LIVE:</strong>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Provision Postgres → set <code>DATABASE_URL</code></li>
          <li><code>npx prisma migrate deploy &amp;&amp; npm run db:seed</code></li>
          <li>Get an Anthropic key → set <code>ANTHROPIC_API_KEY</code></li>
          <li>Generate <code>ADMIN_API_TOKEN</code> with <code>openssl rand -hex 32</code></li>
          <li><code>npm run prod:check</code> — verify all gates green</li>
          <li><code>npm run ingest -- --vendor vendor_microsoft</code> → review at <Link className="underline" href="/admin/evidence">/admin/evidence</Link></li>
          <li>Approve at least one proposal — dashboard flips to LIVE</li>
        </ol>
      </div>
    </main>
  );
}
