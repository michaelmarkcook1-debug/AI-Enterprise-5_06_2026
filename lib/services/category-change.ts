// Phase 2 — vendor category / role-tag change detection + admin approval.
// ──────────────────────────────────────────────────────────────────────
// The engine detects when ingested evidence shows a vendor gaining a capability
// tied to a role it does NOT yet hold (e.g. a model lab shipping a vertical
// application → it now plays "Application Vendor"). It raises an admin-reviewed
// proposal; the change is NEVER auto-applied. On approval the vendor's roleTags
// (and optionally category label) update — which moves it in the rankings,
// quadrant and "who wins each layer" — and the rankings recompute on the next
// recompute/cron pass.

import { getPrisma, hasDatabase } from "../prisma";
import { VENDOR_CAPABILITIES } from "../intelligence/seed-capabilities";

// Role-defining capability families → the structured role they imply. Only the
// clearly role-defining families are mapped; cross-cutting families (rag,
// governance, security, integrations, cost_controls, deployment, portability)
// are intentionally omitted so the admin queue isn't flooded with noise.
const FAMILY_TO_ROLE: Record<string, string> = {
  models: "Model Provider",
  enterprise_assistant: "Application Vendor",
  agents: "Application Vendor",
};

// A capability must reach this maturity (from evidence) before it's strong
// enough to imply the vendor genuinely plays a new role.
const ROLE_IMPLICATION_MATURITY = 70;

export interface CategoryChangeProposal {
  id: string;
  vendorId: string;
  vendorName: string;
  currentCategory: string;
  proposedCategory: string | null;
  currentRoleTags: string[];
  proposedRoleTags: string[];
  rationale: string;
  triggerCapabilityId: string | null;
  triggerMaturity: number | null;
  sourceUrls: string[];
  status: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  appliedAt: string | null;
  createdAt: string;
}

// The generated Prisma client gains the VendorCategoryChangeProposal delegate at
// build time (`prisma generate`); this minimal shape keeps local typecheck green
// without weakening the call sites below.
interface CcpDelegate {
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
}
function ccp(tx?: unknown): CcpDelegate {
  const client = (tx ?? getPrisma()) as unknown as { vendorCategoryChangeProposal: CcpDelegate };
  return client.vendorCategoryChangeProposal;
}

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : typeof v === "string" ? v : null;

function mapRow(r: Record<string, unknown>): CategoryChangeProposal {
  return {
    id: String(r.id),
    vendorId: String(r.vendorId),
    vendorName: String(r.vendorName ?? ""),
    currentCategory: String(r.currentCategory ?? ""),
    proposedCategory: (r.proposedCategory as string | null) ?? null,
    currentRoleTags: (r.currentRoleTags as string[] | undefined) ?? [],
    proposedRoleTags: (r.proposedRoleTags as string[] | undefined) ?? [],
    rationale: String(r.rationale ?? ""),
    triggerCapabilityId: (r.triggerCapabilityId as string | null) ?? null,
    triggerMaturity: (r.triggerMaturity as number | null) ?? null,
    sourceUrls: (r.sourceUrls as string[] | undefined) ?? [],
    status: String(r.status ?? "pending"),
    reviewerId: (r.reviewerId as string | null) ?? null,
    reviewedAt: iso(r.reviewedAt),
    reviewNotes: (r.reviewNotes as string | null) ?? null,
    appliedAt: iso(r.appliedAt),
    createdAt: iso(r.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface DetectResult {
  skipped: boolean;
  reason?: string;
  scanned: number;
  created: number;
  createdFor: { vendorId: string; role: string }[];
}

/**
 * Scan evidence-derived capabilities for role gaps and raise pending proposals.
 * Detects only NEW capabilities (present from evidence, absent from the curated
 * seed baseline) so it tracks ingestion changes rather than re-litigating the
 * baseline. Dedups against existing pending proposals. Idempotent.
 */
export async function detectCategoryChanges(): Promise<DetectResult> {
  if (!hasDatabase()) return { skipped: true, reason: "no_database", scanned: 0, created: 0, createdFor: [] };
  const prisma = getPrisma();

  const caps = await prisma.vendorCapability
    .findMany({
      where: { maturityScore: { gte: ROLE_IMPLICATION_MATURITY } },
      select: { vendorId: true, capabilityId: true, maturityScore: true },
    })
    .catch(() => [] as Array<{ vendorId: string; capabilityId: string; maturityScore: number }>);
  if (caps.length === 0) return { skipped: false, scanned: 0, created: 0, createdFor: [] };

  // Curated baseline — capabilities already known to analysts are NOT a change.
  const seedKeys = new Set(VENDOR_CAPABILITIES.map((s) => `${s.vendorId}_${s.capabilityId}`));

  const vendors = await prisma.intelligenceVendor.findMany({
    select: { id: true, name: true, category: true, roleTags: true },
  });
  const venById = new Map(vendors.map((v) => [v.id, v]));
  const resolveVen = (id: string) =>
    venById.get(id) ?? venById.get(`vendor_${id}`) ?? venById.get(id.replace(/^vendor_/, ""));

  // Dedup against existing pending proposals (vendor + proposed role).
  const pending = (await ccp().findMany({
    where: { status: "pending" },
    select: { vendorId: true, proposedRoleTags: true },
  })) as Array<{ vendorId: string; proposedRoleTags: string[] }>;
  const seen = new Set<string>();
  for (const p of pending) for (const role of p.proposedRoleTags ?? []) seen.add(`${p.vendorId}::${role}`);

  let created = 0;
  const createdFor: { vendorId: string; role: string }[] = [];
  for (const cap of caps) {
    const role = FAMILY_TO_ROLE[cap.capabilityId];
    if (!role) continue; // not a role-defining family
    if (seedKeys.has(`${cap.vendorId}_${cap.capabilityId}`)) continue; // baseline, not a change
    const ven = resolveVen(cap.vendorId);
    if (!ven) continue;
    const roleTags = ven.roleTags ?? [];
    if (roleTags.includes(role)) continue; // vendor already plays this role
    const key = `${ven.id}::${role}`;
    if (seen.has(key)) continue; // already proposed (pending or earlier this run)
    seen.add(key);

    await ccp().create({
      data: {
        vendorId: ven.id,
        vendorName: ven.name,
        currentCategory: ven.category,
        proposedCategory: ven.category, // label left as-is by default; admin can edit on review
        currentRoleTags: roleTags,
        proposedRoleTags: [...roleTags, role],
        rationale:
          `Ingested evidence shows ${ven.name} now has a ${cap.capabilityId.replace(/_/g, " ")} ` +
          `capability at maturity ${Math.round(cap.maturityScore)} — implying the "${role}" role, which it ` +
          `does not currently hold. Approving adds "${role}", moving it in the rankings, quadrant and ` +
          `"who wins each layer". Review before applying.`,
        triggerCapabilityId: cap.capabilityId,
        triggerMaturity: cap.maturityScore,
        sourceUrls: [],
      },
    });
    created += 1;
    createdFor.push({ vendorId: ven.id, role });
  }
  return { skipped: false, scanned: caps.length, created, createdFor };
}

/** List proposals, newest first. Pass a status to filter (default: all). */
export async function listCategoryChangeProposals(status?: string): Promise<CategoryChangeProposal[]> {
  if (!hasDatabase()) return [];
  const rows = await ccp().findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(mapRow);
}

/** Approve a proposal: APPLY the role/category change to the vendor, mark applied. */
export async function approveCategoryChangeProposal(input: {
  proposalId: string;
  reviewerId: string;
  reviewNotes?: string;
}): Promise<CategoryChangeProposal> {
  if (!hasDatabase()) throw new Error("DATABASE_URL required to approve proposals");
  const prisma = getPrisma();
  const existing = (await ccp().findUnique({ where: { id: input.proposalId } })) as Record<string, unknown> | null;
  if (!existing) throw new Error(`unknown proposal ${input.proposalId}`);
  if (existing.status !== "pending") throw new Error(`proposal ${input.proposalId} already ${String(existing.status)}`);

  const updated = await prisma.$transaction(async (tx) => {
    // Apply the structured change to the vendor (this is what moves rankings).
    await tx.intelligenceVendor.update({
      where: { id: String(existing.vendorId) },
      data: {
        roleTags: (existing.proposedRoleTags as string[] | undefined) ?? [],
        ...(existing.proposedCategory ? { category: String(existing.proposedCategory) } : {}),
      },
    });
    return ccp(tx).update({
      where: { id: String(existing.id) },
      data: {
        status: "approved",
        reviewerId: input.reviewerId,
        reviewNotes: input.reviewNotes,
        reviewedAt: new Date(),
        appliedAt: new Date(),
      },
    });
  });
  return mapRow(updated);
}

/** Reject a proposal: record the decision; the vendor is left unchanged. */
export async function rejectCategoryChangeProposal(input: {
  proposalId: string;
  reviewerId: string;
  reviewNotes?: string;
}): Promise<CategoryChangeProposal> {
  if (!hasDatabase()) throw new Error("DATABASE_URL required to reject proposals");
  const existing = (await ccp().findUnique({ where: { id: input.proposalId } })) as Record<string, unknown> | null;
  if (!existing) throw new Error(`unknown proposal ${input.proposalId}`);
  if (existing.status !== "pending") throw new Error(`proposal ${input.proposalId} already ${String(existing.status)}`);
  const updated = await ccp().update({
    where: { id: input.proposalId },
    data: {
      status: "rejected",
      reviewerId: input.reviewerId,
      reviewNotes: input.reviewNotes,
      reviewedAt: new Date(),
    },
  });
  return mapRow(updated);
}
