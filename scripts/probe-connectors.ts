// Live connector probe — runs a real fetch against every connector
// (not just health()) so "is this thing actually working?" is one
// command. Health alone only confirms env vars are present.
//
// Usage:
//   npx tsx scripts/probe-connectors.ts
//   npx tsx scripts/probe-connectors.ts --only=sec,fred
//
// Exit code is non-zero when any configured connector fails a live
// fetch, so this is safe to wire into CI or a pre-deploy gate.

import "./_load-env";
import { CONNECTORS } from "../lib/connectors/registry";

interface Args { only?: Set<string> }
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {};
  for (const a of argv) {
    if (a.startsWith("--only=")) args.only = new Set(a.slice("--only=".length).split(","));
    else { console.error(`unknown arg: ${a}`); process.exit(2); }
  }
  return args;
}

// One small known-good query per connector. Probes the LIVE API.
// Update here when a vendor moves an endpoint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEST_QUERIES: Record<string, any> = {
  sec:             { cik: "789019" }, // Microsoft
  fred:            { seriesId: "GDP" },
  bls:             { seriesIds: ["LNS14000000"] }, // U-3 unemployment
  bea:             { datasetName: "NIPA", tableName: "T10101", frequency: "Q", year: "2024" },
  eia:             { route: "electricity/retail-sales/data", params: { frequency: "monthly", "data[0]": "price", length: 1 } },
  fiscalData:      { endpoint: "v2/accounting/od/debt_to_penny", params: { "page[size]": "1" } },
  alphaVantage:    { fn: "GLOBAL_QUOTE", symbol: "AAPL" },
  // GDELT has an undocumented per-query soft rate limit — rapid
  // identical queries get 429'd for several minutes. Use a slightly
  // unusual query each probe to land in a fresh bucket.
  gdelt:           { query: `"enterprise AI platform" sourcecountry:US`, mode: "ArtList", maxRecords: 1 },
  github:          { path: "/repos/openai/openai-python" },
  congress:        { path: "/bill", params: { limit: "1" } },
  federalRegister: { path: "/documents", params: { per_page: "1", "conditions[term]": "artificial intelligence" } },
  vendorDocs:      { vendorId: "vendor_openai" },
  yahooFinance:    { resource: "quote", symbols: ["MSFT"] },
};

async function main() {
  const args = parseArgs();
  const ids = Object.keys(CONNECTORS).filter((id) => !args.only || args.only.has(id));
  let configuredFailures = 0;

  console.log("═══ Live connector probe ═══");
  console.log(`Running ${ids.length} connector${ids.length === 1 ? "" : "s"}.\n`);

  for (const id of ids) {
    const c = CONNECTORS[id];
    const h = c.health();
    if (h.status !== "ok") {
      console.log(`${id.padEnd(16)} ${h.status.padEnd(18)} cfg=${h.configured}  ${h.message ?? ""}`);
      continue;
    }
    const t0 = Date.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (c as any).fetch(TEST_QUERIES[id]);
      const ms = Date.now() - t0;
      const flag = r.ok ? "✓" : "✗";
      const err = r.error ? ` err=${String(r.error).slice(0, 80)}` : "";
      console.log(`${id.padEnd(16)} fetch ${flag}  ${String(ms).padStart(5)}ms  records=${String(r.recordCount).padStart(4)}${err}`);
      if (!r.ok) configuredFailures += 1;
    } catch (e) {
      const ms = Date.now() - t0;
      const msg = (e as Error).message.slice(0, 100);
      console.log(`${id.padEnd(16)} fetch ✗  ${String(ms).padStart(5)}ms  exception: ${msg}`);
      configuredFailures += 1;
    }
  }

  console.log("");
  if (configuredFailures > 0) {
    console.log(`✗ ${configuredFailures} configured connector${configuredFailures === 1 ? "" : "s"} failed the live probe.`);
    process.exit(1);
  } else {
    console.log("✓ Every configured connector answered.");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
