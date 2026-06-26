// One-shot DB inventory script — run with: npx tsx scripts/db-inventory.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getPrisma } from "../lib/prisma";

async function main() {
  const prisma = getPrisma();

  // Single query to count all tables confirmed to exist in the live Neon DB
  // (5 migrations pending: no articles, delivery_partners/partnerships, subscribers, member_sessions)
  const counts = await prisma.$queryRaw<{ tbl: string; rows: bigint }[]>`
    SELECT 'intelligence_vendors'            AS tbl, COUNT(*) AS rows FROM intelligence_vendors
    UNION ALL SELECT 'vendor_evidence_items',       COUNT(*) FROM vendor_evidence_items
    UNION ALL SELECT 'vendor_profiles',             COUNT(*) FROM vendor_profiles
    UNION ALL SELECT 'vendor_pillar_scores',        COUNT(*) FROM vendor_pillar_scores
    UNION ALL SELECT 'vendor_scores',               COUNT(*) FROM vendor_scores
    UNION ALL SELECT 'vendor_momentum',             COUNT(*) FROM vendor_momentum
    UNION ALL SELECT 'market_share_estimates',      COUNT(*) FROM market_share_estimates
    UNION ALL SELECT 'vendor_ranking_snapshots',    COUNT(*) FROM vendor_ranking_snapshots
    UNION ALL SELECT 'ingestion_jobs',              COUNT(*) FROM ingestion_jobs
    UNION ALL SELECT 'assessment_runs',             COUNT(*) FROM assessment_runs
    UNION ALL SELECT 'intelligence_news_items',     COUNT(*) FROM intelligence_news_items
    UNION ALL SELECT 'evidence_sources',            COUNT(*) FROM evidence_sources
    UNION ALL SELECT 'evidence_proposals',          COUNT(*) FROM evidence_proposals
    UNION ALL SELECT 'market_categories',           COUNT(*) FROM market_categories
    UNION ALL SELECT 'capabilities',                COUNT(*) FROM capabilities
    UNION ALL SELECT 'vendor_capabilities',         COUNT(*) FROM vendor_capabilities
    UNION ALL SELECT 'vendor_products',             COUNT(*) FROM vendor_products
    UNION ALL SELECT 'vendor_sources',              COUNT(*) FROM vendor_sources
    UNION ALL SELECT 'vendor_industry_adoption',    COUNT(*) FROM vendor_industry_adoption
    UNION ALL SELECT 'vendor_category_change_proposals', COUNT(*) FROM vendor_category_change_proposals
    UNION ALL SELECT 'scoring_rules',               COUNT(*) FROM scoring_rules
    UNION ALL SELECT 'risk_flags',                  COUNT(*) FROM risk_flags
    UNION ALL SELECT 'manifest_patches',            COUNT(*) FROM manifest_patches
    UNION ALL SELECT 'watchlists',                  COUNT(*) FROM watchlists
    UNION ALL SELECT 'user_state',                  COUNT(*) FROM user_state
    UNION ALL SELECT 'daily_refresh_runs',          COUNT(*) FROM daily_refresh_runs
    UNION ALL SELECT 'admin_jobs',                  COUNT(*) FROM admin_jobs
    UNION ALL SELECT 'admin_run_log',               COUNT(*) FROM admin_run_log
    UNION ALL SELECT 'investor_live_snapshot',      COUNT(*) FROM investor_live_snapshot
  `;

  console.log("=== TABLE COUNTS ===");
  for (const r of counts) console.log(`  ${r.tbl.padEnd(32)}: ${r.rows}`);

  // Evidence records breakdown
  const evStatus = await prisma.$queryRaw<{ review_status: string; n: bigint }[]>`
    SELECT review_status, COUNT(*) AS n FROM vendor_evidence_items GROUP BY review_status ORDER BY n DESC
  `;
  if (evStatus.length) {
    console.log("\n=== EVIDENCE_RECORDS by review_status ===");
    for (const r of evStatus) console.log(`  ${r.review_status}: ${r.n}`);
  }

  const evByVendor = await prisma.$queryRaw<{ vendor_id: string; n: bigint }[]>`
    SELECT vendor_id, COUNT(*) AS n FROM vendor_evidence_items GROUP BY vendor_id ORDER BY n DESC LIMIT 35
  `;
  if (evByVendor.length) {
    console.log("\n=== EVIDENCE_RECORDS by vendor (top 35) ===");
    for (const r of evByVendor) console.log(`  ${(r.vendor_id ?? "(null)").padEnd(32)}: ${r.n}`);
  }

  const evDates = await prisma.$queryRaw<{ oldest: Date; newest: Date }[]>`
    SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest FROM vendor_evidence_items
  `;
  if (evDates[0]?.oldest) {
    console.log(`\n  oldest evidence: ${evDates[0].oldest.toISOString()}`);
    console.log(`  newest evidence: ${evDates[0].newest.toISOString()}`);
  }

  // Market share estimates breakdown
  const msBySource = await prisma.$queryRaw<{ source: string; n: bigint }[]>`
    SELECT source, COUNT(*) AS n FROM market_share_estimates GROUP BY source ORDER BY n DESC
  `;
  if (msBySource.length) {
    console.log("\n=== MARKET_SHARE_ESTIMATES by source ===");
    for (const r of msBySource) console.log(`  ${r.source}: ${r.n}`);
  }

  // Ingestion jobs — recent + status breakdown
  const jobStatus = await prisma.$queryRaw<{ status: string; n: bigint }[]>`
    SELECT status, COUNT(*) AS n FROM ingestion_jobs GROUP BY status ORDER BY n DESC
  `;
  if (jobStatus.length) {
    console.log("\n=== INGESTION_JOBS by status ===");
    for (const r of jobStatus) console.log(`  ${r.status}: ${r.n}`);
  }

  const recentJobs = await prisma.$queryRaw<{ vendor_id: string; status: string; created_at: Date }[]>`
    SELECT vendor_id, status, created_at FROM ingestion_jobs ORDER BY created_at DESC LIMIT 20
  `;
  if (recentJobs.length) {
    console.log("\n=== LAST 20 INGESTION JOBS ===");
    for (const r of recentJobs) {
      console.log(`  ${r.created_at?.toISOString()?.slice(0, 16)} | ${(r.vendor_id ?? "all").padEnd(28)} | ${r.status}`);
    }
  }

  // Pillar scores breakdown
  const pillarKeys = await prisma.$queryRaw<{ pillar_key: string; n: bigint }[]>`
    SELECT pillar_key, COUNT(*) AS n FROM vendor_pillar_scores GROUP BY pillar_key ORDER BY n DESC
  `;
  if (pillarKeys.length) {
    console.log("\n=== INTELLIGENCE_PILLAR_SCORES by pillar_key ===");
    for (const r of pillarKeys) console.log(`  ${r.pillar_key}: ${r.n}`);
  }

  // News items breakdown (intelligence_news_items)
  const newsDates = await prisma.$queryRaw<{ oldest: Date; newest: Date }[]>`
    SELECT MIN(published_at) AS oldest, MAX(published_at) AS newest FROM intelligence_news_items
  `;
  if (newsDates[0]?.oldest) {
    console.log(`\n  news oldest: ${newsDates[0].oldest.toISOString()}`);
    console.log(`  news newest: ${newsDates[0].newest.toISOString()}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message ?? e); process.exit(1); });
