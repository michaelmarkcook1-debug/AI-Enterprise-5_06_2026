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
  nvda: "nvidia",
  // amd, asml, arm — already in plain form in PRODUCT_SCOPES, resolved
  // by the prefix-strip fallback in vendorIdCandidates().
};

/** Pipeline/entity slug remaps: a few vendors carry an entities.ts id that
 * differs from the live spine id (entities.ts:247). The ingestion writer used
 * the entity id (`vendor_zhipu-glm`), but the spine + VendorProfile use the
 * slug (`zai`). Keep this in sync with the slug logic in entities.ts. */
export const ENTITY_SLUG_REMAP: Record<string, string> = {
  "zhipu-glm": "zai",
  "alibaba-qwen": "alibaba",
  "moonshot-kimi": "moonshot",
};

/** Pure helper — generate every candidate VendorProfile id we might
 * try for a given input (proposal vendor id or product-scope vendor id).
 * Returned in preference order. */
export function vendorIdCandidates(vendorId: string): string[] {
  const out = new Set<string>();
  out.add(vendorId);
  const stripped = vendorId.startsWith("vendor_") ? vendorId.slice("vendor_".length) : vendorId;
  if (stripped !== vendorId) out.add(stripped);
  if (TICKER_TO_PLAIN[stripped]) out.add(TICKER_TO_PLAIN[stripped]);
  if (TICKER_TO_PLAIN[vendorId]) out.add(TICKER_TO_PLAIN[vendorId]);
  if (ENTITY_SLUG_REMAP[stripped]) out.add(ENTITY_SLUG_REMAP[stripped]);
  if (ENTITY_SLUG_REMAP[vendorId]) out.add(ENTITY_SLUG_REMAP[vendorId]);
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

/**
 * Resolve a proposal/pipeline vendor id to a VendorProfile id, CREATING the
 * VendorProfile from the live IntelligenceVendor spine when it doesn't exist
 * yet. This makes approval self-healing: vendors that have a spine row (and so
 * a real identity) but no VendorProfile no longer block promotion to
 * EvidenceRecord. The created profile carries only real identity (id + name)
 * from the spine — no fabricated scores. Returns null only when no spine vendor
 * matches any candidate at all (a genuinely unknown vendor).
 */
export async function resolveOrCreateVendorProfileId(
  c: PrismaClient,
  vendorId: string,
): Promise<string | null> {
  // 1) Existing VendorProfile wins.
  const existing = await resolveVendorProfileId(c, vendorId);
  if (existing) return existing;

  // 2) Fall back to the spine: match candidates against IntelligenceVendor by
  //    id OR slug, then materialise a minimal VendorProfile keyed on the spine
  //    id so EvidenceRecord's FK resolves and the projector maps it back cleanly.
  const candidates = vendorIdCandidates(vendorId);
  const spine = await c.intelligenceVendor.findFirst({
    where: { OR: [{ id: { in: candidates } }, { slug: { in: candidates } }] },
    select: { id: true, name: true, ownershipType: true, roleTags: true, analystInterpretation: true },
  });
  if (!spine) return null;

  // Materialise a minimal VendorProfile from REAL spine identity only —
  // primary role as category, the spine's ownership, the analyst summary text.
  // No scores are invented here; scoring still comes from evidence/pillars.
  const ownership: "public" | "private" | "subsidiary" =
    spine.ownershipType === "public" || spine.ownershipType === "subsidiary" ? spine.ownershipType : "private";
  await c.vendorProfile.upsert({
    where: { id: spine.id },
    create: {
      id: spine.id,
      name: spine.name,
      category: spine.roleTags?.[0] ?? "AI Vendor",
      ownership,
      summary: spine.analystInterpretation ?? "",
    },
    update: {},
  });
  return spine.id;
}
