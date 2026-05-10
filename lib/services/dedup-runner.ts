// Operational runner around the pure dedup primitives.
// ─────────────────────────────────────────────────────
// Two modes:
//   - "report"      (default) — read-only. Loads pending proposals,
//                              clusters them, returns counts + groups.
//                              Writes nothing.
//   - "exact_merge" (opt-in) — applies exact-cluster auto-merges only.
//                              Marks non-representative members as
//                              `superseded` with a `reviewNotes` audit
//                              breadcrumb. Near-duplicates are NEVER
//                              auto-merged regardless of mode.
//
// Hard rules:
//   - Classifier-fallback rows can never trigger an auto-merge — they're
//     routed to human review even when their excerpt hash matches.
//   - Public scoring outputs (rankings, /capabilities) are unaffected:
//     superseded EvidenceProposal rows were never promoted to
//     EvidenceRecord in the first place.

import { hasDatabase, getPrisma } from "../prisma";
import {
  buildDedupReport,
  pickRepresentative,
  type DedupInput,
  type DedupReport,
  type DedupOptions,
} from "./dedup";

export type DedupMode = "report" | "exact_merge";

export interface DedupRunOptions extends DedupOptions {
  mode?: DedupMode;
  vendorId?: string;
  limit?: number;
  /** Reviewer/operator id recorded on the superseded rows when in
   * exact_merge mode. Defaults to "system:dedup-runner". */
  decidedBy?: string;
}

export interface DedupRunResult {
  mode: DedupMode;
  report: DedupReport;
  /** Number of EvidenceProposal rows marked `superseded` this run. Always
   * 0 when mode = "report". */
  mergedCount: number;
  /** Per-cluster merge actions actually taken (or planned in dry-run). */
  mergeActions: {
    representativeId: string;
    supersededIds: string[];
    canonicalSourceUrl: string;
    excerptHash: string;
  }[];
}

interface ProposalShape {
  id: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  sourceUrl: string | null;
  capturedAt: Date;
  classifierConfidence: number;
  classifierRationale: string | null;
  classificationFailed?: boolean | null;
  confidenceIsFallback?: boolean | null;
  proposedGrade?: string | null;
}

function toDedupInput(p: ProposalShape): DedupInput {
  return {
    id: p.id,
    vendorId: p.vendorId,
    domain: p.domain,
    subfactor: p.subfactor,
    excerpt: p.excerpt,
    sourceUrl: p.sourceUrl,
    capturedAt: p.capturedAt,
    classifierConfidence: p.classifierConfidence,
    classifierRationale: p.classifierRationale,
    classificationFailed: p.classificationFailed ?? null,
    confidenceIsFallback: p.confidenceIsFallback ?? null,
    proposedGrade: p.proposedGrade ?? null,
  };
}

export async function runDedup(opts: DedupRunOptions = {}): Promise<DedupRunResult> {
  const mode: DedupMode = opts.mode ?? "report";

  if (!hasDatabase()) {
    return {
      mode,
      report: emptyReport(),
      mergedCount: 0,
      mergeActions: [],
    };
  }

  const prisma = getPrisma();
  const proposals = await prisma.evidenceProposal.findMany({
    where: { status: "pending", vendorId: opts.vendorId },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 5000,
  });

  const inputs = proposals.map(toDedupInput);
  const report = buildDedupReport(inputs, opts);

  // ── Plan merge actions for exact clusters where it's safe ──
  const mergeActions: DedupRunResult["mergeActions"] = [];
  for (const cluster of report.exactClusters) {
    const rep = pickRepresentative(cluster);
    if (rep === null) continue; // every member is fallback — human review
    const allReal = cluster.members.every(
      (m) => !m.classificationFailed && !m.confidenceIsFallback,
    );
    if (!allReal) continue; // any fallback member blocks auto-merge
    const supersededIds = cluster.members.filter((m) => m.id !== rep.id).map((m) => m.id);
    if (supersededIds.length === 0) continue;
    mergeActions.push({
      representativeId: rep.id,
      supersededIds,
      canonicalSourceUrl: cluster.canonicalSourceUrl,
      excerptHash: cluster.excerptHash,
    });
  }

  let mergedCount = 0;
  if (mode === "exact_merge" && mergeActions.length > 0) {
    const decidedBy = opts.decidedBy ?? "system:dedup-runner";
    const now = new Date();
    for (const action of mergeActions) {
      // Atomic per-cluster: a single failed update doesn't poison the run.
      try {
        const result = await prisma.evidenceProposal.updateMany({
          where: { id: { in: action.supersededIds }, status: "pending" },
          data: {
            status: "superseded",
            reviewerId: decidedBy,
            reviewedAt: now,
            reviewNotes: `Auto-merged by dedup-runner — exact duplicate of ${action.representativeId} (canonicalUrl=${action.canonicalSourceUrl})`,
          },
        });
        mergedCount += result.count;
      } catch (err) {
        console.error(`[dedup-runner] merge failed for cluster rep=${action.representativeId}`, err);
      }
    }
  }

  return { mode, report, mergedCount, mergeActions };
}

function emptyReport(): DedupReport {
  return {
    totalInput: 0,
    exactClusterCount: 0,
    exactDuplicateRows: 0,
    nearClusterCount: 0,
    nearDuplicateRows: 0,
    safeAutoMergeRows: 0,
    humanReviewRows: 0,
    exactClusters: [],
    nearClusters: [],
  };
}
