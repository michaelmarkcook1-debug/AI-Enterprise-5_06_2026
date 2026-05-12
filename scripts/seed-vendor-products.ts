// Seed VendorProduct rows from PRODUCT_SCOPES.
// ─────────────────────────────────────────────
// The DB has 0 vendor_products rows, but PRODUCT_SCOPES carries
// hundreds of source-backed product entries across the 20 tracked
// vendors. This script bridges the namespace mismatch (vendor_microsoft
// / msft / microsoft) and upserts every product into the VendorProduct
// table.
//
// Idempotent — re-running is a no-op (Prisma upsert on the
// [vendorId, productName] unique key).
//
// Dry-run by default. --live to apply. --vendor=<id> to scope.

import { hasDatabase, getPrisma } from "../lib/prisma";
import { PRODUCT_SCOPES } from "../lib/investor-tools/product-scope";
import { resolveVendorProfileId } from "../lib/services/vendor-id-bridge";

interface Args {
  dryRun: boolean;
  vendor?: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: true };
  for (const a of argv) {
    if (a === "--live") args.dryRun = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--vendor=")) args.vendor = a.slice("--vendor=".length);
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to seed.");
    process.exit(1);
  }
  const prisma = getPrisma();

  // Group PRODUCT_SCOPES by source vendorId, optionally narrowed.
  const scopes = args.vendor
    ? PRODUCT_SCOPES.filter((s) => s.vendorId === args.vendor)
    : PRODUCT_SCOPES;

  // Resolve each source vendorId once.
  const seenVendors = new Map<string, string | null>();
  for (const s of scopes) {
    if (!seenVendors.has(s.vendorId)) {
      seenVendors.set(s.vendorId, await resolveVendorProfileId(prisma, s.vendorId));
    }
  }

  // Pre-flight summary.
  type Plan = { vendorId: string; profileId: string; productName: string; category: string };
  const plan: Plan[] = [];
  const skipped: { scope: typeof PRODUCT_SCOPES[number]; reason: string }[] = [];
  for (const s of scopes) {
    const profileId = seenVendors.get(s.vendorId);
    if (!profileId) {
      skipped.push({ scope: s, reason: `no VendorProfile matches "${s.vendorId}"` });
      continue;
    }
    plan.push({
      vendorId: profileId,
      profileId,
      productName: s.productName,
      category: String(s.productCategory),
    });
  }

  const byVendor = new Map<string, number>();
  for (const p of plan) byVendor.set(p.profileId, (byVendor.get(p.profileId) ?? 0) + 1);

  console.log("─── Seed VendorProduct from PRODUCT_SCOPES ───");
  console.log(`mode                 : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  if (args.vendor) console.log(`vendor scope         : ${args.vendor}`);
  console.log(`scope source rows    : ${scopes.length}`);
  console.log(`planned upserts      : ${plan.length}`);
  console.log(`skipped (no profile) : ${skipped.length}`);

  if (byVendor.size > 0) {
    console.log("\nBy resolved VendorProfile:");
    for (const [v, n] of [...byVendor.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}  ${v}`);
    }
  }

  if (skipped.length > 0) {
    console.log("\nSkipped vendors (no matching VendorProfile):");
    const skippedVendors = new Set<string>();
    for (const sk of skipped) skippedVendors.add(sk.scope.vendorId);
    for (const v of skippedVendors) console.log(`  · ${v}`);
  }

  if (args.dryRun) {
    console.log("\n(dry-run — pass --live to apply.)");
    await prisma.$disconnect();
    return;
  }

  // Apply: upsert on [vendorId, productName] unique key.
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  for (const p of plan) {
    try {
      const existing = await prisma.vendorProduct.findUnique({
        where: { vendorId_productName: { vendorId: p.vendorId, productName: p.productName } },
        select: { id: true },
      });
      await prisma.vendorProduct.upsert({
        where: { vendorId_productName: { vendorId: p.vendorId, productName: p.productName } },
        update: { category: p.category },
        create: { vendorId: p.vendorId, productName: p.productName, category: p.category },
      });
      if (existing) updated += 1;
      else inserted += 1;
    } catch (err) {
      failed += 1;
      console.error(`  fail ${p.vendorId}/${p.productName}: ${(err as Error).message}`);
    }
  }
  console.log(`\nInserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Failed   : ${failed}`);

  // Final DB count for sanity.
  const total = await prisma.vendorProduct.count();
  console.log(`\nvendor_products total now: ${total}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
