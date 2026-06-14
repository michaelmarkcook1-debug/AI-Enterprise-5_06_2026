import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { runCompetitiveIntelMonitor } from "../lib/intelligence/competitive-monitor";
import { getPrisma } from "../lib/prisma";
async function main() {
  const t0 = Date.now();
  const r = await runCompetitiveIntelMonitor(new Date());
  console.log("competitive-intel result:", JSON.stringify({
    vendorsAttempted: r.vendorsAttempted,
    vendorsWithFindings: r.vendorsWithFindings,
    itemsUpserted: r.itemsUpserted,
    totalSearches: r.totalSearches,
    source: r.source,
    errors: r.errors.length,
  }, null, 2));
  if (r.errors.length) console.log("sample errors:", r.errors.slice(0, 4));
  console.log(`elapsed ${Math.round((Date.now()-t0)/1000)}s`);
  await getPrisma().$disconnect();
}
main().catch(e => { console.error("FAILED:", e?.message); process.exit(1); });
