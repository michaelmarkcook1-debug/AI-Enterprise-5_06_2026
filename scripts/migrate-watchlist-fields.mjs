// One-off migration: add email + user_id columns to watchlists table.
// Safe to re-run (uses ADD COLUMN IF NOT EXISTS).
// Run with: node scripts/migrate-watchlist-fields.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = join(__dirname, "../.env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch { /* no .env.local — rely on environment */ }

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const client = new Client({ connectionString: url });

async function run() {
  await client.connect();
  console.log("Running watchlist migration…");
  await client.query("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS email TEXT");
  await client.query("ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS user_id TEXT");
  await client.query("CREATE INDEX IF NOT EXISTS watchlists_user_id_idx ON watchlists (user_id)");
  console.log("✓ Migration complete.");
  await client.end();
  process.exit(0);
}

run().catch(async (e) => { console.error("Migration failed:", e.message); await client.end(); process.exit(1); });
