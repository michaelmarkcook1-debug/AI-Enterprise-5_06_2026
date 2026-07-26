// Analyst review for one encroachment signal. Powers the hover popover on the
// "Encroachment watch" tiles (homepage + /dependencies).
//
// COST SHAPE: this is an Opus call behind a hover gesture on a PUBLIC page, so
// it must never be one call per hover. Two defences:
//   • module-level TTL cache — a warm instance answers repeat hovers for free;
//   • s-maxage — the CDN serves the same pair to everyone else for 6h.
// The inputs are near-static (curated exposure map + Shield corpus + a news
// read), so a long TTL costs nothing in freshness.
//
// The pair must resolve to a REAL derived edge. We never review an arbitrary
// vendor pair handed to us in the query string — that would let a caller
// manufacture an encroachment claim that the graph never made.

import {
  projectExposureToDependencyEdges,
} from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId } from "@/lib/graph/encroachment";
import { buildEncroachmentFacts } from "@/lib/graph/encroachment-context";
import { reviewEncroachment } from "@/lib/agents/encroachment-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const from = query.get("from");
  const to = query.get("to");
  if (!from || !to) {
    return Response.json({ error: "missing_pair" }, { status: 400 });
  }

  const key = `${from}->${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return Response.json(hit.body, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  }

  // Resolve the pair against the real derivation — not a caller-supplied claim.
  const rolesByNodeId = buildRolesByNodeId();
  const edges = deriveEncroachmentEdges(projectExposureToDependencyEdges(), rolesByNodeId);
  const edge = edges.find((e) => e.fromVendorId === from && e.toVendorId === to);
  if (!edge) {
    return Response.json({ error: "unknown_signal" }, { status: 404 });
  }

  try {
    const facts = await buildEncroachmentFacts(edge, rolesByNodeId);
    const result = await reviewEncroachment(facts);
    const body = {
      pair: { from, to, threatener: facts.threatener.label, threatened: facts.threatened.label },
      review: result.review,
      depth: result.depth,
      // Surfaced so the UI can label a deterministic fallback honestly rather
      // than passing it off as an analyst read.
      generated: result.source === "anthropic",
      inputsPresent: facts.inputsPresent,
      movementCount: facts.movements.length,
      statementCount: facts.statements.length,
      statementsAsOf: facts.statementsAsOf,
    };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body, {
      headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("[encroachment-review] failed", key, err);
    return Response.json({ error: "review_failed" }, { status: 500 });
  }
}
