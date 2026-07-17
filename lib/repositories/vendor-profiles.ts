import { getPrisma, hasDatabase } from "../prisma";
import { toVendor } from "./vendor-mapper";
import { getIntelligenceAssessmentVendors } from "../intelligence/assessment-adapter";
import { DataUnavailableError, seedFallbackAllowed } from "../availability";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { EvidenceItem, Vendor } from "../types";

const vendorProfileInclude = {
  evidence: {
    // Only reviewed, source-backed rows may score a vendor — the same bar the
    // composite path enforces (lib/assessment/domain-scores.ts). Without this
    // filter /assess scored on EVERY row regardless of review status, including
    // `curated` (the schema default, and what seed fixtures write). That let
    // unreviewed placeholder rows move a real vendor's score: fabrication by
    // omission. The two scoring paths must answer to one evidence bar, or the
    // stricter one is theatre.
    where: { reviewStatus: "analyst_verified" as const },
    orderBy: [{ domain: "asc" }, { subfactor: "asc" }],
  },
  risks: {
    orderBy: [{ severity: "asc" }, { domain: "asc" }],
  },
  industryAdoption: {
    orderBy: [{ industry: "asc" }],
  },
} satisfies Prisma.VendorProfileInclude;

type VendorReadClient = Pick<PrismaClient, "vendorProfile" | "evidenceRecord">;

/**
 * Seed intelligence is served ONLY in local dev / tests (`seedFallbackAllowed()`).
 * In any deployed build a DB failure throws `DataUnavailableError` so the surface
 * renders an honest "live data unavailable" state — we never dress seed as real.
 */
function dbFallback<T>(label: string, error: unknown, fallback: T): T {
  const reason = (error as Error)?.message ?? error;
  if (!seedFallbackAllowed()) {
    console.error(`[vendor-profiles] DB ${label} failed (no seed fallback in deployed builds):`, reason);
    throw new DataUnavailableError(`vendor profiles temporarily unavailable: ${String(reason)}`);
  }
  console.warn(`[vendor-profiles] DB ${label} failed; using LOCAL-DEV seed intelligence fallback. Reason:`, reason);
  return fallback;
}

/** No DB configured: seed in local dev/tests, else honest-unavailable. */
function noDbFallback<T>(seed: () => T): T {
  if (!seedFallbackAllowed()) {
    throw new DataUnavailableError("vendor profiles database is not configured (DATABASE_URL unset)");
  }
  return seed();
}

export async function listVendorProfiles(client?: VendorReadClient): Promise<Vendor[]> {
  if (!client && !hasDatabase()) return noDbFallback(() => getIntelligenceAssessmentVendors());
  try {
    const c = client ?? getPrisma();
    const rows = await c.vendorProfile.findMany({
      where: { active: true },
      include: vendorProfileInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(toVendor);
  } catch (error) {
    return dbFallback("listVendorProfiles", error, getIntelligenceAssessmentVendors());
  }
}

export async function getVendorProfile(id: string, client?: VendorReadClient): Promise<Vendor | null> {
  if (!client && !hasDatabase()) return noDbFallback(() => getIntelligenceAssessmentVendors().find((v) => v.id === id) ?? null);
  try {
    const c = client ?? getPrisma();
    const row = await c.vendorProfile.findUnique({
      where: { id },
      include: vendorProfileInclude,
    });
    return row ? toVendor(row) : null;
  } catch (error) {
    return dbFallback("getVendorProfile", error, getIntelligenceAssessmentVendors().find((v) => v.id === id) ?? null);
  }
}

export async function listVendorEvidence(vendorId: string, client?: VendorReadClient): Promise<EvidenceItem[]> {
  if (!client && !hasDatabase()) return noDbFallback(() => getIntelligenceAssessmentVendors().find((vendor) => vendor.id === vendorId)?.evidence ?? []);
  try {
    const c = client ?? getPrisma();
    const rows = await c.evidenceRecord.findMany({
      where: { vendorId },
      orderBy: [{ domain: "asc" }, { subfactor: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      vendorId: row.vendorId,
      domain: row.domain,
      subfactor: row.subfactor,
      excerpt: row.excerpt,
      sourceUrl: row.sourceUrl ?? undefined,
      capturedAt: row.capturedAt.toISOString(),
      grade: row.evidenceGrade,
      rawScore: row.rawScore,
      freshnessDays: row.freshnessDays ?? undefined,
    }));
  } catch (error) {
    return dbFallback(
      "listVendorEvidence",
      error,
      getIntelligenceAssessmentVendors().find((vendor) => vendor.id === vendorId)?.evidence ?? [],
    );
  }
}
