// Reclassification runner for proposals where the original classify call
// failed (or was stamped with the legacy 0.5 fallback).
//
// Usage:
//   npx tsx scripts/reclassify-failed-proposals.ts                # dry-run
//   npx tsx scripts/reclassify-failed-proposals.ts --live         # apply
//   npx tsx scripts/reclassify-failed-proposals.ts --live --vendor=msft
//   npx tsx scripts/reclassify-failed-proposals.ts --live --limit=50
//   npx tsx scripts/reclassify-failed-proposals.ts --code=schema_validation
//
// Targets:
//   classificationFailed = true                          (post-migration)
//   OR confidenceIsFallback = true                       (post-migration backfill)
//   OR (classifierConfidence = 0.5 AND classifierRationale IS NULL)  (legacy)
//
// All decisions are logged to logs/sourcing/<date>.ndjson.

import { hasDatabase, getPrisma } from "../lib/prisma";
import { classifyEvidence } from "../lib/agents/evidence-classifier";
import { hasLLM } from "../lib/agents/llm-client";
import { categoriseClassifyFailure } from "../lib/sourcing/runner";

interface Args {
  dryRun: boolean;
  vendor?: string;
  limit?: number;
  failureCode?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: true };
  for (const a of argv) {
    if (a === "--live") args.dryRun = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else if (a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
    else if (a.startsWith("--code=")) args.failureCode = a.slice("--code=".length);
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
    console.error("DATABASE_URL is not set; nothing to reclassify.");
    process.exit(1);
  }
  if (!hasLLM() && !args.dryRun) {
    console.error("ANTHROPIC_API_KEY is not set; refusing live reclassify (would all stub).");
    process.exit(1);
  }

  const client = getPrisma();
  const where: Record<string, unknown> = {
    status: "pending",
    OR: [
      { classificationFailed: true },
      { confidenceIsFallback: true },
      { AND: [{ classifierConfidence: 0.5 }, { classifierRationale: null }] },
    ],
  };
  if (args.vendor) where.vendorId = args.vendor;
  if (args.failureCode) where.classificationFailureCode = args.failureCode;

  const candidates = await client.evidenceProposal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: args.limit ?? 1000,
  });

  console.log("─── Reclassify failed proposals ───");
  console.log(`mode      : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`candidates: ${candidates.length}`);
  if (args.vendor) console.log(`vendor    : ${args.vendor}`);
  if (args.failureCode) console.log(`code      : ${args.failureCode}`);

  if (args.dryRun) {
    // Group by current failure code so the operator can see what's queued.
    const byCode = new Map<string, number>();
    for (const c of candidates) {
      const k = c.classificationFailureCode ?? "legacy_0_5_fallback";
      byCode.set(k, (byCode.get(k) ?? 0) + 1);
    }
    console.log("\nby failure code:");
    for (const [code, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${code}`);
    }
    console.log("\n(dry-run — pass --live to actually reclassify)");
    return;
  }

  // Live path. Reclassify one at a time so a single LLM blowup doesn't
  // poison a batch. Each call is wrapped in a timeout so a hung
  // Anthropic retry can't freeze the whole run.
  let okCount = 0;
  let failCount = 0;
  const failureCounts = new Map<string, number>();
  const PER_CALL_TIMEOUT_MS = 60_000;

  for (const [i, p] of candidates.entries()) {
    const t0 = Date.now();
    process.stdout.write(`  [${i + 1}/${candidates.length}] ${p.id} ${p.vendorId}/${p.subfactor} … `);
    try {
      const result = await Promise.race([
        classifyEvidence({
          vendorName: p.vendorId,
          sourceCategory: "vendor_docs",
          sourceUrl: p.sourceUrl ?? "",
          proposal: {
            domain: p.domain,
            subfactor: p.subfactor,
            excerpt: p.excerpt,
            proposedGrade: p.proposedGrade,
            proposedRawScore: p.proposedRawScore,
            rationale: p.classifierRationale ?? "Reclassify pass — original rationale not available",
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${PER_CALL_TIMEOUT_MS}ms`)), PER_CALL_TIMEOUT_MS),
        ),
      ]);
      await client.evidenceProposal.update({
        where: { id: p.id },
        data: {
          classifierConfidence: result.data.confidence,
          classifierRationale: result.data.rationale,
          proposedGrade: result.data.finalGrade,
          proposedRawScore: result.data.finalRawScore,
          classificationFailed: false,
          classificationFailureCode: null,
          classificationFailureReason: null,
          confidenceIsFallback: false,
        },
      });
      okCount += 1;
      console.log(`ok (${Date.now() - t0}ms, ${(result.data.confidence * 100).toFixed(0)}%)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = categoriseClassifyFailure(message);
      await client.evidenceProposal.update({
        where: { id: p.id },
        data: {
          classificationFailed: true,
          classificationFailureCode: failure.code,
          classificationFailureReason: failure.reason,
          confidenceIsFallback: true,
        },
      });
      failureCounts.set(failure.code, (failureCounts.get(failure.code) ?? 0) + 1);
      failCount += 1;
      console.log(`FAIL (${Date.now() - t0}ms, ${failure.code})`);
    }
  }

  console.log("\n─── Result ───");
  console.log(`reclassified ok : ${okCount}`);
  console.log(`still failing   : ${failCount}`);
  if (failureCounts.size > 0) {
    console.log("\nresidual failures by code:");
    for (const [code, n] of [...failureCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(4)}  ${code}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
