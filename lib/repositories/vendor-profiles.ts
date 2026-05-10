import { getPrisma, hasDatabase } from "../prisma";
import { toVendor } from "./vendor-mapper";
import { getIntelligenceAssessmentVendors } from "../intelligence/assessment-adapter";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { EvidenceItem, Vendor } from "../types";

const vendorProfileInclude = {
  evidence: {
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
 * Fall back to seed intelligence whenever the DB layer fails for ANY reason —
 * common cases: DATABASE_URL is set but migrations haven't been applied, the
 * connection pool exhausted, or the Postgres instance is sleeping (Neon free
 * tier). Without this guard a fresh Vercel deploy with a brand-new database
 * would 500 on every page that touches vendor-profiles. We log the failure
 * (via console.warn — surfaces in `vercel logs`) so operators can see when the
 * fallback kicked in, but the page still renders against seed data.
 */
function dbFallback<T>(label: string, error: unknown, fallback: T): T {
  console.warn(`[vendor-profiles] DB ${label} failed; using seed intelligence fallback. Reason:`, (error as Error)?.message ?? error);
  return fallback;
}

export async function listVendorProfiles(client?: VendorReadClient): Promise<Vendor[]> {
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors();
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
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors().find((v) => v.id === id) ?? null;
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
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors().find((vendor) => vendor.id === vendorId)?.evidence ?? [];
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
