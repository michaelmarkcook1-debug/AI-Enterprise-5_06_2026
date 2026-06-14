// Production-readiness check.
//
//   npm run prod:check
//
// Runs a series of gates and prints a green/red checklist. Exits non-zero on
// any required failure so this can be wired into CI / a deploy preflight.
//
// Gates (in order):
//   1. Env vars present + valid (DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_API_TOKEN)
//   2. Database reachable + schema migrated (prisma)
//   3. Source manifest sanity (every entry has a URL + freshness)
//   4. Evidence promotion: at least one analyst-verified row exists
//   5. Sourcing logs writeable
//
// Each gate emits one line: ✓ name (detail)  or  ✗ name → remediation

import { ENV_SPEC, getReadiness, hasDatabase, hasLLM } from "../lib/env";
import { SOURCE_MANIFEST, manifestSummary } from "../lib/sourcing/manifest";
import { logDirPath, ensureLogDirReady } from "../lib/sourcing/logger";
import { existsSync } from "node:fs";

interface GateResult {
  name: string;
  ok: boolean;
  detail: string;
  remediation?: string;
  severity: "required" | "recommended";
}

const results: GateResult[] = [];

function passed(name: string, detail: string, severity: GateResult["severity"] = "required") {
  results.push({ name, ok: true, detail, severity });
}
function failed(name: string, detail: string, remediation: string, severity: GateResult["severity"] = "required") {
  results.push({ name, ok: false, detail, remediation, severity });
}

async function main() {
  // 1. Env contract
  const readiness = getReadiness();
  for (const r of readiness.reports) {
    const sev = r.spec.severity === "required" ? "required" : "recommended";
    const name = `env: ${r.spec.key}`;
    if (r.status === "set") {
      passed(name, `${r.displayValue} — enables: ${r.spec.enables[0] ?? "n/a"}`, sev);
    } else if (r.status === "invalid") {
      failed(name, r.validationError ?? "invalid", r.spec.remediation, sev);
    } else if (r.spec.severity !== "optional") {
      failed(name, "missing", r.spec.remediation, sev);
    }
  }

  // 2. Database reachability
  if (hasDatabase()) {
    try {
      const { getPrisma } = await import("../lib/prisma");
      const prisma = getPrisma();
      // Light query — counts a small table that exists in every migration.
      // Failure here means the DB is unreachable or the schema isn't migrated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (prisma as any).vendorProfile.count();
      passed("database: reachable + migrated", `vendor_profiles row count = ${count}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed(
        "database: reachable + migrated",
        msg.split("\n")[0],
        "Verify DATABASE_URL credentials, run `npx prisma migrate deploy && npm run db:seed`.",
      );
    }
  } else {
    failed(
      "database: reachable + migrated",
      "DATABASE_URL not set — skipping connection test",
      "Set DATABASE_URL then re-run.",
    );
  }

  // 3. LLM provider
  if (hasLLM()) {
    passed("llm: extractor + classifier wired", "ANTHROPIC_API_KEY present and well-formed");
  } else {
    failed(
      "llm: extractor + classifier wired",
      "ANTHROPIC_API_KEY missing or malformed — agents will run in deterministic stub mode",
      "Get a key from console.anthropic.com and set ANTHROPIC_API_KEY (must start with sk-ant-).",
    );
  }

  // 4. Source manifest sanity
  const summary = manifestSummary();
  const orphanEntries = SOURCE_MANIFEST.filter((e) => !e.url || !/^https?:\/\//.test(e.url));
  if (orphanEntries.length === 0 && summary.totalSources > 0) {
    passed(
      "manifest: source URLs valid",
      `${summary.totalSources} sources across ${Object.keys(summary.byVendor).length} vendors (${Object.entries(summary.byCategory).map(([k, v]) => `${k}:${v}`).join(", ")})`,
    );
  } else {
    failed(
      "manifest: source URLs valid",
      `${orphanEntries.length} entries without a valid URL`,
      "Edit lib/sourcing/manifest.ts and ensure every entry has a https:// URL.",
    );
  }

  // 5. Evidence promotion gate — needs DB
  if (hasDatabase()) {
    try {
      const { getPrisma } = await import("../lib/prisma");
      const prisma = getPrisma();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verifiedCount = await (prisma as any).evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingCount = await (prisma as any).evidenceProposal.count({ where: { status: "pending" } });
      if (verifiedCount > 0) {
        passed("evidence: live data flowing", `${verifiedCount} analyst-verified rows · ${pendingCount} proposals pending review`);
      } else {
        failed(
          "evidence: live data flowing",
          `0 analyst-verified rows — dashboard will display 'seed estimate' until at least 1 proposal is approved`,
          "Run `npm run ingest -- --vendor vendor_<id>` then approve a proposal at /admin/evidence.",
          "recommended",
        );
      }
    } catch (err) {
      failed(
        "evidence: live data flowing",
        err instanceof Error ? err.message.split("\n")[0] : String(err),
        "Database query failed; ensure prisma migrations are applied.",
        "recommended",
      );
    }
  }

  // 6. Sourcing log dir
  try {
    await ensureLogDirReady();
    if (existsSync(logDirPath())) {
      passed("logs: sourcing log dir writeable", logDirPath(), "recommended");
    } else {
      failed(
        "logs: sourcing log dir writeable",
        `${logDirPath()} could not be created`,
        "On read-only filesystems set SOURCING_LOG_DIR to a writeable path (e.g. /tmp/sourcing).",
        "recommended",
      );
    }
  } catch (err) {
    failed(
      "logs: sourcing log dir writeable",
      err instanceof Error ? err.message : String(err),
      "Set SOURCING_LOG_DIR to a writeable path.",
      "recommended",
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const requiredFails = results.filter((r) => !r.ok && r.severity === "required");
  const recommendedFails = results.filter((r) => !r.ok && r.severity === "recommended");

  console.log("\nAI Enterpise · production readiness check");
  console.log("──────────────────────────────────────────");
  for (const r of results) {
    const tag = r.ok ? "\x1b[32m✓\x1b[0m" : r.severity === "required" ? "\x1b[31m✗\x1b[0m" : "\x1b[33m·\x1b[0m";
    console.log(`${tag} ${r.name.padEnd(48)} ${r.detail}`);
    if (!r.ok && r.remediation) console.log(`    → ${r.remediation}`);
  }
  console.log("──────────────────────────────────────────");
  console.log(`required: ${results.filter((r) => r.severity === "required" && r.ok).length} / ${results.filter((r) => r.severity === "required").length} passing`);
  console.log(`recommended: ${results.filter((r) => r.severity === "recommended" && r.ok).length} / ${results.filter((r) => r.severity === "recommended").length} passing`);

  if (requiredFails.length === 0) {
    console.log("\n\x1b[32mREADY\x1b[0m to deploy. " + (recommendedFails.length > 0 ? `${recommendedFails.length} recommended item(s) still open.` : ""));
    process.exit(0);
  } else {
    console.log(`\n\x1b[31mNOT READY\x1b[0m — ${requiredFails.length} required check(s) failing.`);
    console.log(`\nQuick reference: ${ENV_SPEC.filter((s) => s.severity === "required").map((s) => s.key).join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[prod-check] fatal", err);
  process.exit(1);
});
