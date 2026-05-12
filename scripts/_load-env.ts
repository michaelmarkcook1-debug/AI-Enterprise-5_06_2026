// Lenient env loader for scripts.
// ───────────────────────────────
// Use this instead of `npx tsx --env-file=.env.local` because:
//   - Node's built-in `--env-file` parser is stricter than bash source
//     and silently drops values on certain line shapes.
//   - dotenv v17's `config()` ships secret-protection heuristics that
//     can refuse to inject keys it recognises as live credentials
//     (ANTHROPIC_API_KEY observed silently dropped despite parse()
//     reading the value correctly).
//
// Our approach: use `dotenv.parse()` directly (pure deterministic
// parser, no auto-inject heuristics) + manually populate process.env.
// Existing values win unless `override: true` (kept off for safety).
//
// Usage:
//   import "./scripts/_load-env";      // top of every script

import { parse } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envFile = path.resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  try {
    const raw = readFileSync(envFile);
    const parsed = parse(raw);
    let injected = 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined || process.env[key] === "") {
        process.env[key] = value;
        injected += 1;
      }
    }
    if (process.env.LOAD_ENV_VERBOSE === "1") {
      console.error(`[_load-env] injected ${injected} of ${Object.keys(parsed).length} keys from ${envFile}`);
    }
  } catch (err) {
    console.error(`[_load-env] failed to load ${envFile}:`, (err as Error).message);
  }
}
