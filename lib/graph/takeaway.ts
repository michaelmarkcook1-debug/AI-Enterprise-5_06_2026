import type { DependencyEdge } from "./dependency-projection";

// Derive a 1-line "so what" for the dependency graph — DETERMINISTICALLY from the
// real edge data, recomputed every render. It surfaces the highest in-degree
// nodes (the providers the most other organisations depend on = the chokepoints).
// No hardcoded claims, no invented numbers — every figure traces to the edges.

export function deriveGraphTakeaway(
  edges: DependencyEdge[],
  label: (id: string) => string,
): string | null {
  const dependsOn = edges.filter((e) => e.direction === "depends_on");
  if (dependsOn.length === 0) return null;

  // In-degree = count of DISTINCT dependents that rely on each provider.
  const dependents = new Map<string, Set<string>>();
  for (const e of dependsOn) {
    if (e.fromVendorId === e.toVendorId) continue;
    const set = dependents.get(e.toVendorId) ?? new Set<string>();
    set.add(e.fromVendorId);
    dependents.set(e.toVendorId, set);
  }

  const ranked = [...dependents.entries()]
    .map(([id, deps]) => ({ id, count: deps.size }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  if (ranked.length === 0) return null;

  const [first, second] = ranked;
  const parts = [`${label(first.id)} (${first.count} dependents)`];
  if (second && second.count > 0) parts.push(`${label(second.id)} (${second.count})`);

  return `Of ${dependsOn.length} dependency links, the most depended-upon nodes are ${parts.join(" and ")} — the chokepoints where the market's pricing power and systemic risk concentrate.`;
}
