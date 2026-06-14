// Demo source-first mode.
// ────────────────────────
// "Use live data wherever possible. Fill the rest with seed. Do not
// hide modules that are partially seeded." This module reads the EXISTING
// truth/evidence/data-status layer (provenance, ConnectorHealth,
// EvidenceRecord, EvidenceProposal) — it does NOT invent a new parallel
// system. It computes per-module status badges (Live / Mixed / Seed
// fallback) and an overall demo summary.
//
// Mode flag: DEMO_SOURCE_FIRST=1 enables louder status surfacing.
// Default is OFF so production behaviour is unchanged.

export type DemoModuleStatus = "live" | "mixed" | "seed_fallback";

export const DEMO_MODULE_STATUS_LABEL: Record<DemoModuleStatus, string> = {
  live: "Live",
  mixed: "Mixed",
  seed_fallback: "Seed fallback",
};

export interface DemoModuleAssessment {
  /** Module id (stable, used for routing / analytics). */
  id: string;
  /** Display name. */
  label: string;
  /** Route the operator can show in the demo. */
  route: string;
  /** Whether the module is considered safe to demo regardless of status. */
  safeToShow: boolean;
  /** Resolved status. */
  status: DemoModuleStatus;
  /** Numeric breakdown of live vs seed signals — surface in tooltip. */
  liveSignalCount: number;
  seedSignalCount: number;
  /** Why this status was chosen. Plain English. */
  reason: string;
  /** Optional extra notes (e.g. "Investor Tools — IPO timing is modelled, not factual"). */
  caveat?: string;
}

export interface DemoSummary {
  mode: "on" | "off";
  generatedAt: string;
  /** Source: the existing getDataProvenance() result, scrubbed. */
  globalProvenance: "live" | "seed";
  /** Per-module assessments, ordered for demo display. */
  modules: DemoModuleAssessment[];
  /** Module counts by status. */
  counts: Record<DemoModuleStatus, number>;
  /** Connector health summary — id, status, last fetch time. No URLs/keys. */
  connectors: {
    id: string;
    label: string;
    status: string;
    configured: boolean;
    lastFetchOk?: boolean;
    lastFetchAt?: string;
    recordCount?: number;
  }[];
}

export function isDemoSourceFirst(): boolean {
  return process.env.DEMO_SOURCE_FIRST === "1";
}

/** Pure assessor — given live/seed signal counts, decide the status.
 *
 *   liveSignalCount === 0 → seed_fallback
 *   seedSignalCount === 0 AND liveSignalCount > 0 → live
 *   both > 0 → mixed
 *
 * Plus: explicit override via `forceMixed` for cases where a module is
 * structurally mixed (e.g. IPO forecasts are model_estimate_not_fact AND
 * use real provider IDs from seed). */
export function assessModuleStatus(args: {
  liveSignalCount: number;
  seedSignalCount: number;
  forceMixed?: boolean;
  forceSeedFallback?: boolean;
}): DemoModuleStatus {
  if (args.forceSeedFallback) return "seed_fallback";
  if (args.forceMixed) return "mixed";
  if (args.liveSignalCount === 0) return "seed_fallback";
  if (args.seedSignalCount === 0) return "live";
  return "mixed";
}

/** Returns a human-readable reason for the badge. */
export function explainStatus(args: {
  status: DemoModuleStatus;
  liveSignalCount: number;
  seedSignalCount: number;
  moduleLabel: string;
}): string {
  switch (args.status) {
    case "live":
      return `${args.moduleLabel} — ${args.liveSignalCount} live signal${args.liveSignalCount === 1 ? "" : "s"}, no seed fallback in use.`;
    case "mixed":
      return `${args.moduleLabel} — ${args.liveSignalCount} live + ${args.seedSignalCount} seed signal${args.seedSignalCount === 1 ? "" : "s"}. Live data preferred; seed fills gaps.`;
    case "seed_fallback":
      return `${args.moduleLabel} — fully seed-backed. No live evidence in scope yet; labelled accordingly.`;
  }
}

/** Roll module statuses into a count map. */
export function summariseCounts(modules: DemoModuleAssessment[]): Record<DemoModuleStatus, number> {
  const out: Record<DemoModuleStatus, number> = { live: 0, mixed: 0, seed_fallback: 0 };
  for (const m of modules) out[m.status] += 1;
  return out;
}
