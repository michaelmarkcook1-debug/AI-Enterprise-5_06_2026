// Vendor-id bridge.
// ─────────────────
// AI Enterprise carries three vendor-id namespaces:
//
//   1. EvidenceProposal.vendorId   →  vendor_writer, vendor_microsoft, …
//      (ingestion-pipeline form; what the seed ingestion writer used)
//
//   2. VendorProfile.id            →  writer, microsoft, anthropic, …
//      (plain-name form; the FK target for EvidenceRecord and
//      VendorProduct)
//
//   3. PRODUCT_SCOPES.vendorId     →  writer, msft, googl, amzn, …
//      (ticker form for big-cap public vendors; plain form for the rest)
//
// This module is the single source of truth for converting between
// them. proposal-service.ts (approval path) and the upcoming
// scripts/seed-vendor-products.ts (DB seeder) both consume it.

import type { PrismaClient } from "../../generated/prisma/client";

/** Ticker-style ids used in PRODUCT_SCOPES (and `INVESTMENT_PROVIDERS`)
 * → plain-name ids used in VendorProfile. Lookups via `TICKER_TO_PLAIN`
 * fall through to identity if the id is already in plain form. */
export const TICKER_TO_PLAIN: Record<string, string> = {
  msft: "microsoft",
  googl: "google",
  amzn: "aws",
  crm: "salesforce",
  now: "servicenow",
  orcl: "oracle",
  snow: "snowflake",
  avgo: "broadcom",
};

/** Pure helper — generate every candidate VendorProfile id we might
 * try for a given input (proposal vendor id or product-scope vendor id).
 * Returned in preference order. */
export function vendorIdCandidates(vendorId: string): string[] {
  const out = new Set<string>();
  out.add(vendorId);
  if (vendorId.startsWith("vendor_")) {
    const stripped = vendorId.slice("vendor_".length);
    out.add(stripped);
    if (TICKER_TO_PLAIN[stripped]) out.add(TICKER_TO_PLAIN[stripped]);
  }
  if (TICKER_TO_PLAIN[vendorId]) out.add(TICKER_TO_PLAIN[vendorId]);
  return [...out];
}

/** DB-backed resolver: try every candidate against VendorProfile and
 * return the first hit. Returns null if no profile matches — caller is
 * responsible for the error message. */
export async function resolveVendorProfileId(
  c: PrismaClient,
  vendorId: string,
): Promise<string | null> {
  const candidates = vendorIdCandidates(vendorId);
  const hit = await c.vendorProfile.findFirst({
    where: { id: { in: candidates } },
    select: { id: true },
  });
  return hit?.id ?? null;
}
