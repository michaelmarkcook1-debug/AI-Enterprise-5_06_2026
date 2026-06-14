import Link from "next/link";
import { EXPOSURE_NODES, EXPOSURE_EDGES } from "@/lib/investing/exposure-map-data";
import { listExposureEditProposals } from "@/lib/services/exposure-edit-audit";
import ExposureEditClient from "./ExposureEditClient";

export const dynamic = "force-dynamic";

export default async function ExposureEditsPage() {
  const proposals = await listExposureEditProposals();
  return (
    <div className="min-h-screen bg-[#f6f1e3] text-[#15263c] dark:bg-[#071827] dark:text-[#eef3f8]">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/admin" className="text-sm text-[#4c5d75] hover:underline">← Admin</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Exposure-map edit proposals</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#3f5068] dark:text-[#a7bacd]">
          Propose adds, updates, or removals to the indirect-exposure graph. Proposals are recorded
          to an append-only JSONL audit log; an approved proposal is folded into{" "}
          <code className="font-mono text-xs">lib/investing/exposure-map-data.ts</code> on a follow-up commit. The
          live map does NOT change automatically — a build-time sanity check has to pass first.
        </p>

        <ExposureEditClient
          nodes={EXPOSURE_NODES.map((n) => ({ id: n.id, label: n.label, side: n.side }))}
          edges={EXPOSURE_EDGES.map((e) => ({
            id: e.id,
            sourceId: e.sourceId,
            targetId: e.targetId,
            relationshipType: e.relationshipType,
            confidence: e.confidence,
            summary: e.summary,
          }))}
          initialProposals={proposals}
        />
      </main>
    </div>
  );
}
