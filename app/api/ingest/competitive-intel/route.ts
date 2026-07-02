// POST /api/ingest/competitive-intel
// ───────────────────────────────────
// Receiving end for the external AI-competitive-intelligence Routine.
// Auth: admin (session / x-admin-token / allowlisted IP) OR `Authorization:
// Bearer <ROUTINE_INGEST_TOKEN>` — a dedicated secret for THIS integration
// only (never CRON_SECRET, so revoking one never breaks the other). Never open.
//
// Body: { source?: string, findings?: ExternalFinding[], proposals?: ExternalProposal[] }
//   findings  → IntelligenceNewsItem (news feed; real https citation required)
//   proposals → EvidenceProposal (triage queue — NEVER direct scores; E3 cap)
//
// Partial acceptance: invalid items are rejected individually with reasons;
// valid ones persist. The response is the routine's feedback loop.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { safeEqual } from "@/lib/safe-equal";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import {
  validateFinding,
  validateProposal,
  persistFinding,
  persistProposal,
  type ExternalFinding,
  type ExternalProposal,
  type RejectedItem,
} from "@/lib/ingest/competitive-intel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITEMS = 100; // per call, per channel — the routine batches beyond this

function isRoutineAuthorized(request: Request): boolean {
  const secret = process.env.ROUTINE_INGEST_TOKEN ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && safeEqual(auth.slice(7), secret);
}

export async function POST(request: Request) {
  if (!isAdminRequest(request) && !isRoutineAuthorized(request)) return unauthorized();
  if (!hasDatabase()) {
    return Response.json({ ok: false, error: "no database configured" }, { status: 503 });
  }

  let body: { source?: string; findings?: ExternalFinding[]; proposals?: ExternalProposal[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const findings = Array.isArray(body.findings) ? body.findings.slice(0, MAX_ITEMS) : [];
  const proposals = Array.isArray(body.proposals) ? body.proposals.slice(0, MAX_ITEMS) : [];
  if (findings.length === 0 && proposals.length === 0) {
    return Response.json({ ok: false, error: "no findings or proposals supplied" }, { status: 400 });
  }

  const prisma = getPrisma();
  // Vendor ids are validated against the LIVE roster — unknown vendors are
  // rejected per item, never auto-created (vendors are never invented).
  const roster = await prisma.intelligenceVendor.findMany({ select: { id: true } });
  const knownVendors = new Set<string>(roster.map((v: { id: string }) => v.id));

  const findingsRejected: RejectedItem[] = [];
  let findingsAccepted = 0;
  for (let i = 0; i < findings.length; i++) {
    const reason = validateFinding(findings[i], knownVendors);
    if (reason) {
      findingsRejected.push({ index: i, reason });
      continue;
    }
    try {
      await persistFinding(prisma, findings[i]);
      findingsAccepted += 1;
    } catch (err) {
      findingsRejected.push({ index: i, reason: `persist: ${(err as Error).message}` });
    }
  }

  const jobId = `ext-ci-${(body.source ?? "routine").replace(/[^a-z0-9-]/gi, "").slice(0, 24)}-${new Date().toISOString().slice(0, 10)}`;
  const proposalsRejected: RejectedItem[] = [];
  let proposalsAccepted = 0;
  for (let i = 0; i < proposals.length; i++) {
    const reason = validateProposal(proposals[i], knownVendors);
    if (reason) {
      proposalsRejected.push({ index: i, reason });
      continue;
    }
    try {
      await persistProposal(prisma, proposals[i], jobId);
      proposalsAccepted += 1;
    } catch (err) {
      proposalsRejected.push({ index: i, reason: `persist: ${(err as Error).message}` });
    }
  }

  console.log(
    `[api/ingest/competitive-intel] source=${body.source ?? "routine"} findings=${findingsAccepted}/${findings.length} proposals=${proposalsAccepted}/${proposals.length}`,
  );
  if (findingsRejected.length || proposalsRejected.length) {
    console.error(
      `[api/ingest/competitive-intel] rejected — findings: ${JSON.stringify(findingsRejected)} proposals: ${JSON.stringify(proposalsRejected)}`,
    );
  }

  return Response.json({
    ok: findingsRejected.length === 0 && proposalsRejected.length === 0,
    findingsAccepted,
    findingsRejected,
    proposalsAccepted,
    proposalsRejected,
    note:
      proposalsAccepted > 0
        ? `proposals land in the admin triage queue (${jobId}) — they affect no score until approved`
        : undefined,
  });
}
