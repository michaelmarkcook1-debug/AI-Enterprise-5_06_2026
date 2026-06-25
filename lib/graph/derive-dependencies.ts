// Dependency-signal writer (deterministic, no LLM).
// ──────────────────────────────────────────────────
// Upserts the projected dependency edges (see dependency-projection.ts) into the
// DependencySignal table so the graph is queryable from the DB and the brief's
// data model is populated. Idempotent via the (from,to,kind,direction) unique
// key. Pure projection of source-backed exposure data — no fabrication, no LLM,
// no spend. Safe to run every refresh cycle.

import { getPrisma, hasDatabase } from "../prisma";
import type { EvidenceGrade } from "../../generated/prisma/client";
import { projectExposureToDependencyEdges } from "./dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "./encroachment";

export interface DeriveDependenciesResult {
  skipped: boolean;
  reason?: string;
  /** depends_on edges upserted. */
  dependsOn: number;
  /** derived threatens (encroachment) edges upserted. */
  threatens: number;
  upserted: number;
  failed: number;
}

export async function deriveDependencySignals(): Promise<DeriveDependenciesResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", dependsOn: 0, threatens: 0, upserted: 0, failed: 0 };
  }
  const prisma = getPrisma();
  const dependsOnEdges = projectExposureToDependencyEdges();
  const encroachmentEdges = deriveEncroachmentEdges(dependsOnEdges, buildRolesByNodeId());
  const edges = [...dependsOnEdges, ...encroachmentEdges];

  let upserted = 0;
  let threatens = 0;
  let failed = 0;
  for (const e of edges) {
    try {
      await prisma.dependencySignal.upsert({
        where: {
          fromVendorId_toVendorId_kind_direction: {
            fromVendorId: e.fromVendorId,
            toVendorId: e.toVendorId,
            kind: e.kind,
            direction: e.direction,
          },
        },
        create: {
          fromVendorId: e.fromVendorId,
          toVendorId: e.toVendorId,
          kind: e.kind,
          direction: e.direction,
          strength: e.strength,
          rationale: e.rationale,
          sourceUrls: e.sourceUrls,
          confidence: e.confidence,
          evidenceGrade: e.evidenceGrade as EvidenceGrade,
        },
        update: {
          strength: e.strength,
          rationale: e.rationale,
          sourceUrls: e.sourceUrls,
          confidence: e.confidence,
          evidenceGrade: e.evidenceGrade as EvidenceGrade,
        },
      });
      upserted += 1;
      if (e.direction === "threatens") threatens += 1;
    } catch {
      // Skip a single edge's write failure rather than aborting the pass.
      failed += 1;
    }
  }

  return { skipped: false, dependsOn: upserted - threatens, threatens, upserted, failed };
}
