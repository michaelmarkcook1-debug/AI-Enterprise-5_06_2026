// POST  → record an exposure-map edit proposal (append-only JSONL).
// GET   → list every recorded proposal.
//
// Proposals are NOT applied to the live map automatically. A reviewer
// folds approved ones into lib/investing/exposure-map-data.ts on a
// follow-up commit, where the build-time sanity check then runs.

import { isCronOrAdminRequest, cronUnauthorized } from "@/lib/cron/auth";
import {
  recordExposureEditProposal,
  listExposureEditProposals,
  type ExposureEditProposal,
} from "@/lib/services/exposure-edit-audit";
import { EXPOSURE_NODES, EXPOSURE_EDGES } from "@/lib/investing/exposure-map-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_RELATIONSHIP = new Set(["investment", "cloud", "model_hosting", "commercial_partnership", "supply_chain", "subsidiary"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "seed"]);
const VALID_ACTION = new Set(["add", "update", "remove"]);
const NODE_IDS = new Set(EXPOSURE_NODES.map((n) => n.id));
const EDGE_IDS = new Set(EXPOSURE_EDGES.map((e) => e.id));

async function handlePost(request: Request) {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body as Partial<ExposureEditProposal> & Record<string, unknown>;

  // Light validation — strict enough to reject garbage, lenient enough
  // not to require schema migration before adding fields.
  if (!raw.action || !VALID_ACTION.has(raw.action)) return Response.json({ error: "action must be add/update/remove" }, { status: 422 });
  if (!raw.edgeId || typeof raw.edgeId !== "string") return Response.json({ error: "edgeId required" }, { status: 422 });
  if (!raw.sourceId || !NODE_IDS.has(raw.sourceId)) return Response.json({ error: `sourceId must be one of: ${[...NODE_IDS].join(", ")}` }, { status: 422 });
  if (!raw.targetId || !NODE_IDS.has(raw.targetId)) return Response.json({ error: `targetId must be one of: ${[...NODE_IDS].join(", ")}` }, { status: 422 });
  if (!raw.relationshipType || !VALID_RELATIONSHIP.has(raw.relationshipType)) return Response.json({ error: "relationshipType invalid" }, { status: 422 });
  if (!raw.confidence || !VALID_CONFIDENCE.has(raw.confidence)) return Response.json({ error: "confidence must be high/medium/seed" }, { status: 422 });
  if (typeof raw.strengthScore !== "number" || raw.strengthScore < 0 || raw.strengthScore > 1) return Response.json({ error: "strengthScore must be 0..1" }, { status: 422 });
  if (!raw.summary || typeof raw.summary !== "string") return Response.json({ error: "summary required" }, { status: 422 });
  if (!Array.isArray(raw.sourceUrls)) return Response.json({ error: "sourceUrls must be string[]" }, { status: 422 });
  if (!raw.rationale || typeof raw.rationale !== "string") return Response.json({ error: "rationale required" }, { status: 422 });

  // Cross-check: update/remove must target an existing edge id.
  if ((raw.action === "update" || raw.action === "remove") && !EDGE_IDS.has(raw.edgeId)) {
    return Response.json({ error: `edgeId "${raw.edgeId}" is not an existing edge (current ids: ${[...EDGE_IDS].slice(0, 5).join(", ")}…)` }, { status: 422 });
  }

  const proposal: ExposureEditProposal = {
    timestamp: new Date().toISOString(),
    proposedBy: typeof raw.proposedBy === "string" && raw.proposedBy ? raw.proposedBy : "anonymous",
    action: raw.action,
    edgeId: raw.edgeId,
    sourceId: raw.sourceId,
    targetId: raw.targetId,
    relationshipType: raw.relationshipType,
    strengthScore: raw.strengthScore,
    confidence: raw.confidence,
    estimatedValue: typeof raw.estimatedValue === "string" ? raw.estimatedValue : undefined,
    summary: raw.summary,
    sourceUrls: raw.sourceUrls.filter((u): u is string => typeof u === "string"),
    rationale: raw.rationale,
  };
  await recordExposureEditProposal(proposal);
  return Response.json({ ok: true, proposal });
}

async function handleGet(request: Request) {
  if (!isCronOrAdminRequest(request)) return cronUnauthorized();
  const proposals = await listExposureEditProposals();
  return Response.json({ proposals });
}

export const POST = handlePost;
export const GET = handleGet;
