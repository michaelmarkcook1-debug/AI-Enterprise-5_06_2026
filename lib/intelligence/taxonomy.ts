// C13 — Taxonomy: the standard stack + cross-cutting lenses/tags.
// ─────────────────────────────────────────────────────────────────────────────
// Fixes the category error where "Investors" and "Sovereign AI" were ranked as
// peer vendor layers (capital is a different axis; a sovereign is a jurisdiction,
// not a product tier). Here the 12 legacy entity ROLES collapse onto:
//   • 5 RANKABLE LAYERS — the standard stack: hardware → infra → platform → model
//     → application (a vendor can sit in several; its ONE canonical score is shown
//     in each — never recomputed per layer, so multi-membership can't inflate).
//   • TAGS — cross-cutting attributes that don't rank on their own (vertical,
//     open-source).
//   • LENSES — cross-cutting views that are NOT vendor rankings (investor,
//     sovereign, regulator). An entity whose ONLY roles are lenses (a pure
//     investor like Sequoia) is NOT a rankable vendor — it drops out of the
//     rankings and lives in the dependency graph, exactly as before.
//
// Pure, deterministic, data-only. No scores computed here — it only regroups.

import type { Role } from "./entities";

// ── The standard stack (rankable layers), in stack order ─────────────────────
export const STANDARD_LAYERS = ["hardware", "infra", "platform", "model", "application"] as const;
export type StandardLayer = (typeof STANDARD_LAYERS)[number];

export const LAYER_LABEL: Record<StandardLayer, string> = {
  hardware: "Hardware",
  infra: "Infrastructure / Compute",
  platform: "Platform",
  model: "Model",
  application: "Application",
};

export const LAYER_NOTE: Record<StandardLayer, string> = {
  hardware: "Accelerators, networking, custom silicon and the fabrication behind AI compute.",
  infra: "Hosting, cloud capacity, deployment and the data/compute services AI runs on.",
  platform: "Distribution, cloud control planes and enterprise-governance depth.",
  model: "Frontier and enterprise models — quality, cadence and deployment paths.",
  application: "Workflow conversion, domain fit and business-user adoption.",
};

// ── Cross-cutting TAGS (attributes, not a rankable layer) ─────────────────────
export const TAGS = ["vertical", "open_source"] as const;
export type Tag = (typeof TAGS)[number];
export const TAG_LABEL: Record<Tag, string> = {
  vertical: "Vertical specialist",
  open_source: "Open-source ecosystem",
};

// ── Cross-cutting LENSES (a different axis; NOT a vendor ranking) ─────────────
export const LENSES = ["investor", "sovereign", "regulator"] as const;
export type Lens = (typeof LENSES)[number];
export const LENS_LABEL: Record<Lens, string> = {
  investor: "Investor",
  sovereign: "Sovereign / Regional",
  regulator: "Regulator / Policy",
};
export const LENS_NOTE: Record<Lens, string> = {
  investor: "Strategic capital, distribution rights and ecosystem influence — a capital axis, not a product tier.",
  sovereign: "Jurisdiction, data-residency and industrial-policy alternatives — a geography axis, not a product tier.",
  regulator: "Rule-setters and policy actors — context for the market, not vendors within it.",
};

// ── The legacy-role → taxonomy mapping (the heart of C13) ─────────────────────
// NOTE (sanity-check on preview): "Data & Services Provider" → infra and
// "Regulator / Policy Actor" → regulator lens are the two judgement calls here.
const ROLE_TO_LAYER: Partial<Record<Role, StandardLayer>> = {
  "Hardware Provider": "hardware",
  "Infrastructure Player": "infra",
  "Cloud / Hosting Provider": "infra",
  "Data & Services Provider": "infra",
  "Platform Vendor": "platform",
  "Model Provider": "model",
  "Application Vendor": "application",
};
const ROLE_TO_TAG: Partial<Record<Role, Tag>> = {
  "Vertical Specialist": "vertical",
  "Open-Source Ecosystem": "open_source",
};
const ROLE_TO_LENS: Partial<Record<Role, Lens>> = {
  "Investor": "investor",
  "Sovereign / Regional AI": "sovereign",
  "Regulator / Policy Actor": "regulator",
};

export function roleToLayer(role: Role): StandardLayer | null {
  return ROLE_TO_LAYER[role] ?? null;
}
export function roleToTag(role: Role): Tag | null {
  return ROLE_TO_TAG[role] ?? null;
}
export function roleToLens(role: Role): Lens | null {
  return ROLE_TO_LENS[role] ?? null;
}

/** A role that maps to a standard layer is a real vendor role (rankable). */
export function isRankableRole(role: Role): boolean {
  return ROLE_TO_LAYER[role] !== undefined;
}

// ── Entity-level helpers (take the roles; no import cycle with entities.ts) ────

/** The standard layers an entity belongs to, deduped, in canonical stack order. */
export function layersForRoles(roles: readonly Role[]): StandardLayer[] {
  const set = new Set<StandardLayer>();
  for (const r of roles) {
    const l = roleToLayer(r);
    if (l) set.add(l);
  }
  return STANDARD_LAYERS.filter((l) => set.has(l));
}

export function tagsForRoles(roles: readonly Role[]): Tag[] {
  const set = new Set<Tag>();
  for (const r of roles) {
    const t = roleToTag(r);
    if (t) set.add(t);
  }
  return TAGS.filter((t) => set.has(t));
}

export function lensesForRoles(roles: readonly Role[]): Lens[] {
  const set = new Set<Lens>();
  for (const r of roles) {
    const l = roleToLens(r);
    if (l) set.add(l);
  }
  return LENSES.filter((l) => set.has(l));
}

/** True when the entity has at least one rankable (standard-layer) role — i.e.
 *  it is a VENDOR. A pure investor / sovereign / regulator returns false and is
 *  excluded from every vendor ranking (it stays in the dependency graph). */
export function isRankableVendor(roles: readonly Role[]): boolean {
  return roles.some((r) => isRankableRole(r));
}

/** The layer to rank an entity WITHIN — its primary role's layer, else its first
 *  rankable layer in stack order. null ⇒ not a vendor (don't rank it). */
export function primaryLayerForRoles(primaryRole: Role, secondaryRoles: readonly Role[]): StandardLayer | null {
  return roleToLayer(primaryRole) ?? layersForRoles([primaryRole, ...secondaryRoles])[0] ?? null;
}
