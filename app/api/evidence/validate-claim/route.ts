import { validateClaimSupport } from "@/lib/truthfulness/registry";
import type { Claim } from "@/lib/truthfulness/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const claim = await request.json().catch(() => null) as Claim | null;
  if (!claim) return Response.json({ error: "invalid_claim" }, { status: 400 });

  const validation = validateClaimSupport(claim);
  return Response.json({ validation }, { status: validation.isValid ? 200 : 422 });
}
