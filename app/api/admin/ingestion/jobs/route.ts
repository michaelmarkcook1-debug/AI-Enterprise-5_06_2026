import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { listIngestionJobs } from "@/lib/ingestion/ingest-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const jobs = await listIngestionJobs();
  return Response.json({ jobs });
}
