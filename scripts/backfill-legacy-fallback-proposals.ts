// One-time backfill for legacy classifier-fallback EvidenceProposal rows.
// ──────────────────────────────────────────────────────────────────────
// The original migration's WHERE clause required `classifier_rationale
// IS NULL` which missed every row — pre-fix the runner kept the
// extractor's rationale on classifier failure, so rationale was non-null
// for all 312 legacy fallbacks. This script applies the broader,
// correct heuristic.
//
// Heuristic (must ALL hold):
//   status = pending
//   classifierConfidence = 0.5 (exact)
//   classificationFailed != true
//   confidenceIsFallback != true
//   classificationFailureCode IS NULL
//
// Backfill payload:
//   classificationFailed         = true
//   confidenceIsFallback         = true
//   classificationFailureCode    = "legacy_fallback_0_5"
//   classificationFailureReason  = "Legacy fallback confidence row created
//                                   before failure metadata existed"
//
// Usage:
//   npx tsx scripts/backfill-legacy-fallback-proposals.ts            # dry-run
//   npx tsx scripts/backfill-legacy-fallback-proposals.ts --live     # apply
//   npx tsx scripts/backfill-legacy-fallback-proposals.ts --vendor=msft

import { hasDatabase, getPrisma } from "../lib/prisma";
import {
  LEGACY_FALLBACK_CODE,
  LEGACY_FALLBACK_REASON,
  isLegacyFallbackRow,
} from "../lib/services/legacy-fallback-backfill";

interface Args {
  dryRun: boolean;
  vendor?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: true };
  for (const a of argv) {
    if (a === "--live") args.dryRun = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to backfill.");
    process.exit(1);
  }
  const prisma = getPrisma();

  // Pre-flight summary: pull every pending row that COULD be a legacy
  // fallback, then filter in code with the canonical detector. Doing it
  // this way instead of a single SQL UPDATE means the filter rules are
  // shared with the unit tests.
  const candidates = await prisma.evidenceProposal.findMany({
    where: {
      status: "pending",
      vendorId: args.vendor,
      classifierConfidence: 0.5,
    },
    select: {
      id: true,
      vendorId: true,
      status: true,
      classifierConfidence: true,
      classificationFailed: true,
      confidenceIsFallback: true,
      classificationFailureCode: true,
    },
  });

  const legacyMatches = candidates.filter(isLegacyFallbackRow);
  const skippedAlreadyMarked = candidates.length - legacyMatches.length;

  // Sanity check: count rows we're explicitly preserving (the two known
  // real-classifier rows at 0.91/0.92 — do not touch them).
  const realClassifier = await prisma.evidenceProposal.count({
    where: {
      status: "pending",
      vendorId: args.vendor,
      NOT: { classifierConfidence: 0.5 },
    },
  });

  console.log("─── Legacy fallback backfill ───");
  console.log(`mode                          : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  if (args.vendor) console.log(`vendor scope                  : ${args.vendor}`);
  console.log(`pending @ 0.5 candidates      : ${candidates.length}`);
  console.log(`  → match legacy heuristic    : ${legacyMatches.length}`);
  console.log(`  → already marked / coded    : ${skippedAlreadyMarked}`);
  console.log(`pending NOT @ 0.5 (preserved) : ${realClassifier}`);

  if (args.dryRun) {
    console.log("\n(dry-run — no rows updated. Pass --live to apply.)");
    return;
  }

  if (legacyMatches.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  const ids = legacyMatches.map((r) => r.id);
  const result = await prisma.evidenceProposal.updateMany({
    where: {
      id: { in: ids },
      // Belt-and-braces: re-assert the full heuristic in the WHERE
      // clause so a concurrent write between SELECT and UPDATE can't
      // sneak a not-actually-legacy row through. classificationFailed
      // and confidenceIsFallback are NOT NULL columns post-migration,
      // so the comparator is plain `false`, not OR-with-null.
      status: "pending",
      classifierConfidence: 0.5,
      classificationFailed: false,
      confidenceIsFallback: false,
      classificationFailureCode: null,
    },
    data: {
      classificationFailed: true,
      confidenceIsFallback: true,
      classificationFailureCode: LEGACY_FALLBACK_CODE,
      classificationFailureReason: LEGACY_FALLBACK_REASON,
    },
  });

  console.log(`\nBackfilled rows               : ${result.count}`);
  if (result.count !== legacyMatches.length) {
    console.warn(
      `WARNING: planned=${legacyMatches.length} but updated=${result.count} — concurrent write or guard mismatch.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
