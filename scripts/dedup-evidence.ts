// CLI runner for evidence deduplication.
//
//   npx tsx scripts/dedup-evidence.ts                     → report only (default)
//   npx tsx scripts/dedup-evidence.ts --vendor=msft       → scoped report
//   npx tsx scripts/dedup-evidence.ts --threshold=0.9     → tighter near-dup
//   npx tsx scripts/dedup-evidence.ts --exact-merge       → APPLIES exact merges (opt-in)
//
// Even with --exact-merge, near-duplicates are ALWAYS report-only.
// Classifier-fallback rows are NEVER auto-merged; they're routed to
// human review until reclassification.

import { runDedup, type DedupMode } from "../lib/services/dedup-runner";

interface Args {
  mode: DedupMode;
  vendor?: string;
  limit?: number;
  threshold?: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { mode: "report" };
  for (const a of argv) {
    if (a === "--exact-merge") args.mode = "exact_merge";
    else if (a === "--report") args.mode = "report";
    else if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else if (a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
    else if (a.startsWith("--threshold=")) args.threshold = Number(a.slice("--threshold=".length));
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const result = await runDedup({
    mode: args.mode,
    vendorId: args.vendor,
    limit: args.limit,
    nearSimilarityThreshold: args.threshold,
  });

  const r = result.report;
  console.log("─── Evidence dedup report ───");
  console.log(`mode                    : ${result.mode === "exact_merge" ? "EXACT-MERGE (live)" : "REPORT (read-only)"}`);
  console.log(`proposals scanned       : ${r.totalInput}`);
  console.log(`exact duplicate clusters: ${r.exactClusterCount}`);
  console.log(`exact duplicate rows    : ${r.exactDuplicateRows}`);
  console.log(`near duplicate clusters : ${r.nearClusterCount}`);
  console.log(`near duplicate rows     : ${r.nearDuplicateRows}`);
  console.log(`SAFE for auto-merge     : ${r.safeAutoMergeRows}`);
  console.log(`needs human review      : ${r.humanReviewRows}`);
  console.log(`merge actions planned   : ${result.mergeActions.length}`);
  console.log(`merge actions applied   : ${result.mergedCount}`);

  if (r.exactClusters.length > 0) {
    console.log("\n── Top 5 exact clusters ──");
    for (const c of r.exactClusters.slice(0, 5)) {
      console.log(
        `  ${c.members.length}× | ${c.vendorId} · ${c.domain} · ${c.subfactor}`,
      );
      console.log(`         url: ${c.canonicalSourceUrl}`);
      console.log(`         ids: ${c.members.map((m) => m.id).join(", ")}`);
    }
  }

  if (r.nearClusters.length > 0) {
    console.log("\n── Top 5 near clusters ──");
    for (const c of r.nearClusters.slice(0, 5)) {
      console.log(
        `  ${c.members.length}× | sim=${c.maxSimilarity.toFixed(2)} | ${c.vendorId} · ${c.subfactor} · week ${c.captureWeekStart}`,
      );
      console.log(`         ids: ${c.members.map((m) => m.id).join(", ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
