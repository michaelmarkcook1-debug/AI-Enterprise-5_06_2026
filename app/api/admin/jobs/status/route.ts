// Side-effect-free poll target for in-flight admin jobs.
// GET /api/admin/jobs/status?kind=web_evidence → { job, active }
// GET /api/admin/jobs/status                    → { job, active, activeJobs }
//
// The console polls this to drive busy state + progress from the SERVER's view
// of a run, so the spinner reflects work that's still executing after a
// navigate-away (not just whether a client fetch is pending).

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { getLatestJob, isJobActive, listActiveJobs } from "@/lib/system/admin-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  const kind = new URL(request.url).searchParams.get("kind") ?? undefined;
  const [job, active, activeJobs] = await Promise.all([
    getLatestJob(kind),
    isJobActive(kind),
    listActiveJobs(),
  ]);
  return Response.json({ job, active, activeJobs });
}
