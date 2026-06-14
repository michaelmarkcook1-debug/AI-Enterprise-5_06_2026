// CLI runner for the sourcing pipeline.
//
//   npm run ingest              → runs the full manifest
//   npm run ingest -- --vendor vendor_openai
//   npm run ingest -- --url https://trust.openai.com/
//   npm run ingest -- --dry-run (extract but do not persist, even if DB is set)
//
// All output is also written to logs/sourcing/{date}.ndjson — pipe the file to
// jq for forensic analysis. Exit code is non-zero only if every source failed.

import { runSourcing } from "../lib/sourcing/runner";
import { manifestSummary } from "../lib/sourcing/manifest";
import { ensureLogDirReady, logDirPath } from "../lib/sourcing/logger";

function parseArgs(argv: string[]) {
  const args: { vendor?: string; url?: string; dryRun?: boolean; help?: boolean } = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vendor" || a === "-v") args.vendor = argv[++i];
    else if (a === "--url" || a === "-u") args.url = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`
Usage: npm run ingest -- [options]
  --vendor <id>   Restrict to one vendor (e.g. vendor_openai)
  --url <url>     Restrict to one URL from the manifest
  --dry-run       Skip DB persistence even when DATABASE_URL is set
  --help          This help
`);
    return;
  }

  await ensureLogDirReady();
  const summary = manifestSummary();
  console.log(`[sourcing] manifest: ${summary.totalSources} sources across ${Object.keys(summary.byVendor).length} vendors`);
  console.log(`[sourcing] log dir : ${logDirPath()}`);

  const result = await runSourcing({
    vendorId: args.vendor,
    sourceUrl: args.url,
    persist: !args.dryRun,
  });

  console.log("\n──── run summary ───────────────────────────────────────");
  console.log(`runId            ${result.runId}`);
  console.log(`duration         ${result.durationMs} ms`);
  console.log(`llmSource        ${result.llmSource}`);
  console.log(`databaseConfigured ${result.databaseConfigured}`);
  console.log(`sources tried    ${result.totals.sources}`);
  console.log(`  ok             ${result.totals.ok}`);
  console.log(`  failed         ${result.totals.failed}`);
  console.log(`  skipped        ${result.totals.skipped}`);
  console.log(`proposals extracted ${result.totals.proposalsExtracted}`);
  console.log(`proposals persisted ${result.totals.proposalsPersisted}`);

  if (result.totals.failed > 0) {
    console.log("\nFailed sources:");
    for (const o of result.outcomes) {
      if (o.status === "ok" || o.status === "skipped") continue;
      console.log(`  ✗ ${o.vendorId}  ${o.url}  → ${o.status}: ${o.error}`);
    }
  }

  // Non-zero only if literally every source failed.
  if (result.totals.sources > 0 && result.totals.ok === 0) process.exit(1);
}

main().catch((err) => {
  console.error("[sourcing] fatal", err);
  process.exit(1);
});
