import IngestionConsole from "./IngestionConsole";
import ManifestPatchesPanel from "@/components/admin/ManifestPatchesPanel";
import { listIngestionJobs } from "@/lib/ingestion/ingest-service";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import { hasDatabase, getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function listPendingManifestPatches() {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().manifestPatch.findMany({
      where: { status: "pending" },
      orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      category: r.category,
      deadUrl: r.deadUrl,
      httpStatus: r.httpStatus,
      candidateUrl: r.candidateUrl,
      candidateTitle: r.candidateTitle,
      confidenceScore: r.confidenceScore,
      rationale: r.rationale,
      citations: r.citations,
      searchesUsed: r.searchesUsed,
      retryAttempted: r.retryAttempted,
      retryOk: r.retryOk,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export default async function IngestionPage() {
  const [jobs, vendors, patches] = await Promise.all([
    hasDatabase() ? listIngestionJobs() : Promise.resolve([]),
    listVendorProfiles(),
    listPendingManifestPatches(),
  ]);
  return (
    <>
      <IngestionConsole
        hasDatabase={hasDatabase()}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
        initialJobs={jobs.map((j) => ({
          id: j.id,
          vendorId: j.vendorId,
          status: j.status,
          proposalsCount: j.proposalsCount,
          createdAt: j.createdAt.toISOString(),
          error: j.error ?? undefined,
        }))}
      />
      <ManifestPatchesPanel patches={patches} />
    </>
  );
}
