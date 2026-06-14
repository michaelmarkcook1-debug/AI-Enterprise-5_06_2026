// Quote every value in .env.local so Node's --env-file parser handles
// edge cases (values containing `#`, leading whitespace, special chars)
// the same way bash source does.
//
// Why this exists:
//   Bash source ".env.local" tolerates a wide range of value shapes.
//   Node's `--env-file=.env.local` is stricter — values with `#` get
//   truncated as inline comments, values with leading whitespace fail
//   to load, and so on. Concretely: a 108-char ANTHROPIC_API_KEY that
//   bash reads correctly can come through Node as length 0, causing
//   vendorDocs to flip from ok → not_configured between runs depending
//   on how the env was loaded.
//
//   Wrapping every value in double quotes makes both parsers agree.
//
// Safety:
//   - Dry-run by default. Shows line counts only, never values.
//   - Live mode writes a .env.local.bak before mutating.
//   - Already-quoted lines (starting with `"` or `'`) are left alone.
//   - Comment lines and blank lines are preserved verbatim.
//   - NEVER prints any value to stdout.
//
// Usage:
//   npx tsx scripts/quote-env-local.ts          → dry-run
//   npx tsx scripts/quote-env-local.ts --live   → apply

import { promises as fs } from "node:fs";
import path from "node:path";

const ENV_FILE = path.resolve(process.cwd(), ".env.local");
const BACKUP_FILE = path.resolve(process.cwd(), ".env.local.bak");

interface Args { dryRun: boolean }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let dryRun = true;
  for (const a of argv) {
    if (a === "--live") dryRun = false;
    else if (a === "--dry-run") dryRun = true;
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return { dryRun };
}

/** Returns true if the value portion is already wrapped in matching
 * single or double quotes. */
function isAlreadyQuoted(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === '"' && last === '"') || (first === "'" && last === "'");
}

/** Escape any embedded double-quotes in the value so we can wrap in
 * double quotes safely. */
function escapeForDoubleQuote(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

interface LineResult {
  lineNumber: number;
  key: string;
  status: "quoted_already" | "will_quote" | "comment" | "blank" | "malformed";
}

function rewrite(contents: string): { rewritten: string; results: LineResult[] } {
  const lines = contents.split(/\r?\n/);
  const results: LineResult[] = [];
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    if (trimmed === "") {
      results.push({ lineNumber, key: "", status: "blank" });
      out.push(raw);
      continue;
    }
    if (trimmed.startsWith("#")) {
      results.push({ lineNumber, key: trimmed.slice(0, 30), status: "comment" });
      out.push(raw);
      continue;
    }

    // Match KEY=VALUE — KEY must be a valid env identifier
    const eq = raw.indexOf("=");
    if (eq < 1) {
      results.push({ lineNumber, key: trimmed.slice(0, 20), status: "malformed" });
      out.push(raw);
      continue;
    }
    const keyPart = raw.slice(0, eq).trim();
    const valuePart = raw.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyPart)) {
      results.push({ lineNumber, key: keyPart.slice(0, 20), status: "malformed" });
      out.push(raw);
      continue;
    }

    if (isAlreadyQuoted(valuePart)) {
      results.push({ lineNumber, key: keyPart, status: "quoted_already" });
      out.push(raw);
      continue;
    }

    results.push({ lineNumber, key: keyPart, status: "will_quote" });
    out.push(`${keyPart}="${escapeForDoubleQuote(valuePart)}"`);
  }

  return { rewritten: out.join("\n"), results };
}

async function main() {
  const args = parseArgs();
  let contents: string;
  try {
    contents = await fs.readFile(ENV_FILE, "utf8");
  } catch (err) {
    console.error(`Cannot read ${ENV_FILE}: ${(err as Error).message}`);
    process.exit(1);
  }

  const { rewritten, results } = rewrite(contents);

  const counts = {
    will_quote: results.filter((r) => r.status === "will_quote").length,
    quoted_already: results.filter((r) => r.status === "quoted_already").length,
    comment: results.filter((r) => r.status === "comment").length,
    blank: results.filter((r) => r.status === "blank").length,
    malformed: results.filter((r) => r.status === "malformed").length,
  };

  console.log("─── Quote .env.local ───");
  console.log(`mode               : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`file               : ${ENV_FILE}`);
  console.log(`lines total        : ${results.length}`);
  console.log(`  will quote       : ${counts.will_quote}`);
  console.log(`  already quoted   : ${counts.quoted_already}`);
  console.log(`  comments         : ${counts.comment}`);
  console.log(`  blank            : ${counts.blank}`);
  console.log(`  malformed        : ${counts.malformed}`);

  if (counts.will_quote > 0) {
    console.log("\nKeys to be quoted (names only, no values):");
    for (const r of results) {
      if (r.status === "will_quote") console.log(`  L${String(r.lineNumber).padStart(3)}  ${r.key}`);
    }
  }
  if (counts.malformed > 0) {
    console.log("\nMalformed lines (left untouched):");
    for (const r of results) {
      if (r.status === "malformed") console.log(`  L${String(r.lineNumber).padStart(3)}  ${r.key}`);
    }
  }

  if (args.dryRun) {
    console.log("\n(dry-run — pass --live to apply.)");
    return;
  }
  if (counts.will_quote === 0) {
    console.log("\nNothing to do — every value is already quoted or non-applicable.");
    return;
  }

  // Backup first.
  await fs.writeFile(BACKUP_FILE, contents, "utf8");
  console.log(`\nBackup written: ${BACKUP_FILE}`);
  await fs.writeFile(ENV_FILE, rewritten, "utf8");
  console.log(`Updated: ${ENV_FILE}`);
  console.log(`\n${counts.will_quote} value${counts.will_quote === 1 ? "" : "s"} now quoted. Restart anything that loaded the old env (npm run dev, etc.).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { rewrite, isAlreadyQuoted };
