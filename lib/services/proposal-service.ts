// Admin review workflow for EvidenceProposal rows.
// Approve → promote to EvidenceRecord (production scoring data).
// Reject → mark rejected with notes; never promoted.

import { getPrisma, hasDatabase } from "../prisma";
import type { EvidenceProposal, PrismaClient, ProposalStatus } from "../../generated/prisma/client";

type Client = PrismaClient;

/** Map ticker-style ids (used by PRODUCT_SCOPES) to the plain-name ids
 * used by VendorProfile. Falls back to identity for non-ticker ids. */
const TICKER_TO_PLAIN: Record<string, string> = {
  msft: "microsoft",
  googl: "google",
  amzn: "aws",
  crm: "salesforce",
  now: "servicenow",
  orcl: "oracle",
  snow: "snowflake",
  avgo: "broadcom",
};

/** Resolve the EvidenceProposal.vendorId (e.g. `vendor_writer`,
 * `vendor_microsoft`) to a VendorProfile.id (e.g. `writer`, `microsoft`).
 * Returns null when no profile matches — caller surfaces a useful error
 * instead of letting the FK violation propagate. */
async function resolveVendorProfileId(c: Client, vendorId: string): Promise<string | null> {
  // Candidate forms, in order of preference:
  //   1. exact match (already plain)
  //   2. strip `vendor_` prefix
  //   3. strip `vendor_` then map ticker → plain
  //   4. map ticker → plain on the raw id
  const candidates = new Set<string>();
  candidates.add(vendorId);
  if (vendorId.startsWith("vendor_")) {
    const stripped = vendorId.slice("vendor_".length);
    candidates.add(stripped);
    if (TICKER_TO_PLAIN[stripped]) candidates.add(TICKER_TO_PLAIN[stripped]);
  }
  if (TICKER_TO_PLAIN[vendorId]) candidates.add(TICKER_TO_PLAIN[vendorId]);

  const hit = await c.vendorProfile.findFirst({
    where: { id: { in: [...candidates] } },
    select: { id: true },
  });
  return hit?.id ?? null;
}

export async function listProposals(
  filter: { status?: ProposalStatus; vendorId?: string } = {},
  client?: Client,
): Promise<EvidenceProposal[]> {
  if (!client && !hasDatabase()) return [];
  const c = client ?? getPrisma();
  return c.evidenceProposal.findMany({
    where: { status: filter.status, vendorId: filter.vendorId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function approveProposal(input: {
  proposalId: string;
  reviewerId: string;
  reviewNotes?: string;
  // Optional final overrides
  finalGrade?: EvidenceProposal["proposedGrade"];
  finalRawScore?: number;
  client?: Client;
}): Promise<{ proposalId: string; promotedEvidenceId: string }> {
  if (!input.client && !hasDatabase()) throw new Error("DATABASE_URL required to approve proposals");
  const c = input.client ?? getPrisma();

  const proposal = await c.evidenceProposal.findUnique({ where: { id: input.proposalId } });
  if (!proposal) throw new Error(`unknown proposal ${input.proposalId}`);
  if (proposal.status !== "pending") throw new Error(`proposal ${input.proposalId} already ${proposal.status}`);

  const evidenceId = `ev_${proposal.id}`;
  const grade = input.finalGrade ?? proposal.proposedGrade;
  const rawScore = input.finalRawScore ?? proposal.proposedRawScore;

  // Bridge the vendor-id namespace mismatch on the EvidenceRecord FK.
  //
  // Two namespaces exist in this codebase:
  //   - VendorProfile.id   → plain names (writer, microsoft, anthropic, …)
  //   - PRODUCT_SCOPES     → ticker-style (msft, googl, amzn, crm, …)
  // EvidenceProposal.vendorId is the pipeline form (vendor_writer,
  // vendor_microsoft, …). EvidenceRecord.vendorId is a FK on
  // VendorProfile.id, so it needs the plain-name form.
  //
  // Strategy: prefer-match. Try stripping `vendor_` first; if that
  // matches a VendorProfile, use it. Otherwise fall through to the
  // product-linkage canonicaliser (which knows the ticker mappings)
  // and try matching ticker → plain name via a small inverse map.
  const canonVendorId = await resolveVendorProfileId(c, proposal.vendorId);
  if (!canonVendorId) {
    throw new Error(
      `Cannot approve ${proposal.id}: no VendorProfile matches "${proposal.vendorId}". Add the vendor first or run prisma db seed.`,
    );
  }

  return c.$transaction(async (tx) => {
    await tx.evidenceRecord.create({
      data: {
        id: evidenceId,
        vendorId: canonVendorId,
        sourceUrl: proposal.sourceUrl,
        capturedAt: proposal.capturedAt,
        excerpt: proposal.excerpt,
        domain: proposal.domain,
        subfactor: proposal.subfactor,
        evidenceGrade: grade,
        rawScore,
        confidence: proposal.classifierConfidence,
        reviewStatus: "analyst_verified",
      },
    });
    await tx.evidenceProposal.update({
      where: { id: proposal.id },
      data: {
        status: "approved",
        reviewerId: input.reviewerId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes,
        promotedEvidenceId: evidenceId,
      },
    });
    return { proposalId: proposal.id, promotedEvidenceId: evidenceId };
  });
}

export async function deferProposal(input: {
  proposalId: string;
  reviewerId: string;
  reason?: string;
  client?: Client;
}): Promise<{ proposalId: string; reviewNotes: string }> {
  if (!input.client && !hasDatabase()) throw new Error("DATABASE_URL required to defer proposals");
  const c = input.client ?? getPrisma();
  const proposal = await c.evidenceProposal.findUnique({ where: { id: input.proposalId } });
  if (!proposal) throw new Error(`unknown proposal ${input.proposalId}`);
  if (proposal.status !== "pending") throw new Error(`proposal ${input.proposalId} already ${proposal.status}`);

  // Defer writes the DEFERRED sentinel to reviewNotes and leaves
  // status=pending. The batch-review UI filters deferred rows out by
  // default so the operator's working set shrinks visibly without
  // losing the row.
  const { buildDeferredNotes } = await import("./batch-review");
  const notes = buildDeferredNotes({ reviewerId: input.reviewerId, reason: input.reason });
  await c.evidenceProposal.update({
    where: { id: proposal.id },
    data: {
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes,
      // status stays "pending" — this is the deferred-but-not-decided state
    },
  });
  return { proposalId: proposal.id, reviewNotes: notes };
}

export async function rejectProposal(input: {
  proposalId: string;
  reviewerId: string;
  reviewNotes?: string;
  client?: Client;
}): Promise<{ proposalId: string }> {
  if (!input.client && !hasDatabase()) throw new Error("DATABASE_URL required to reject proposals");
  const c = input.client ?? getPrisma();
  const proposal = await c.evidenceProposal.findUnique({ where: { id: input.proposalId } });
  if (!proposal) throw new Error(`unknown proposal ${input.proposalId}`);
  if (proposal.status !== "pending") throw new Error(`proposal ${input.proposalId} already ${proposal.status}`);

  await c.evidenceProposal.update({
    where: { id: proposal.id },
    data: {
      status: "rejected",
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.reviewNotes,
    },
  });
  return { proposalId: proposal.id };
}

