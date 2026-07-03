import { EXPOSURE_NODES } from "../investing/exposure-map-data";
import type { DependencyEdge } from "./dependency-projection";

// Two DISTINCT derived signals — deterministic, from the real edges, no invented
// numbers. The distinction matters analytically:
//
//   • CHOKEPOINTS (pricing power / systemic risk) live in the COMPUTE, CLOUD and
//     CAPITAL layers, where a lab DEPENDS ON a provider it can't easily replace
//     (NVIDIA/TSMC silicon, hyperscaler capacity, strategic capital). We measure
//     this as: how many AI labs depend on each provider in those layers.
//
//   • UBIQUITY (switching exposure) is raw model in-degree — how many players are
//     tied to a given model. High here does NOT mean pricing power: open-weight
//     providers (Meta/Llama, Mistral) are integrated widely precisely because
//     they're FREE. Labelling that as "pricing power" is backwards — so we report
//     it separately and explicitly as ubiquity, not leverage.

// Leverage layers where dependency = real, hard-to-substitute leverage.
const LEVERAGE_KINDS = new Set<DependencyEdge["kind"]>(["compute", "infra", "capital"]);

export interface GraphTakeaway {
  /** Infrastructure/capital chokepoints — where pricing power & systemic risk sit. */
  chokepoints: string;
  /** Most widely integrated models — ubiquity / switching exposure, not leverage. */
  ubiquity: string | null;
}

function rank(counts: Map<string, Set<string>>, n: number): { id: string; count: number }[] {
  return [...counts.entries()]
    .map(([id, set]) => ({ id, count: set.size }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, n);
}

const nameList = (items: { id: string; count: number }[], label: (id: string) => string): string =>
  items.map((i) => `${label(i.id)} (${i.count})`).join(", ");

export function deriveGraphTakeaway(
  edges: DependencyEdge[],
  label: (id: string) => string,
): GraphTakeaway | null {
  const dependsOn = edges.filter((e) => e.direction === "depends_on");
  if (dependsOn.length === 0) return null;

  const side = new Map(EXPOSURE_NODES.map((n) => [n.id, n.side] as const));
  const isLab = (id: string) => side.get(id) === "right";

  // Chokepoints: distinct labs (right-side) that depend on each provider across
  // compute/cloud/capital. Since the 2026-07 direction fix the projection emits
  // fromVendorId = DEPENDENT, toVendorId = PROVIDER (it used to be inverted and
  // this module silently compensated) — so a lab depending on TSMC/NVIDIA/AWS is
  // from=lab, to=provider. That dependency is real leverage — the signal.
  const labsByProvider = new Map<string, Set<string>>();
  for (const e of dependsOn) {
    if (!LEVERAGE_KINDS.has(e.kind) || !isLab(e.fromVendorId) || isLab(e.toVendorId)) continue;
    const set = labsByProvider.get(e.toVendorId) ?? new Set<string>();
    set.add(e.fromVendorId);
    labsByProvider.set(e.toVendorId, set);
  }
  const choke = rank(labsByProvider, 3);

  // Ubiquity: how many counterparties depend on each right-side MODEL owner —
  // model-kind edges only (an infra tie between two labs is not model ubiquity).
  const tiesByModel = new Map<string, Set<string>>();
  for (const e of dependsOn) {
    if (e.kind !== "model" || !isLab(e.toVendorId)) continue;
    const set = tiesByModel.get(e.toVendorId) ?? new Set<string>();
    set.add(e.fromVendorId);
    tiesByModel.set(e.toVendorId, set);
  }
  const ubiq = rank(tiesByModel, 2);

  const chokepoints = choke.length
    ? `Pricing power and systemic risk concentrate in the compute, cloud and capital layers — the providers the most AI labs depend on are ${nameList(choke, label)} (count = labs reliant on each).`
    : `No infrastructure-layer concentration is evident in the current data.`;

  const ubiquity = ubiq.length
    ? `Separately, the most widely integrated models are ${nameList(ubiq, label)} (count = counterparties tied to each) — that's ubiquity / switching exposure, not pricing power; open-weight models spread because they're free.`
    : null;

  return { chokepoints, ubiquity };
}
