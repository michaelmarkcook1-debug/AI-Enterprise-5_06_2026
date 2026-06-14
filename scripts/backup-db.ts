// Non-destructive logical backup of the production Neon database.
// ──────────────────────────────────────────────────────────────
// Dumps every table in the `public` schema to timestamped JSON files
// under backups/<ISO-timestamp>/, plus a manifest with row counts.
//
//   npx tsx scripts/backup-db.ts
//
// Uses the UNPOOLED connection (direct endpoint) for a clean bulk read.
// Reads credentials from .env.local (falling back to .env.development.local).
// This is a SAFETY snapshot taken before any schema migration or data load.
// It performs ZERO writes.

import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Load env explicitly — tsx does not auto-load .env files.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env.development.local" });

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error("No database URL found (DATABASE_URL_UNPOOLED / DATABASE_URL).");
  process.exit(1);
}

function stamp(): string {
  // Safe in a normal node process (not a Workflow sandbox).
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const ts = stamp();
  const outDir = join("backups", ts);
  mkdirSync(outDir, { recursive: true });

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const host = (() => {
    try { return new URL(connectionString!).host; } catch { return "unknown"; }
  })();
  console.log(`Backing up ${host} → ${outDir}`);

  const { rows: tables } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const manifest: Array<{ table: string; rows: number; error?: string }> = [];
  let grandTotal = 0;

  for (const { tablename } of tables) {
    try {
      const res = await client.query(`SELECT * FROM "${tablename}"`);
      writeFileSync(
        join(outDir, `${tablename}.json`),
        JSON.stringify(res.rows, null, 2),
      );
      manifest.push({ table: tablename, rows: res.rowCount ?? res.rows.length });
      grandTotal += res.rowCount ?? res.rows.length;
      console.log(`  ✓ ${tablename.padEnd(36)} ${res.rowCount ?? res.rows.length} rows`);
    } catch (err) {
      const message = (err as Error).message;
      manifest.push({ table: tablename, rows: -1, error: message });
      console.error(`  ✗ ${tablename}: ${message}`);
    }
  }

  writeFileSync(
    join(outDir, "_manifest.json"),
    JSON.stringify(
      { takenAt: new Date().toISOString(), host, tableCount: tables.length, totalRows: grandTotal, tables: manifest },
      null,
      2,
    ),
  );

  await client.end();
  console.log(`\nBackup complete: ${tables.length} tables, ${grandTotal} total rows → ${outDir}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
