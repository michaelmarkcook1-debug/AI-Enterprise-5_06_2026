// Exposure-map edit proposals — append-only JSONL capture.
// ─────────────────────────────────────────────────────────
// The Indirect Exposure Map's edge data lives in TypeScript
// (lib/investing/exposure-map-data.ts) because every edge needs to
// pass a build-time sanity check before deploy. This module gives
// operators a way to PROPOSE a change without immediately mutating
// the live map — proposals are written to a JSONL audit log and a
// reviewer can fold approved ones into the data file on the next
// commit.
//
// Why JSONL not Postgres:
//   - Same forensics + portability argument as triage-audit.ts:
//     append-only, greppable, ships easily to S3 / SIEM.
//   - No schema migration to ship the first version.
//
// File location: <repo>/data/exposure-edit-proposals.jsonl (gitignored)
// on local; /tmp/ai-enterpise on Vercel (read-only FS everywhere else).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConfidenceTier, RelationshipType } from "../investing/exposure-map-data";

export interface ExposureEditProposal {
  /** ISO timestamp the proposal was recorded. */
  timestamp: string;
  /** Reviewer / operator id. "anonymous" if not provided. */
  proposedBy: string;
  /** What the operator wants to do. */
  action: "add" | "update" | "remove";
  /** Edge ID. For "add", chosen by operator; for "update"/"remove" must match existing id. */
  edgeId: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  strengthScore: number;
  confidence: ConfidenceTier;
  estimatedValue?: string;
  summary: string;
  sourceUrls: string[];
  /** Free-text justification — why this change matters. */
  rationale: string;
}

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const DATA_DIR = IS_VERCEL
  ? "/tmp/ai-enterpise"
  : path.resolve(process.cwd(), "data");
const AUDIT_FILE = path.join(DATA_DIR, "exposure-edit-proposals.jsonl");

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // If even /tmp fails, downstream writes degrade to console-only.
  }
}

export async function recordExposureEditProposal(p: ExposureEditProposal): Promise<void> {
  const line = JSON.stringify(p) + "\n";
  try {
    await ensureDataDir();
    await fs.appendFile(AUDIT_FILE, line, "utf8");
  } catch (err) {
    // Don't throw — preserve the audit trail in platform logs.
    console.log(`[exposure-edit-proposal] ${JSON.stringify(p)}`);
    console.warn(`[exposure-edit-proposal] file write failed, fell back to console: ${(err as Error).message}`);
  }
}

export async function listExposureEditProposals(): Promise<ExposureEditProposal[]> {
  try {
    const blob = await fs.readFile(AUDIT_FILE, "utf8");
    return blob
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as ExposureEditProposal);
  } catch {
    return [];
  }
}

export const EXPOSURE_EDIT_AUDIT_FILE = AUDIT_FILE;
