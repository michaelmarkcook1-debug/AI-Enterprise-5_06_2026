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

export interface DeriveDependenciesResult {
  skipped: boolean;
  reason?: string;
  upserted: number;
  failed: number;
}

export async function deriveDependencySignals(): Promise<DeriveDependenciesResult> {
  if (!hasDatabase()) {
    return { skipped: true, reason: "no_database", upserted: 0, failed: 0 };
  }
  const prisma = getPrisma();
  const edges = projectExposureToDependencyEdges();

  let upserted = 0;
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
    } catch {
      // Skip a single edge's write failure rather than aborting the pass.
      failed += 1;
    }
  }

  return { skipped: false, upserted, failed };
}
