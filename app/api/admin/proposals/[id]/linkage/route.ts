// Persist operator-selected product linkage on an EvidenceProposal.
// PATCH /api/admin/proposals/<id>/linkage
//   body: { productScopeIds: string[], isVendorWide?: boolean }
//
// Validates that every selected scope id (a) exists in PRODUCT_SCOPES
// and (b) belongs to the proposal's vendor (after canonicalisation).
// This is the missing piece — previously the UI told operators to
// "select product manually" but had no surface to do it.

import { z } from "zod";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase, getPrisma } from "@/lib/prisma";
import { PRODUCT_SCOPES } from "@/lib/investor-tools/product-scope";
import { canonicaliseVendorId } from "@/lib/services/product-linkage-runner";

export const runtime = "nodejs";

const Body = z.object({
  productScopeIds: z.array(z.string()).max(50),
  isVendorWide: z.boolean().optional().default(false),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) {
    return Response.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const prisma = getPrisma();
  const proposal = await prisma.evidenceProposal.findUnique({
    where: { id },
    select: { id: true, vendorId: true, status: true },
  });
  if (!proposal) {
    return Response.json({ error: `unknown proposal ${id}` }, { status: 404 });
  }
  if (proposal.status !== "pending") {
    return Response.json(
      { error: `proposal already ${proposal.status}; linkage can only be set while pending` },
      { status: 409 },
    );
  }

  // Resolve to canonical vendor id, then validate every selected
  // scope (a) exists and (b) belongs to this vendor's catalogue.
  const canonVendor = canonicaliseVendorId(proposal.vendorId);
  const allowed = new Set(
    PRODUCT_SCOPES.filter((s) => s.vendorId === canonVendor).map((s) => s.id),
  );
  const invalid = parsed.data.productScopeIds.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    return Response.json(
      {
        error: "invalid_product_scope_ids",
        message: `These scope ids are not in the vendor's catalogue: ${invalid.join(", ")}`,
        allowed: [...allowed].slice(0, 20),
      },
      { status: 422 },
    );
  }

  try {
    await prisma.evidenceProposal.update({
      where: { id: proposal.id },
      data: {
        productScopeIds: parsed.data.productScopeIds,
        isVendorWide: parsed.data.isVendorWide,
      },
    });
    return Response.json({
      proposalId: proposal.id,
      productScopeIds: parsed.data.productScopeIds,
      isVendorWide: parsed.data.isVendorWide,
    });
  } catch (err) {
    console.error("[admin/proposals/:id/linkage] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
