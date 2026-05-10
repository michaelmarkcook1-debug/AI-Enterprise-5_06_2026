// CLI for the Product Linkage Assist.
//
//   npx tsx scripts/product-linkage-review.ts                 → aggregate report
//   npx tsx scripts/product-linkage-review.ts --vendor=msft   → vendor-scoped
//   npx tsx scripts/product-linkage-review.ts --batch=20      → next 20 rows for review
//   npx tsx scripts/product-linkage-review.ts --batch=20 --offset=20
//
// The CLI is read-only — it never writes to the DB. Operators confirm
// linkages through the existing approval endpoint or via a future
// dedicated assist UI.

import { buildLinkageReport, type LinkageReport } from "../lib/services/product-linkage-runner";

interface Args {
  vendor?: string;
  batch?: number;
  offset?: number;
  limit?: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {};
  for (const a of argv) {
    if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else if (a.startsWith("--batch=")) args.batch = Number(a.slice("--batch=".length));
    else if (a.startsWith("--offset=")) args.offset = Number(a.slice("--offset=".length));
    else if (a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printAggregate(report: LinkageReport) {
  console.log("─── Product Linkage Assist — aggregate report ───");
  console.log(`recommend_approve total : ${report.totalRecommendApprove}`);
  console.log(`blocked on linkage      : ${report.blockedOnLinkage}`);

  console.log("\nBy linkage status:");
  for (const r of report.byLinkageStatus) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.status}`);
  }

  console.log("\nBy vendor (top 15):");
  for (const r of report.byVendor.slice(0, 15)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.vendorId}`);
  }

  console.log("\nBy domain/subfactor (top 15):");
  for (const r of report.byDomainSubfactor.slice(0, 15)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.key}`);
  }

  console.log("\nBy sourceUrl (top 15):");
  for (const r of report.bySourceUrl.slice(0, 15)) {
    console.log(`  ${String(r.count).padStart(4)}  ${r.sourceUrl}`);
  }
}

function printBatch(report: LinkageReport, batchSize: number, offset: number) {
  const slice = report.rows.slice(offset, offset + batchSize);
  console.log(
    `─── Batch review ${offset + 1}–${offset + slice.length} of ${report.rows.length} (recommend_approve only) ───`,
  );
  if (slice.length === 0) {
    console.log("(no more rows in this offset window)");
    return;
  }
  for (const [i, r] of slice.entries()) {
    const idx = offset + i + 1;
    console.log(`\n[${idx}] ${r.proposalId}`);
    console.log(`    vendor       : ${r.vendorId}`);
    console.log(`    domain       : ${r.domain}`);
    console.log(`    subfactor    : ${r.subfactor}`);
    console.log(`    grade        : ${r.proposedGrade}`);
    console.log(`    classifier   : ${(r.classifierConfidence * 100).toFixed(0)}%`);
    console.log(`    source       : ${r.sourceUrl ?? "(none)"}`);
    console.log(`    excerpt      : ${r.excerpt.slice(0, 200)}${r.excerpt.length > 200 ? "…" : ""}`);
    console.log(`    linkage      : ${r.linkage.status}`);
    if (r.linkage.suggestions.length === 0) {
      console.log(`      (no suggestions — operator must select manually)`);
    } else {
      for (const s of r.linkage.suggestions.slice(0, 3)) {
        const flag = s.safeToApply ? " ✓ safe" : "";
        console.log(
          `      • ${(s.confidence * 100).toFixed(0)}%  ${s.productScopeId}${flag}`,
        );
        console.log(`        reason: ${s.reason}`);
      }
    }
  }
}

async function main() {
  const args = parseArgs();
  const report = await buildLinkageReport({ vendorId: args.vendor, limit: args.limit });

  if (args.batch && args.batch > 0) {
    printBatch(report, args.batch, args.offset ?? 0);
  } else {
    printAggregate(report);
    console.log("\n(For batch review: --batch=20 [--offset=20])");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
