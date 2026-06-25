// Sanctioned score writer — the independence firewall, in code.
// ──────────────────────────────────────────────────────────────
// The public rankings are only trustworthy if a vendor's *score* can be moved
// ONLY by the evidence→rubric pipeline and NEVER by anything commercial (a paid
// tier, a claimed profile, a sponsorship). This module is the single sanctioned
// place that writes the score fields:
//
//   IntelligenceVendor.overallScore / confidenceScore   (headline rank)
//   IntelligencePillarScore.capabilityScore             (per-pillar rank)
//
// Every write must declare a `provenance` drawn from the evidence pipeline.
// Commercial code has no legitimate provenance to pass, and the static guard in
// score-writer.test.ts fails CI if any module outside the sanctioned set writes
// these fields directly — so the firewall is enforced, not merely intended.
//
// See VendorCommercial in schema.prisma: commercial facts live in a separate
// table with no relation into a score table.

import type { PrismaClient } from "../../generated/prisma/client";
import type { EvidenceGrade } from "../../generated/prisma/client";

/** The only legitimate reasons a score may change — all evidence/rubric paths. */
export type ScoreProvenance = "rubric_derive" | "evidence_projection" | "seed_init";

export interface ScoreWriteContext {
  provenance: ScoreProvenance;
}

const ALLOWED_PROVENANCE: readonly ScoreProvenance[] = [
  "rubric_derive",
  "evidence_projection",
  "seed_init",
];

/** Defensive runtime guard against a caller smuggling in a bogus provenance
 * (e.g. via `as any`). The static test is the primary firewall; this is belt
 * and braces for the runtime path. */
function assertProvenance(ctx: ScoreWriteContext): void {
  if (!ALLOWED_PROVENANCE.includes(ctx.provenance)) {
    throw new Error(`[score-writer] illegal score-write provenance: ${String(ctx.provenance)}`);
  }
}

/**
 * Write a vendor's headline scores. The ONLY sanctioned path to
 * IntelligenceVendor.overallScore / confidenceScore.
 */
export async function writeVendorScore(
  prisma: PrismaClient,
  vendorId: string,
  scores: { overallScore: number; confidenceScore: number },
  ctx: ScoreWriteContext,
): Promise<void> {
  assertProvenance(ctx);
  await prisma.intelligenceVendor.update({
    where: { id: vendorId },
    data: { overallScore: scores.overallScore, confidenceScore: scores.confidenceScore },
  });
}

/**
 * Upsert a vendor's per-pillar score. The ONLY sanctioned path to
 * IntelligencePillarScore.capabilityScore.
 */
export async function writePillarScore(
  prisma: PrismaClient,
  row: {
    vendorId: string;
    pillar: string;
    capabilityScore: number;
    evidenceGrade: EvidenceGrade;
    confidence: number;
  },
  ctx: ScoreWriteContext,
): Promise<void> {
  assertProvenance(ctx);
  await prisma.intelligencePillarScore.upsert({
    where: { vendorId_pillar: { vendorId: row.vendorId, pillar: row.pillar } },
    create: {
      vendorId: row.vendorId,
      pillar: row.pillar,
      capabilityScore: row.capabilityScore,
      evidenceGrade: row.evidenceGrade,
      confidence: row.confidence,
    },
    update: {
      capabilityScore: row.capabilityScore,
      evidenceGrade: row.evidenceGrade,
      confidence: row.confidence,
    },
  });
}
