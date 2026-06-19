// Phase 3 — shortlist-aware competitive alerts + re-selection analysis.
// ─────────────────────────────────────────────────────────────────────
// When a vendor NEWLY gains a capability (Phase 1 detection) that overlaps a
// capability held by a vendor on the buyer's shortlist, that new entrant is now
// a competitor to a shortlisted choice (the "Anthropic ships a legal app that
// rivals shortlisted Harvey" case). We surface the overlap AND re-run the
// assessment engine head-to-head in the buyer's ORIGINAL assessment context so
// they can see whether the new entrant would change their selection.

import {
  listNewVendorCapabilities,
  listVendorCapabilities,
  listIntelligenceVendors,
} from "../intelligence/repository";
import { getAssessmentInput } from "./assessment-service";
import { listVendorProfiles } from "../repositories/vendor-profiles";
import { runAssessment } from "../engine";
import type { AssessmentInput, Vendor } from "../types";

const OVERLAP_MIN_MATURITY = 50; // a shortlisted vendor must hold the capability meaningfully

export interface ReselectionComparison {
  incumbent: { id: string; name: string; finalScore: number; recommendationBand: string };
  challenger: { id: string; name: string; finalScore: number; recommendationBand: string };
  /** challenger − incumbent (positive = challenger now scores higher). */
  delta: number;
  verdict: string;
}

export interface ShortlistCompetitiveAlert {
  shortlistedId: string;
  shortlistedName: string;
  challengerId: string;
  challengerName: string;
  capabilityId: string;
  capabilityName: string;
  capabilityFamily: string;
  challengerMaturity: number;
  /** Head-to-head re-score in the buyer's original context (null if no run / not scorable). */
  comparison: ReselectionComparison | null;
}

const norm = (id: string) => id.replace(/^vendor_/, "");

function buildComparison(
  input: AssessmentInput,
  incumbentId: string,
  challengerId: string,
  vendors: Vendor[],
): ReselectionComparison | null {
  // Resolve each id to the exact form present in the engine's vendor universe.
  const resolve = (id: string): string | undefined => {
    for (const cand of [id, `vendor_${norm(id)}`, norm(id)]) {
      if (vendors.some((v) => v.id === cand)) return cand;
    }
    return undefined;
  };
  const inc = resolve(incumbentId);
  const chal = resolve(challengerId);
  if (!inc || !chal) return null;

  const result = runAssessment({ ...input, vendorIds: [inc, chal] }, vendors);
  const incR = result.ranking.find((r) => r.vendorId === inc);
  const chalR = result.ranking.find((r) => r.vendorId === chal);
  if (!incR || !chalR) return null;

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const delta = r1(chalR.finalScore - incR.finalScore);
  const verdict =
    delta > 2
      ? `${chalR.vendorName} now scores higher than ${incR.vendorName} in your assessment context — worth re-evaluating your shortlist.`
      : delta < -2
        ? `${incR.vendorName} still leads ${chalR.vendorName} in your context — your shortlist holds.`
        : `${chalR.vendorName} is now within ${Math.abs(delta)} pts of ${incR.vendorName} — a credible alternative to track.`;

  return {
    incumbent: { id: inc, name: incR.vendorName, finalScore: r1(incR.finalScore), recommendationBand: incR.recommendationBand },
    challenger: { id: chal, name: chalR.vendorName, finalScore: r1(chalR.finalScore), recommendationBand: chalR.recommendationBand },
    delta,
    verdict,
  };
}

/**
 * Competitive alerts for the given shortlist: new-capability entrants that now
 * overlap a shortlisted vendor, each with a re-selection head-to-head computed
 * in the buyer's original assessment context.
 */
export async function getShortlistCompetitiveAlerts(
  shortlistIds: string[],
  opts: { days?: number; limit?: number } = {},
): Promise<ShortlistCompetitiveAlert[]> {
  if (shortlistIds.length === 0) return [];
  const limit = opts.limit ?? 10;

  const [newCaps, vendorCaps, intelVendors, engineVendors, input] = await Promise.all([
    listNewVendorCapabilities({ days: opts.days ?? 90, limit: 50 }),
    listVendorCapabilities(),
    listIntelligenceVendors(), // display names / capability source
    listVendorProfiles(), // the ASSESSMENT engine's vendor universe (lib/types.Vendor)
    getAssessmentInput(), // full original buyer context (latest completed run)
  ]);
  if (newCaps.length === 0) return [];

  const venById = new Map(intelVendors.map((v) => [v.id, v]));
  const nameOf = (id: string) =>
    venById.get(id)?.name ?? venById.get(`vendor_${norm(id)}`)?.name ?? venById.get(norm(id))?.name ?? id;

  // Capabilities each SHORTLISTED vendor meaningfully holds.
  const shortlistSet = new Set(shortlistIds.map(norm));
  const heldByVendor = new Map<string, Set<string>>();
  for (const vc of vendorCaps) {
    const v = norm(vc.vendorId);
    if (!shortlistSet.has(v)) continue;
    if (vc.maturityScore < OVERLAP_MIN_MATURITY) continue;
    (heldByVendor.get(v) ?? heldByVendor.set(v, new Set()).get(v)!).add(vc.capabilityId);
  }
  if (heldByVendor.size === 0) return [];

  const alerts: ShortlistCompetitiveAlert[] = [];
  const seen = new Set<string>();
  for (const nc of newCaps) {
    const challenger = norm(nc.vendorId);
    for (const [sv, caps] of heldByVendor) {
      if (sv === challenger) continue; // a vendor doesn't compete with itself
      if (!caps.has(nc.capabilityId)) continue; // no overlap on this capability
      const key = `${sv}::${challenger}::${nc.capabilityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      alerts.push({
        shortlistedId: sv,
        shortlistedName: nameOf(sv),
        challengerId: challenger,
        challengerName: nc.vendorName,
        capabilityId: nc.capabilityId,
        capabilityName: nc.capabilityName,
        capabilityFamily: nc.capabilityFamily,
        challengerMaturity: nc.maturityScore,
        comparison: input ? buildComparison(input, sv, challenger, engineVendors) : null,
      });
      if (alerts.length >= limit) return alerts;
    }
  }
  return alerts;
}
