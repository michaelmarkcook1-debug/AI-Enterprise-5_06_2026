// Reverse cross-link: which peers have DISCLOSED adopting a given AI vendor.
// ───────────────────────────────────────────────────────────────────────────
// The supply↔demand bridge (piece 2): a vendor's assessment page shows the
// enterprises whose platform_integration signal cites that vendor, with the
// same citations. Pure derivation over the curated dataset — display-only,
// no writes, no path into canonical vendor scores (same firewall as
// lib/delivery). "Disclosed" is load-bearing: an absence here means no peer
// in the tracked set has publicly disclosed adoption — never that none uses it.

import { PEER_COMPANIES } from "./peer-adoption-data";
import type { PeerCitation, PeerCompany, PeerSignal } from "./types";

export interface DisclosedAdopter {
  company: Pick<PeerCompany, "id" | "name" | "industry">;
  /** The platform_integration signal that names the vendor (cited). */
  summary?: string;
  status: PeerSignal["status"];
  citations: PeerCitation[];
  /** Set when the fact is real + rubric-computed but citation URLs haven't
   *  been found/verified yet — render an honest "sources being linked" note,
   *  never let an empty citations[] read as silently unsourced. */
  citationStatus?: PeerSignal["citationStatus"];
}

/** Peers whose platform_integration signal cites `vendorId` (bare id, e.g.
 *  "openai"). Deterministic order (dataset order).
 *  STRICTLY status === "disclosed": an inferred signal must never surface
 *  under "publicly disclosed adopters" (fabrication-audit WARN 2) — the panel
 *  copy asserts disclosure, so only disclosure qualifies. */
export function disclosedAdoptersOf(vendorId: string): DisclosedAdopter[] {
  const bare = vendorId.replace(/^vendor_/, "");
  const out: DisclosedAdopter[] = [];
  for (const c of PEER_COMPANIES) {
    const s = c.signals.find((x) => x.kind === "platform_integration");
    if (!s || s.status !== "disclosed") continue;
    if (!(s.vendorIds ?? []).includes(bare)) continue;
    out.push({
      company: { id: c.id, name: c.name, industry: c.industry },
      summary: s.summary,
      status: s.status,
      citations: s.citations ?? [],
      citationStatus: s.citationStatus,
    });
  }
  return out;
}
