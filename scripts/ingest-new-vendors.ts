// One-off targeted ingestion for the 10 thin-tail vendors wired in Batch-4 #03.
// Creates PENDING evidence proposals (reversible — they await review/triage,
// never auto-approved). Run: npx tsx scripts/ingest-new-vendors.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runSourcing } from "../lib/sourcing/runner";

const NEW_VENDORS = [
  "vendor_fireworks", "vendor_together", "vendor_humain", "vendor_g42",
  "vendor_moonshot", "vendor_zai", "vendor_xai", "vendor_lambda",
  "vendor_sakana", "vendor_perplexity",
];

async function main() {
  let cost = 0, extracted = 0, persisted = 0, sourcesOk = 0, sourcesFailed = 0;
  console.log(`Ingesting ${NEW_VENDORS.length} new vendors (pending proposals, live DB)\n`);
  for (const v of NEW_VENDORS) {
    try {
      const r = await runSourcing({ vendorId: v, persist: true });
      const t = r.totals;
      cost += t.estimatedCostUsd; extracted += t.proposalsExtracted;
      persisted += t.proposalsPersisted; sourcesOk += t.ok; sourcesFailed += t.failed;
      console.log(
        `${v.padEnd(20)} sources=${t.sources} ok=${t.ok} fail=${t.failed} extracted=${t.proposalsExtracted} persisted=${t.proposalsPersisted} $${t.estimatedCostUsd.toFixed(4)}` +
        (t.firstError ? `  ERR: ${t.firstError}` : ""),
      );
    } catch (e) {
      console.log(`${v.padEnd(20)} THREW: ${(e as Error).message}`);
    }
  }
  console.log(`\n=== TOTAL ===`);
  console.log(`cost=$${cost.toFixed(4)} | proposalsExtracted=${extracted} | proposalsPersisted=${persisted} | sourcesOk=${sourcesOk} | sourcesFailed=${sourcesFailed}`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).then(() => process.exit(0));
