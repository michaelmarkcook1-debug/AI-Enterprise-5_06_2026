import Link from "next/link";
import { projectExposureToDependencyEdges, KIND_LABEL, type DependencyEdge } from "@/lib/graph/dependency-projection";
import { deriveEncroachmentEdges, buildRolesByNodeId, NODE_TO_SLUG } from "@/lib/graph/encroachment";

const MUTED = "text-[#5e6b7e] dark:text-[#a7bacd]";

function tierBadge(confidence: number) {
  const tier = confidence >= 80 ? "high" : confidence >= 45 ? "medium" : "seed";
  const cls =
    tier === "high"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tier === "medium"
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return <span className={`rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${cls}`}>{tier}</span>;
}

// Dependencies tab (Prompt 2) — no per-vendor filtered view existed before
// this; every other consumer of the graph (homepage, /dependencies, Monitor)
// reads the SAME projectExposureToDependencyEdges()/deriveEncroachmentEdges()
// pair and filters differently. This filters to one vendor's own edges, same
// pattern lib/member/monitor.ts already uses for the watchlist's graph alerts.
export default function VendorDependencies({ vendorSlug }: { vendorSlug: string }) {
  const nodeIds = Object.entries(NODE_TO_SLUG)
    .filter(([, slug]) => slug === vendorSlug)
    .map(([nodeId]) => nodeId);

  if (nodeIds.length === 0) {
    return <p className={`text-sm ${MUTED}`}>Not yet mapped in the dependency graph.</p>;
  }
  const nodeSet = new Set(nodeIds);

  const allEdges = projectExposureToDependencyEdges();
  const touching = allEdges.filter((e) => nodeSet.has(e.fromVendorId) || nodeSet.has(e.toVendorId));
  const encroachments = deriveEncroachmentEdges(allEdges, buildRolesByNodeId()).filter(
    (e) => nodeSet.has(e.fromVendorId) || nodeSet.has(e.toVendorId),
  );

  if (touching.length === 0 && encroachments.length === 0) {
    return <p className={`text-sm ${MUTED}`}>No sourced dependency or encroachment edges touch this vendor yet.</p>;
  }

  return (
    <div className="space-y-5">
      {touching.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4c5d75] dark:text-[#a7bacd]">
            Dependency edges ({touching.length})
          </h3>
          <ul className="space-y-2">
            {touching.map((e: DependencyEdge, i) => (
              <li key={i} className="rounded-lg border border-[#e3d9c0] bg-white/60 px-3 py-2 dark:border-[#1d3a57] dark:bg-[#0c2238]/40">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-black/5 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-[#4c5d75] dark:bg-white/10 dark:text-[#a7bacd]">
                    {KIND_LABEL[e.kind]}
                  </span>
                  {tierBadge(e.confidence)}
                </div>
                <p className="text-sm text-[#13294b] dark:text-[#eef3f8]">{e.rationale}</p>
                {e.sourceUrls[0] && (
                  <a href={e.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-sky-700 hover:underline dark:text-sky-400">
                    source
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {encroachments.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4c5d75] dark:text-[#a7bacd]">
            Encroachment signals ({encroachments.length})
          </h3>
          <ul className="space-y-2">
            {encroachments.map((e, i) => (
              <li key={i} className="rounded-lg border border-amber-300/50 bg-amber-50/50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/10">
                <div className="mb-1">{tierBadge(e.confidence)}</div>
                <p className="text-sm text-[#13294b] dark:text-[#eef3f8]">{e.rationale}</p>
                <p className={`mt-1 text-xs ${MUTED}`}>Derived — not a stated fact.</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/dependencies" className="inline-block text-xs font-medium text-sky-700 hover:underline dark:text-sky-400">
        See the full dependency graph →
      </Link>
    </div>
  );
}
