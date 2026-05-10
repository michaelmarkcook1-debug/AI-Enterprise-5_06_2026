// Orchestrates: VendorSource → fetch → extract → IngestionJob/EvidenceProposal rows.

import { extractEvidence } from "../agents/evidence-extractor";
import { fetchSource } from "./fetcher";
import { getPrisma, hasDatabase } from "../prisma";
import { getSeedVendors } from "../seed-vendors";
import type {
  IngestionJob,
  IngestionStatus,
  PrismaClient,
  SourceCategory,
  VendorSource,
} from "../../generated/prisma/client";

type IngestClient = PrismaClient;

export interface RunIngestionOptions {
  vendorId: string;
  sourceId?: string;
  // For tests / sandboxed runs: skip network and use this content directly.
  inlineContent?: { url: string; rawText: string; sourceCategory: SourceCategory };
  client?: IngestClient;
}

export interface IngestionRunResult {
  jobId: string;
  status: IngestionStatus;
  proposalsCount: number;
  error?: string;
}

export async function runIngestion(opts: RunIngestionOptions): Promise<IngestionRunResult> {
  if (!hasDatabase() && !opts.client) {
    // Without DB: still run the agent end-to-end against an inline payload so callers
    // can dry-run extraction. We just don't persist.
    if (!opts.inlineContent) {
      throw new Error("DATABASE_URL not set and no inlineContent supplied — cannot run ingestion");
    }
    const vendor = getSeedVendors().find((v) => v.id === opts.vendorId);
    if (!vendor) throw new Error(`unknown vendor ${opts.vendorId}`);
    const ext = await extractEvidence({
      vendorName: vendor.name,
      vendorCategory: vendor.category,
      sourceCategory: opts.inlineContent.sourceCategory,
      sourceUrl: opts.inlineContent.url,
      rawContent: opts.inlineContent.rawText,
    });
    return { jobId: "dryrun", status: "completed", proposalsCount: ext.data.proposals.length };
  }

  const client = opts.client ?? getPrisma();
  const source = opts.sourceId
    ? await client.vendorSource.findUnique({ where: { id: opts.sourceId } })
    : null;
  if (opts.sourceId && !source) throw new Error(`unknown source ${opts.sourceId}`);

  const vendor = await client.vendorProfile.findUnique({ where: { id: opts.vendorId } });
  if (!vendor) throw new Error(`unknown vendor ${opts.vendorId}`);

  const job = await client.ingestionJob.create({
    data: {
      vendorId: opts.vendorId,
      sourceId: opts.sourceId,
      status: "queued",
    },
  });

  try {
    let url: string;
    let rawText: string;
    let sourceCategory: SourceCategory;
    if (opts.inlineContent) {
      url = opts.inlineContent.url;
      rawText = opts.inlineContent.rawText;
      sourceCategory = opts.inlineContent.sourceCategory;
    } else if (source) {
      await markStatus(client, job.id, "fetching");
      const fetched = await fetchSource(source.url);
      url = source.url;
      rawText = fetched.rawText;
      sourceCategory = source.category;
      await client.ingestionJob.update({
        where: { id: job.id },
        data: {
          rawContent: rawText,
          rawContentHash: fetched.contentHash,
          startedAt: new Date(),
        },
      });
      await client.vendorSource.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date() },
      });
    } else {
      throw new Error("no source or inlineContent");
    }

    await markStatus(client, job.id, "extracting");
    const extraction = await extractEvidence({
      vendorName: vendor.name,
      vendorCategory: vendor.category,
      sourceCategory,
      sourceUrl: url,
      rawContent: rawText,
    });

    const now = new Date();
    await client.evidenceProposal.createMany({
      data: extraction.data.proposals.map((p) => ({
        jobId: job.id,
        vendorId: vendor.id,
        domain: p.domain,
        subfactor: p.subfactor,
        excerpt: p.excerpt,
        proposedGrade: p.proposedGrade,
        proposedRawScore: p.proposedRawScore,
        sourceUrl: url,
        capturedAt: now,
        classifierConfidence: 0.7,
        classifierRationale: p.rationale,
        status: "pending" as const,
      })),
    });

    await client.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: "ready_for_review",
        finishedAt: now,
        proposalsCount: extraction.data.proposals.length,
      },
    });

    return {
      jobId: job.id,
      status: "ready_for_review",
      proposalsCount: extraction.data.proposals.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await client.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message, finishedAt: new Date() },
    });
    return { jobId: job.id, status: "failed", proposalsCount: 0, error: message };
  }
}

async function markStatus(client: IngestClient, jobId: string, status: IngestionStatus) {
  await client.ingestionJob.update({ where: { id: jobId }, data: { status } });
}

export async function listIngestionJobs(client?: IngestClient): Promise<IngestionJob[]> {
  if (!client && !hasDatabase()) return [];
  const c = client ?? getPrisma();
  return c.ingestionJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listSources(vendorId: string, client?: IngestClient): Promise<VendorSource[]> {
  if (!client && !hasDatabase()) return [];
  const c = client ?? getPrisma();
  return c.vendorSource.findMany({
    where: { vendorId, active: true },
    orderBy: { category: "asc" },
  });
}
