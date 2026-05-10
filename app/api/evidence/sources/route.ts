import { listEvidenceSources } from "@/lib/truthfulness/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sources: listEvidenceSources(), dataStatus: "seed" });
}
