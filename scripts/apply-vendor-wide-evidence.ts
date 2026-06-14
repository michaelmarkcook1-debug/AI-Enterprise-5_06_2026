// Bulk-link vendor-wide evidence proposals to every product in the
// vendor's scope.
// ───────────────────────────────────────────────────────────────────
// Trust-centre / pricing / status / security pages contain claims that
// apply to every product the vendor sells (e.g. "we have SOC 2 Type II"
// is true for all of Microsoft's AI products, not just Copilot). Asking
// the operator to pick one product per row is wrong — the right answer
// is "this evidence applies to all of them".
//
// Detection: source URL pathname matches one of the documented
// vendor-wide patterns AND the proposal's linkage status is `no_match`
// (i.e. no specific product name in the excerpt). When both hold, the
// row is bulk-linked to every productScopeId in the vendor's catalogue
// and `isVendorWide=true` is set.
//
// Usage:
//   npx tsx scripts/apply-vendor-wide-evidence.ts             → dry-run
//   npx tsx scripts/apply-vendor-wide-evidence.ts --live      → apply
//   npx tsx scripts/apply-vendor-wide-evidence.ts --vendor=vendor_writer
//
// After the live run, re-running triage will move these rows out of
// `recommend_approve (product linkage missing)` and into the appropriate
// lane based on confidence + grade.

import { hasDatabase, getPrisma } from "../lib/prisma";
import { canonicaliseVendorId } from "../lib/services/product-linkage-runner";
import { suggestLinkage } from "../lib/services/product-linkage";
import { PRODUCT_SCOPES } from "../lib/investor-tools/product-scope";
import { isVendorWideUrl } from "../lib/services/vendor-wide-detector";

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

function scopesByVendor(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const s of PRODUCT_SCOPES) {
    const arr = map.get(s.vendorId) ?? [];
    arr.push(s.id);
    map.set(s.vendorId, arr);
  }
  return map;
}

async function main() {
  const args = parseArgs();
  if (!hasDatabase()) {
    console.error("DATABASE_URL is not set; nothing to update.");
    process.exit(1);
  }
  const prisma = getPrisma();
  const scopeIndex = scopesByVendor();

  // Pull every pending proposal that is NOT already linked.
  const proposals = await prisma.evidenceProposal.findMany({
    where: {
      status: "pending",
      vendorId: args.vendor,
      productScopeIds: { equals: [] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to vendor-wide candidates: URL matches a vendor-wide pattern
  // AND the linkage suggester returns no_match (i.e. no specific product
  // name in the excerpt — otherwise the operator should pick that one).
  const candidates: { id: string; vendorId: string; canon: string; sourceUrl: string | null; signal?: string }[] = [];
  const skippedHasNamedProduct: string[] = [];

  for (const p of proposals) {
    const urlCheck = isVendorWideUrl(p.sourceUrl);
    if (!urlCheck.match) continue;
    const canon = canonicaliseVendorId(p.vendorId);
    const vendorScopes = (PRODUCT_SCOPES.filter((s) => s.vendorId === canon)).map((s) => ({
      id: s.id,
      vendorId: s.vendorId,
      productName: s.productName,
      productCategory: String(s.productCategory),
    }));
    if (vendorScopes.length === 0) continue; // vendor not in registry — separate gap
    // Only sweep rows where the linkage suggester returned no_match.
    // If there's a specific product named in the excerpt, the operator
    // should pick it manually — vendor-wide is the wrong answer there.
    const linkage = suggestLinkage(
      {
        id: p.id,
        vendorId: p.vendorId,
        domain: p.domain,
        subfactor: p.subfactor,
        excerpt: p.excerpt,
        sourceUrl: p.sourceUrl,
      },
      vendorScopes,
    );
    if (linkage.status !== "no_match" && linkage.status !== "no_vendor_products") {
      skippedHasNamedProduct.push(p.id);
      continue;
    }
    candidates.push({
      id: p.id,
      vendorId: p.vendorId,
      canon,
      sourceUrl: p.sourceUrl,
      signal: urlCheck.signal,
    });
  }

  // Group by vendor for the report.
  const byVendor = new Map<string, number>();
  for (const c of candidates) byVendor.set(c.canon, (byVendor.get(c.canon) ?? 0) + 1);

  console.log("─── Vendor-wide evidence sweep ───");
  console.log(`mode                    : ${args.dryRun ? "DRY-RUN" : "LIVE"}`);
  if (args.vendor) console.log(`vendor scope            : ${args.vendor}`);
  console.log(`pending unlinked rows   : ${proposals.length}`);
  console.log(`vendor-wide candidates  : ${candidates.length}`);
  console.log(`skipped (named product) : ${skippedHasNamedProduct.length}`);

  if (candidates.length === 0) {
    console.log("\nNothing to apply.");
    return;
  }

  console.log("\nBy canonical vendor:");
  for (const [v, n] of [...byVendor.entries()].sort((a, b) => b[1] - a[1])) {
    const productCount = scopeIndex.get(v)?.length ?? 0;
    console.log(`  ${String(n).padStart(3)}  ${v}  →  ${productCount} products`);
  }

  if (args.dryRun) {
    console.log("\n(dry-run — pass --live to apply.)");
    return;
  }

  // Apply: for each candidate, write productScopeIds = all of vendor's scopes
  // and set isVendorWide = true.
  let updated = 0;
  for (const c of candidates) {
    const vendorScopeIds = scopeIndex.get(c.canon) ?? [];
    if (vendorScopeIds.length === 0) continue;
    try {
      await prisma.evidenceProposal.update({
        where: { id: c.id },
        data: {
          productScopeIds: vendorScopeIds,
          isVendorWide: true,
        },
      });
      updated += 1;
    } catch (err) {
      console.error(`  fail ${c.id}: ${(err as Error).message}`);
    }
  }
  console.log(`\nApplied vendor-wide linkage to ${updated} proposals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
