// Seed the 8 VendorProfile rows that exist in PRODUCT_SCOPES /
// INVESTMENT_PROVIDERS but were missing from the core vendor_profiles
// table:
//
//   Platform-only (no investor-tools surface):
//     perplexity, xai
//
//   Infrastructure / semiconductor enablers (already short-circuited
//   as infrastructure_only in capabilityRenderState()):
//     nvidia (nvda), amd, broadcom (avgo), asml, arm, cerebras
//
// Categories and summaries are source-true — each summary describes
// what the vendor is, not what we want them to be. Ownership is set
// per current state (public for listed equities, private for the rest).
//
// Idempotent — upserts on the id.
// --dry-run by default, --live to apply.

import { hasDatabase, getPrisma } from "../lib/prisma";

interface Seed {
  id: string;
  name: string;
  category: string;
  website: string;
  hq: string;
  ownership: "public" | "private" | "subsidiary";
  summary: string;
  ecosystemFit: string[];
  useCaseFit: string[];
}

const VENDORS: Seed[] = [
  {
    id: "perplexity",
    name: "Perplexity",
    category: "enterprise_search",
    website: "https://www.perplexity.ai",
    hq: "San Francisco, US",
    ownership: "private",
    summary:
      "AI answer engine + enterprise search platform. Tracked for Commercial Models inventory and Vendor Intelligence; explicitly excluded from Investor Tools per Stage-2 Rev2 prompt 09.",
    ecosystemFit: ["multi-cloud", "web"],
    useCaseFit: ["enterprise_search", "research_assistant", "real_time_web_grounding"],
  },
  {
    id: "xai",
    name: "xAI",
    category: "model_api",
    website: "https://x.ai",
    hq: "San Francisco, US",
    ownership: "private",
    summary:
      "Frontier model lab; develops the Grok family. Tracked for Vendor Intelligence and News Intelligence; investor-side exposure documented in INVESTMENT_PROVIDERS.",
    ecosystemFit: ["multi-cloud", "x_platform"],
    useCaseFit: ["model_api", "conversational_assistant"],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    category: "ai_compute",
    website: "https://www.cerebras.net",
    hq: "Sunnyvale, US",
    ownership: "private",
    summary:
      "Wafer-scale AI compute. IPO-watch candidate. Tracked as infrastructure_only — short-circuited in capabilityRenderState() since they ship hardware, not enterprise AI software.",
    ecosystemFit: ["on_prem", "private_cloud"],
    useCaseFit: ["ai_compute", "ai_infrastructure"],
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    category: "ai_compute",
    website: "https://www.nvidia.com",
    hq: "Santa Clara, US",
    ownership: "public",
    summary:
      "AI compute / networking / software stack (CUDA, NIM, NeMo, AI Enterprise). Tracked as infrastructure_only for the Capabilities surface; full investor-tools exposure modelled in INVESTMENT_PROVIDERS.",
    ecosystemFit: ["multi-cloud", "on_prem"],
    useCaseFit: ["ai_compute", "ai_infrastructure", "model_api"],
  },
  {
    id: "amd",
    name: "AMD",
    category: "ai_compute",
    website: "https://www.amd.com",
    hq: "Santa Clara, US",
    ownership: "public",
    summary:
      "Instinct accelerators + ROCm software. EPYC and Ryzen AI exposure. Tracked as infrastructure_only — semiconductor enabler, not enterprise AI platform peer.",
    ecosystemFit: ["multi-cloud", "on_prem"],
    useCaseFit: ["ai_compute", "developer_ai"],
  },
  {
    id: "broadcom",
    name: "Broadcom",
    category: "ai_networking",
    website: "https://www.broadcom.com",
    hq: "San Jose, US",
    ownership: "public",
    summary:
      "AI networking (Tomahawk, Jericho), co-packaged optics, custom-silicon exposure. Tracked as infrastructure_only.",
    ecosystemFit: ["multi-cloud"],
    useCaseFit: ["ai_networking", "ai_compute"],
  },
  {
    id: "asml",
    name: "ASML",
    category: "semiconductor_equipment",
    website: "https://www.asml.com",
    hq: "Veldhoven, Netherlands",
    ownership: "public",
    summary:
      "EUV / High-NA EUV / DUV lithography systems. Semiconductor-manufacturing exposure for AI chips. Tracked as infrastructure_only — semiconductor equipment, not AI software.",
    ecosystemFit: ["semiconductor_equipment"],
    useCaseFit: ["semiconductor_equipment"],
  },
  {
    id: "arm",
    name: "Arm",
    category: "ai_compute",
    website: "https://www.arm.com",
    hq: "Cambridge, UK",
    ownership: "public",
    summary:
      "Arm compute / IP exposure for AI workloads across edge, mobile, server. Tracked as infrastructure_only.",
    ecosystemFit: ["edge", "mobile", "server"],
    useCaseFit: ["ai_compute"],
  },
];

interface Args { dryRun: boolean }
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let dryRun = true;
  for (const a of argv) {
    if (a === "--live") dryRun = false;
    else if (a === "--dry-run") dryRun = true;
    else { console.error(`unknown arg: ${a}`); process.exit(2); }
  }
  return { dryRun };
}

async function main() {
  const args = parseArgs();
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to seed.");
    process.exit(1);
  }
  const prisma = getPrisma();

  console.log("─── Seed additional VendorProfile rows ───");
  console.log(`mode  : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`count : ${VENDORS.length}`);
  console.log("");
  for (const v of VENDORS) {
    const existing = await prisma.vendorProfile.findUnique({ where: { id: v.id }, select: { id: true } });
    console.log(`  ${existing ? "↻" : "+"} ${v.id.padEnd(11)} ${v.name.padEnd(12)} ${v.ownership.padEnd(9)} ${v.category}`);
  }

  if (args.dryRun) {
    console.log("\n(dry-run — pass --live to apply.)");
    await prisma.$disconnect();
    return;
  }

  let inserted = 0;
  let updated = 0;
  for (const v of VENDORS) {
    const existing = await prisma.vendorProfile.findUnique({ where: { id: v.id }, select: { id: true } });
    await prisma.vendorProfile.upsert({
      where: { id: v.id },
      update: {
        name: v.name, category: v.category, website: v.website, hq: v.hq,
        ownership: v.ownership, summary: v.summary,
        ecosystemFit: v.ecosystemFit, useCaseFit: v.useCaseFit, active: true,
      },
      create: {
        id: v.id, name: v.name, category: v.category, website: v.website, hq: v.hq,
        ownership: v.ownership, summary: v.summary,
        ecosystemFit: v.ecosystemFit, useCaseFit: v.useCaseFit, active: true,
      },
    });
    if (existing) updated += 1;
    else inserted += 1;
  }
  console.log(`\nInserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);

  const total = await prisma.vendorProfile.count();
  console.log(`vendor_profiles total now: ${total}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
