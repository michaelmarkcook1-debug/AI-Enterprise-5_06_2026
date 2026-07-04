// Peer segments — the CORRECTED peer model (spec rewrite, 2 Jul 2026).
// ─────────────────────────────────────────────────────────────────────
// Peers = enterprise ADOPTERS of AI, matched to the user by
// vertical × company-size band × region — not vendors, not a fixed
// competitor list. This module is the pure segment vocabulary + cohort
// resolution; the cited benchmark data lives in segment-benchmarks.ts and
// the named exemplars in peer-adoption-data.ts (tagged with their segment).

import type { IndustryTag } from "../use-cases";
import { PEER_COMPANIES } from "./peer-adoption-data";
import type { PeerCompany } from "./types";

/** The 16 C6 verticals with display labels (runtime mirror of IndustryTag —
 *  the type keeps them in sync at compile time via the satisfies check). */
export const VERTICALS = [
  { id: "financial_services", label: "Financial services" },
  { id: "insurance", label: "Insurance" },
  { id: "healthcare", label: "Healthcare" },
  { id: "pharma_life_sciences", label: "Pharma & life sciences" },
  { id: "legal", label: "Legal" },
  { id: "professional_services", label: "Professional services" },
  { id: "technology_software", label: "Technology & software" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "retail_consumer", label: "Retail & consumer" },
  { id: "telecom_media", label: "Telecom & media" },
  { id: "public_sector", label: "Public sector" },
  { id: "education", label: "Education" },
  { id: "energy_utilities", label: "Energy & utilities" },
  { id: "transport_logistics", label: "Transport & logistics" },
  { id: "real_estate", label: "Real estate" },
  { id: "aerospace_defence", label: "Aerospace & defence" },
] as const satisfies readonly { id: IndustryTag; label: string }[];

/** Company-size bands (the spec's example ladder). */
export const SIZE_BANDS = [
  { id: "smb", label: "SMB (< 500 employees)" },
  { id: "mid_market", label: "Mid-market (500–5,000)" },
  { id: "enterprise", label: "Enterprise (5,000–50,000)" },
  { id: "global_enterprise", label: "Global enterprise (50,000+)" },
] as const;
export type SizeBandId = (typeof SIZE_BANDS)[number]["id"];

export const REGIONS = [
  { id: "north_america", label: "North America" },
  { id: "europe", label: "Europe" },
  { id: "asia_pacific", label: "Asia-Pacific" },
  { id: "latam", label: "Latin America" },
  { id: "mea", label: "Middle East & Africa" },
] as const;
export type RegionId = (typeof REGIONS)[number]["id"];

export interface Segment {
  vertical: IndustryTag;
  sizeBand: SizeBandId;
  region: RegionId;
}

/** Canonical key for a segment (dataset keys, storage). */
export function segmentId(s: Segment): string {
  return `${s.vertical}|${s.sizeBand}|${s.region}`;
}

/** Exemplar companies in a segment — named enterprises with PUBLICLY
 *  DISCLOSED, cited AI deployments (peer-adoption-data.ts), matched on the
 *  company's own segment tag. Empty = no exemplars compiled yet (honest gap,
 *  not evidence of absence). */
export function exemplarsForSegment(s: Segment): PeerCompany[] {
  return PEER_COMPANIES.filter(
    (c) =>
      c.segment.vertical === s.vertical &&
      c.segment.sizeBand === s.sizeBand &&
      c.segment.region === s.region,
  );
}

/** The AI platforms the segment's exemplars have DISCLOSED adopting, with
 *  adopter counts — derived (display-only) from the cited exemplar cells.
 *  Disclosed-only by construction; never a market-share estimate. */
export function disclosedPlatformsForSegment(s: Segment): { vendorId: string; adopters: number }[] {
  const counts = new Map<string, number>();
  for (const c of exemplarsForSegment(s)) {
    const sig = c.signals.find((x) => x.kind === "platform_integration");
    if (!sig || sig.status !== "disclosed") continue;
    for (const v of sig.vendorIds ?? []) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([vendorId, adopters]) => ({ vendorId, adopters }))
    .sort((a, b) => b.adopters - a.adopters);
}
