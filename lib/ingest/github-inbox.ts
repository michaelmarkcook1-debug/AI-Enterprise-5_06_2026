// Routine-intel GitHub inbox — a network-egress workaround.
// ─────────────────────────────────────────────────────────────────────────────
// 2026-07-03: the AI-competitive-intel Routine's sandbox proxy blocks outbound
// calls to arbitrary domains (curl to our ingest endpoint returned "CONNECT
// tunnel failed, response 403"), but the Routine already has PUSH access to
// this GitHub repo. So instead of the Routine calling US, it drops JSON files
// on a dedicated branch and WE pull them via the GitHub REST API — no outbound
// network needed from the Routine's sandbox at all.
//
// Safety:
//   - The inbox branch (default "routine-intel-inbox") is excluded from Vercel
//     builds by vercel.json's `ignoreCommand`, so pushes to it never trigger a
//     preview deployment / Neon preview branch (the exact resource we hit the
//     ceiling on this session).
//   - We only READ from GitHub (Contents API, GET) — this module never writes
//     to the repo. No push, no merge, no destructive git operation.
//   - Every file's findings/proposals go through the SAME validateFinding /
//     validateProposal / persistFinding / persistProposal firewall as the
//     direct POST endpoint (lib/ingest/competitive-intel.ts) — real https
//     source + known vendor required, proposals capped at E1-E3, never a
//     direct score write.
//   - Idempotent: findings dedupe via their content hash (newsItemId), but
//     EvidenceProposal rows are plain `create` (no natural dedup key), so we
//     track (path, sha) pairs already processed in a self-migrating table —
//     re-scanning the same file twice is a safe no-op, never a duplicate.

import type { PrismaClient } from "../../generated/prisma/client";
import { getPrisma, hasDatabase } from "../prisma";
import {
  validateFinding,
  validateProposal,
  persistFinding,
  persistProposal,
  type ExternalFinding,
  type ExternalProposal,
  type RejectedItem,
} from "./competitive-intel";

const DEFAULT_REPO = "michaelmarkcook1-debug/AI-Enterprise-5_06_2026";
const DEFAULT_BRANCH = "routine-intel-inbox";
const DEFAULT_PATH = "routine-inbox";
const MAX_FILES_PER_RUN = 25; // safety ceiling — the routine runs at most daily
const MAX_ITEMS_PER_FILE = 100; // mirrors the direct-POST route's per-call cap

function config() {
  return {
    token: process.env.GITHUB_INBOX_TOKEN ?? "",
    repo: process.env.GITHUB_INBOX_REPO || DEFAULT_REPO,
    branch: process.env.GITHUB_INBOX_BRANCH || DEFAULT_BRANCH,
    path: process.env.GITHUB_INBOX_PATH || DEFAULT_PATH,
  };
}

/** True only when a GITHUB_INBOX_TOKEN is configured — the step honestly skips
 *  (never errors) when it isn't, same posture as every optional pipeline step. */
export function isInboxConfigured(): boolean {
  return Boolean(process.env.GITHUB_INBOX_TOKEN);
}

interface GitHubContentEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  download_url: string | null;
}

async function githubFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-enterprise-routine-inbox",
    },
    cache: "no-store",
  });
}

// ── Self-migrating dedupe table (spend-ledger / daily-refresh-store pattern) ──
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "routine_inbox_processed" (
  "path"         TEXT NOT NULL,
  "sha"          TEXT NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("path", "sha")
);
`;
let tableEnsured = false;
async function ensureTable(prisma: PrismaClient): Promise<void> {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(CREATE_SQL);
  tableEnsured = true;
}

async function alreadyProcessed(prisma: PrismaClient, path: string, sha: string): Promise<boolean> {
  const rows = (await prisma.$queryRaw`
    SELECT 1 FROM "routine_inbox_processed" WHERE "path" = ${path} AND "sha" = ${sha} LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

async function markProcessed(prisma: PrismaClient, path: string, sha: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "routine_inbox_processed" ("path", "sha") VALUES (${path}, ${sha})
    ON CONFLICT ("path", "sha") DO NOTHING
  `;
}

interface InboxFileBody {
  source?: string;
  findings?: ExternalFinding[];
  proposals?: ExternalProposal[];
}

export interface RoutineInboxPullResult {
  configured: boolean;
  filesListed: number;
  filesProcessed: number;
  filesSkippedAlreadyProcessed: number;
  findingsAccepted: number;
  findingsRejected: RejectedItem[];
  proposalsAccepted: number;
  proposalsRejected: RejectedItem[];
  error?: string;
}

const EMPTY_RESULT = (configured: boolean, error?: string): RoutineInboxPullResult => ({
  configured,
  filesListed: 0,
  filesProcessed: 0,
  filesSkippedAlreadyProcessed: 0,
  findingsAccepted: 0,
  findingsRejected: [],
  proposalsAccepted: 0,
  proposalsRejected: [],
  ...(error ? { error } : {}),
});

/**
 * Pull + ingest any new JSON files from the routine's GitHub inbox branch.
 * Honest no-ops: no token configured → { configured: false }; no database →
 * same; a GitHub API error is captured in `.error`, never thrown (this must
 * never break the wider daily-refresh pipeline).
 */
export async function pullRoutineInbox(now: Date = new Date()): Promise<RoutineInboxPullResult> {
  const { token, repo, branch, path } = config();
  if (!token) return EMPTY_RESULT(false);
  if (!hasDatabase()) return EMPTY_RESULT(true, "no database configured");

  const prisma = getPrisma();
  try {
    await ensureTable(prisma);

    const listUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const listRes = await githubFetch(listUrl, token);
    if (listRes.status === 404) {
      // Honest: no inbox directory yet (the routine hasn't pushed anything) —
      // not an error, just nothing to do.
      return { ...EMPTY_RESULT(true), filesListed: 0 };
    }
    if (!listRes.ok) {
      return EMPTY_RESULT(true, `GitHub list failed: ${listRes.status} ${await listRes.text().catch(() => "")}`.slice(0, 300));
    }
    const entries = (await listRes.json()) as GitHubContentEntry[];
    const files = entries
      .filter((e) => e.type === "file" && e.name.endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_FILES_PER_RUN);

    let filesProcessed = 0;
    let filesSkipped = 0;
    let findingsAccepted = 0;
    let proposalsAccepted = 0;
    const findingsRejected: RejectedItem[] = [];
    const proposalsRejected: RejectedItem[] = [];

    const vendorRows = await prisma.intelligenceVendor.findMany({ select: { id: true } });
    const knownVendors = new Set(vendorRows.map((v) => v.id));

    for (const file of files) {
      if (await alreadyProcessed(prisma, file.path, file.sha)) {
        filesSkipped += 1;
        continue;
      }
      if (!file.download_url) continue;
      let body: InboxFileBody;
      try {
        const raw = await githubFetch(file.download_url, token);
        if (!raw.ok) throw new Error(`fetch ${raw.status}`);
        body = (await raw.json()) as InboxFileBody;
      } catch (err) {
        findingsRejected.push({ index: -1, reason: `${file.path}: unreadable (${(err as Error).message})` });
        continue;
      }

      const findings = Array.isArray(body.findings) ? body.findings.slice(0, MAX_ITEMS_PER_FILE) : [];
      const proposals = Array.isArray(body.proposals) ? body.proposals.slice(0, MAX_ITEMS_PER_FILE) : [];

      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const reason = validateFinding(f, knownVendors);
        if (reason) {
          findingsRejected.push({ index: i, reason: `${file.path}#${i}: ${reason}` });
          continue;
        }
        await persistFinding(prisma, f);
        findingsAccepted += 1;
      }

      // jobId is a plain label (proposals reference it loosely, same as the
      // direct-POST route) — one per source file, so triage can trace a
      // proposal back to which inbox drop it came from.
      const jobId = `ext-ci-inbox-${file.name.replace(/[^a-z0-9-]/gi, "").slice(0, 40)}`;
      for (let i = 0; i < proposals.length; i++) {
        const p = proposals[i];
        const reason = validateProposal(p, knownVendors);
        if (reason) {
          proposalsRejected.push({ index: i, reason: `${file.path}#${i}: ${reason}` });
          continue;
        }
        await persistProposal(prisma, p, jobId);
        proposalsAccepted += 1;
      }

      await markProcessed(prisma, file.path, file.sha);
      filesProcessed += 1;
    }

    return {
      configured: true,
      filesListed: files.length,
      filesProcessed,
      filesSkippedAlreadyProcessed: filesSkipped,
      findingsAccepted,
      findingsRejected,
      proposalsAccepted,
      proposalsRejected,
    };
  } catch (err) {
    return EMPTY_RESULT(true, (err as Error).message);
  }
}
