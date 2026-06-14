import { INDIRECT_EXPOSURE_WARNING, listIndirectExposureScores } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    exposures: listIndirectExposureScores(),
    warning: INDIRECT_EXPOSURE_WARNING,
    dataStatus: "seed",
  });
}
