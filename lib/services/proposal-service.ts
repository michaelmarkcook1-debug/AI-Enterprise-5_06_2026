// Admin review workflow for EvidenceProposal rows.
// Approve → promote to EvidenceRecord (production scoring data).
// Reject → mark rejected with notes; never promoted.

import { getPrisma, hasDatabase } from "../prisma";
import type { EvidenceProposal, PrismaClient, ProposalStatus } from "../../generated/prisma/client";

type Client = PrismaClient;

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

  return c.$transaction(async (tx) => {
    await tx.evidenceRecord.create({
      data: {
        id: evidenceId,
        vendorId: proposal.vendorId,
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

