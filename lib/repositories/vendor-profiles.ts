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

export async function listVendorProfiles(client?: VendorReadClient): Promise<Vendor[]> {
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors();
  const c = client ?? getPrisma();
  const rows = await c.vendorProfile.findMany({
    where: { active: true },
    include: vendorProfileInclude,
    orderBy: { name: "asc" },
  });

  return rows.map(toVendor);
}

export async function getVendorProfile(id: string, client?: VendorReadClient): Promise<Vendor | null> {
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors().find((v) => v.id === id) ?? null;
  const c = client ?? getPrisma();
  const row = await c.vendorProfile.findUnique({
    where: { id },
    include: vendorProfileInclude,
  });

  return row ? toVendor(row) : null;
}

export async function listVendorEvidence(vendorId: string, client?: VendorReadClient): Promise<EvidenceItem[]> {
  if (!client && !hasDatabase()) return getIntelligenceAssessmentVendors().find((vendor) => vendor.id === vendorId)?.evidence ?? [];
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
}
