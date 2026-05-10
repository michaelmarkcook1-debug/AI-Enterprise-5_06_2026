import { listTruthRecords } from "@/lib/truthfulness/registry";

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({
    refreshRequired: listTruthRecords().filter((record) => record.validationRequired || record.freshnessStatus === "stale"),
    message: "Records with seed, stale, low-confidence, or unsupported status require source refresh before production use.",
  });
}
