// Idempotent production loader for the full vendor universe.
// ─────────────────────────────────────────────────────────
//   npx tsx scripts/load-vendor-universe.ts            # preserve live scores
//   npx tsx scripts/load-vendor-universe.ts --update-scores   # also reset scores from seed
//
// Non-destructive: upserts vendors + role/infra/structural metadata, pillar
// scores, market categories/shares, capability catalog, and creates momentum +
// vendor-capability rows for vendors that lack them. Never deletes. Run after a
// backup (scripts/backup-db.ts).

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env.development.local" });

import { getPrisma } from "../lib/prisma";
import { loadVendorUniverse } from "../lib/intelligence/load-universe";

async function main() {
  const updateScores = process.argv.includes("--update-scores");
  const prisma = getPrisma();
  const before = await prisma.intelligenceVendor.count();
  console.log(`Loading vendor universe (updateScores=${updateScores}). Vendors before: ${before}`);

  const result = await loadVendorUniverse(prisma, { updateScores });

  const after = await prisma.intelligenceVendor.count();
  console.log("Result:", result);
  console.log(`Vendors after: ${after} (added ${after - before})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Load failed:", err);
  process.exit(1);
});
