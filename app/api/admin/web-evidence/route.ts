// Roster-driven web_search evidence sourcing — admin trigger.
// ───────────────────────────────────────────────────────────
// POST { vendorId }            → run for ONE vendor (smoke test; recommended first).
// POST { gaps: true, limit? }  → source ONLY vendors whose evidence is thin
//                                BY BREADTH (< 9 of 13 domains covered) —
//                                weakest first, so `limit` spends the budget
//                                where it matters. These are the vendors
//                                showing "limited evidence" on category pages.
// POST { all: true }           → sweep the whole live roster.
//
// This is the ONLY ingestion path that reaches vendors with no hand-written
// manifest entry — 12 of the 47, including the entire Neocloud & inference
// category (Groq, CoreWeave, Together AI, Lambda). The manifest-driven vendor
// picker on /admin/ingestion physically cannot source them: they aren't in it.
//
// Discovers real, cited sources via web_search and writes pending evidence
// proposals; the existing triage → projection path promotes E2+ to pillars.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { hasDatabase } from "@/lib/prisma";
import { listIntelligenceVendors, getEvidenceDomainCoverageByVendor } from "@/lib/intelligence/repository";
import { runWebEvidenceSourcing, runWebEvidenceSweep } from "@/lib/sourcing/web-evidence-runner";
import { scheduleBackgroundJob } from "@/lib/system/with-background-job";

// A vendor is "covered" once it holds verified evidence in at least this many of
// the 13 domains.
//
// This USED to be ">= 10 analyst_verified ROWS", which made gaps mode useless:
// every vendor cleared 10 rows, so it always answered "No vendors below the
// evidence threshold" — while the category pages simultaneously showed those
// same vendors as "limited evidence". Row count measures volume; the product
// measures BREADTH ("9/10 domains evidenced"). A vendor with 30 rows in two
// domains is exactly the vendor that needs sourcing, and the old test hid it.
//
// 9 of 13 is deliberately below full coverage: some domains genuinely do not
// apply to some vendors, so demanding 13 would mark everyone a permanent gap.
const COVERED_DOMAIN_THRESHOLD = 9;
// One job kind for all web-evidence modes → simplest dedup + console resume.
const JOB_KIND = "web_evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 202 "started" — the work runs server-side via after(), so it survives the user
// navigating away. The console polls /api/admin/jobs/status?kind=web_evidence.
function started(jobId: string | null, extra: Record<string, unknown>) {
  return Response.json({ ok: true, started: true, kind: JOB_KIND, jobId, ...extra }, { status: 202 });
}
function busy() {
  return Response.json(
    { ok: false, started: false, error: "A web-evidence run is already in progress. Wait for it to finish." },
    { status: 409 },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();
  if (!hasDatabase()) return Response.json({ ok: false, error: "DATABASE_URL not configured" }, { status: 503 });

  let body: { vendorId?: string; all?: boolean; gaps?: boolean; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body is fine */
  }

  try {
    if (body.vendorId) {
      const vendors = await listIntelligenceVendors();
      const v = vendors.find((x) => x.id === body.vendorId || x.slug === body.vendorId);
      if (!v) return Response.json({ ok: false, error: `vendor not found: ${body.vendorId}` }, { status: 404 });
      const sched = await scheduleBackgroundJob({
        kind: JOB_KIND,
        label: `Web-evidence — ${v.name}`,
        run: async (report) => {
          await report({ phase: "sourcing", vendor: v.name, current: 0, total: 1 });
          const result = await runWebEvidenceSourcing(v.id, v.name);
          return { mode: "single", vendor: v.name, ...result };
        },
      });
      return sched.alreadyActive ? busy() : started(sched.jobId, { mode: "single", vendor: v.name });
    }

    if (body.gaps === true) {
      // Source ONLY the vendors with limited/no verified evidence — the ones
      // carrying the "seed / limited evidence" alerts. Optional `limit` caps how
      // many are sourced in one call (least-evidence first) to control cost.
      const [vendors, coverageByVendor] = await Promise.all([
        listIntelligenceVendors(),
        getEvidenceDomainCoverageByVendor(),
      ]);
      // Weakest coverage first, so the thinnest vendors — the ones actually
      // carrying "limited evidence" on the category pages — get sourced first
      // and a `limit` spends the budget where it matters most.
      let gapVendors = vendors
        .map((v) => ({ id: v.id, name: v.name, depth: coverageByVendor.get(v.id) ?? 0 }))
        .filter((v) => v.depth < COVERED_DOMAIN_THRESHOLD)
        .sort((a, b) => a.depth - b.depth);
      const totalGaps = gapVendors.length;
      if (typeof body.limit === "number" && body.limit > 0) gapVendors = gapVendors.slice(0, body.limit);
      if (gapVendors.length === 0) {
        return Response.json({ ok: true, started: false, mode: "gaps", totalGaps: 0, sourced: 0, note: `No vendors below ${COVERED_DOMAIN_THRESHOLD}/13 domains covered — every vendor already has broad evidence.` });
      }
      const targets = gapVendors.map((v) => ({ id: v.id, name: v.name }));
      const sched = await scheduleBackgroundJob({
        kind: JOB_KIND,
        label: `Web-evidence — ${targets.length} gap vendor${targets.length === 1 ? "" : "s"}`,
        run: async (report) => {
          await report({ phase: "gaps", current: 0, total: targets.length });
          const sweep = await runWebEvidenceSweep(targets, {
            onProgress: (done, total, vendor) => report({ phase: "gaps", current: done, total, vendor }),
          });
          return { mode: "gaps", totalGaps, sourced: targets.length, ...sweep };
        },
      });
      return sched.alreadyActive ? busy() : started(sched.jobId, { mode: "gaps", thresholdDomains: COVERED_DOMAIN_THRESHOLD, totalGaps, sourced: targets.length });
    }

    if (body.all === true) {
      const targets = (await listIntelligenceVendors()).map((v) => ({ id: v.id, name: v.name }));
      const sched = await scheduleBackgroundJob({
        kind: JOB_KIND,
        label: `Web-evidence — full roster (${targets.length})`,
        run: async (report) => {
          await report({ phase: "all", current: 0, total: targets.length });
          const sweep = await runWebEvidenceSweep(targets, {
            onProgress: (done, total, vendor) => report({ phase: "all", current: done, total, vendor }),
          });
          return { mode: "sweep", ...sweep };
        },
      });
      return sched.alreadyActive ? busy() : started(sched.jobId, { mode: "sweep", total: targets.length });
    }

    return Response.json(
      { ok: false, error: "Specify { vendorId } (one vendor), { gaps: true, limit? } (limited/no-evidence vendors only), or { all: true } (full sweep)." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[admin/web-evidence] failed", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
