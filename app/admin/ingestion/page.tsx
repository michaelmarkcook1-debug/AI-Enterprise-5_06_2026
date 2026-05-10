import IngestionConsole from "./IngestionConsole";
import { listIngestionJobs } from "@/lib/ingestion/ingest-service";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import { hasDatabase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IngestionPage() {
  const [jobs, vendors] = await Promise.all([
    hasDatabase() ? listIngestionJobs() : Promise.resolve([]),
    listVendorProfiles(),
  ]);
  return (
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
  );
}
