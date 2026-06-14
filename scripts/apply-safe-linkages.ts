// CLI: apply safe (status=ok, conf ≥0.95, no competing) linkages to
// pending EvidenceProposal rows.
//
//   npx tsx scripts/apply-safe-linkages.ts                  → dry-run
//   npx tsx scripts/apply-safe-linkages.ts --vendor=msft    → scoped
//   npx tsx scripts/apply-safe-linkages.ts --live           → apply
//   npx tsx scripts/apply-safe-linkages.ts --decided-by=mike@ai.enterprise --live

import { runSafeLinkageApply } from "../lib/services/safe-linkage-runner";
import { LINKAGE_AUDIT_FILE } from "../lib/services/safe-linkage-apply";

interface Args {
  dryRun: boolean;
  vendor?: string;
  decidedBy?: string;
  limit?: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: true };
  for (const a of argv) {
    if (a === "--live") args.dryRun = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else if (a.startsWith("--decided-by=")) args.decidedBy = a.slice("--decided-by=".length);
    else if (a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const r = await runSafeLinkageApply({
    dryRun: args.dryRun,
    vendorId: args.vendor,
    decidedBy: args.decidedBy,
    limit: args.limit,
  });

  console.log("─── Safe linkage apply ───");
  console.log(`mode               : ${r.dryRun ? "DRY-RUN" : "LIVE"}`);
  if (args.vendor) console.log(`vendor scope       : ${args.vendor}`);
  console.log(`eligible (ok)      : ${r.plan.eligible.length}`);
  console.log(`skipped total      : ${r.plan.skipped.length}`);
  if (Object.keys(r.plan.skippedByStatus).length > 0) {
    console.log("  by status:");
    for (const [status, n] of Object.entries(r.plan.skippedByStatus).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${status}`);
    }
  }
  console.log(`audit lines        : ${r.auditWritten} → ${LINKAGE_AUDIT_FILE}`);
  if (!r.dryRun) console.log(`applied to DB      : ${r.appliedCount}`);
  if (r.errors.length > 0) {
    console.log("\nerrors:");
    for (const e of r.errors) console.log(`  ${e.proposalId}: ${e.error}`);
  }

  if (r.plan.eligible.length > 0) {
    console.log("\n── Sample of eligible linkages (top 10) ──");
    for (const e of r.plan.eligible.slice(0, 10)) {
      console.log(`  ${e.proposalId}  →  ${e.productName}  (${(e.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (r.dryRun) console.log("\n(dry-run — pass --live to apply.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
