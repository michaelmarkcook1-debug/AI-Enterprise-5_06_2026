import type { Entity } from "./entities";

// Canonical intelligence-spine vendor id for an ENTITIES row.
// ──────────────────────────────────────────────────────────
// Snapshot capture (captureRankingSnapshots) and the reputation tables are keyed
// by the bare INTELLIGENCE_VENDORS id (vendor.id). A handful of ENTITIES carry a
// model/product suffix on their id that the spine does NOT use — so reading score
// or reputation history with entity.id (or even entity.slug, which stays
// hyphenated for fireworks-ai/together-ai) silently misses every row. Resolve to
// the bare id here and use it uniformly for both reads so they match capture.
const ENTITY_TO_INTEL_ID: Record<string, string> = {
  "alibaba-qwen": "alibaba",
  "moonshot-kimi": "moonshot",
  "zhipu-glm": "zai",
  "fireworks-ai": "fireworks",
  "together-ai": "together",
};

export function intelVendorId(entity: Pick<Entity, "id">): string {
  return ENTITY_TO_INTEL_ID[entity.id] ?? entity.id;
}
