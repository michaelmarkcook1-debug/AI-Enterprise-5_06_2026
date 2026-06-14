// CLI runner for evidence-queue triage.
//
//   npx tsx scripts/triage-evidence.ts                  → dry-run, prints lane counts
//   npx tsx scripts/triage-evidence.ts --vendor=msft    → dry-run, scoped to one vendor
//   npx tsx scripts/triage-evidence.ts --live           → applies auto_approves
//   npx tsx scripts/triage-evidence.ts --threshold=0.9  → tighter confidence floor
//   npx tsx scripts/triage-evidence.ts --decided-by=mike@ai.enterprise
//
// All decisions are appended to data/triage-audit.jsonl regardless of mode.

import { runTriage } from "../lib/services/triage-runner";
import { TRIAGE_AUDIT_FILE } from "../lib/services/triage-audit";

interface Args {
  dryRun: boolean;
  vendor?: string;
  threshold?: number;
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
    else if (a.startsWith("--threshold=")) args.threshold = Number(a.slice("--threshold=".length));
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
  const report = await runTriage({
    dryRun: args.dryRun,
    vendorId: args.vendor,
    autoApproveConfidence: args.threshold,
    decidedBy: args.decidedBy,
    limit: args.limit,
  });

  console.log("─── Triage report ───");
  console.log(`mode             : ${report.dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`proposals scanned: ${report.total}`);
  console.log(`auto_approve     : ${report.laneCounts.auto_approve}`);
  console.log(`recommend_approve: ${report.laneCounts.recommend_approve}`);
  console.log(`recommend_reject : ${report.laneCounts.recommend_reject}`);
  console.log(`human_review     : ${report.laneCounts.human_review_required}`);
  console.log(`applied (live)   : ${report.appliedCount}`);
  console.log(`classifier fallback rows : ${report.classifierFallbackCount}`);
  console.log(`audit lines      : ${report.auditWritten} → ${TRIAGE_AUDIT_FILE}`);
  console.log("\n─── Reason breakdown ───");
  for (const r of report.reasonCounts.slice(0, 15)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.reason}`);
  }
  if (report.reasonCounts.length > 15) {
    console.log(`  … and ${report.reasonCounts.length - 15} more reasons`);
  }
  if (report.applicationErrors.length > 0) {
    console.log("\napplication errors:");
    for (const e of report.applicationErrors) {
      console.log(`  ${e.proposalId}: ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
