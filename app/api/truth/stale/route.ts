import { listTruthRecords } from "@/lib/truthfulness/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    stale: listTruthRecords().filter((record) => record.freshnessStatus === "stale"),
    dataStatus: "documented",
  });
}
