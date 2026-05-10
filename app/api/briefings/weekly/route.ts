import { generateWeeklyBriefing } from "@/lib/intelligence/briefings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await generateWeeklyBriefing());
}
