// Shortlist scorecard — the four-axis per-vendor read for the monitor tab.
// ─────────────────────────────────────────────────────────────────────────────
// Aggregates FOUR signals that already exist per vendor into one compact card:
//   • Risk        — model_reliability + security_threat + capital_resilience
//                   framework domains (worst-of, so the card leads with the
//                   disqualifier a watch-list reader cares about).
//   • Privacy     — the Trust Rank / Shield marks (verbatim quote + receipt)
//                   where in scope, else the data_security_privacy domain.
//   • Encroachment— the derived directional edges, with the FLAGSHIP twist:
//                   an overlap with ANOTHER vendor in the same shortlist reads
//                   "competes with your X" (the signal no analyst house sells).
//   • Positioning — the market_position capability band where cited, else
//                   honest insufficient (model-provider category standing is a
//                   planned follow-up, not faked here).
//
// NON-NEGOTIABLE HONESTY (per the project brief): nothing here manufactures a
// value. Every axis maps ONLY what its source already asserts; absence → the
// distinct `insufficient` state, never an optimistic default. The Shield stays a
// curated cited reference — this module READS it, and never lets it into any
// composite. Encroachment stays labelled "derived, not a stated fact". The pure
// `buildVendorCard` is unit-tested; the async wrapper only fetches + delegates.

import { getVendorScorecardsBatch, type VendorScorecard } from "../assessment/domain-scores";
import type { DomainScore } from "../assessment/domain-rubric";
import type { DomainId } from "../types";
import { shieldCoverage, type VendorShield, type Mark } from "../shield/data";
import { shieldForVendorId } from "../shield/vendor-map";
import { intelVendorId } from "../intelligence/vendor-id";
import type { Entity } from "../intelligence/entities";
import { encroachmentForVendors, type VendorEncroachment } from "../graph/encroachment-by-vendor";

/** The 4th state sits OFF the good→watch ramp — a missing signal is never scored. */
export type AxisState = "clear" | "caution" | "watch" | "insufficient";

export interface AxisCitation {
  url: string;
  label?: string;
}

export interface AxisRead {
  state: AxisState;
  /** One answer-first phrase (the expander sub-line). */
  summary: string;
  /** Honest denominator where the axis has one (e.g. "3 of 4 marks verified"). */
  coverageNote?: string;
  citations: AxisCitation[];
  /** Where the signal is explicitly an inference, not a stated fact. */
  derived?: boolean;
}

export interface ShortlistVendorCard {
  vendorId: string; // entity.id — the key the decision/watchlist stores use
  slug: string;
  name: string;
  role: string; // primaryRole label, e.g. "Model Provider"
  risk: AxisRead;
  privacy: AxisRead;
  encroachment: AxisRead;
  positioning: AxisRead;
  /** The single sharpest current signal, answer-first. `derived` when it comes from
   *  the encroachment inference, so the UI can label it even in the collapsed view. */
  headline: { text: string; derived: boolean } | null;
  /** Honest coverage: how many of the four axes have any evidence. */
  coverage: { evidenced: number; total: 4 };
}

const RISK_DOMAINS: DomainId[] = ["model_reliability", "security_threat", "capital_resilience"] as DomainId[];
const PRIVACY_DOMAIN = "data_security_privacy" as DomainId;

const SEVERITY: Record<Exclude<AxisState, "insufficient">, number> = { watch: 3, caution: 2, clear: 1 };

/** Map one framework domain to an axis state. Higher score = better = clear;
 *  a low-confidence read can never claim "clear" (under-claim), but a genuinely
 *  low score stays "watch" regardless of confidence. */
function domainState(d: DomainScore | undefined): AxisState {
  if (!d || d.state !== "scored") return "insufficient";
  const base: AxisState = d.score >= 3.5 ? "clear" : d.score >= 2.0 ? "caution" : "watch";
  if (base === "clear" && d.lowConfidence) return "caution";
  return base;
}

/** Worst state across present domains; insufficient only when ALL are absent. */
function worstOf(states: AxisState[]): AxisState {
  const scored = states.filter((s): s is Exclude<AxisState, "insufficient"> => s !== "insufficient");
  if (scored.length === 0) return "insufficient";
  return scored.sort((a, b) => SEVERITY[b] - SEVERITY[a])[0];
}

function domainCitations(d: DomainScore | undefined): AxisCitation[] {
  if (!d || d.state !== "scored") return [];
  return d.citations.slice(0, 3).map((c) => ({ url: c.sourceUrl, label: c.evidenceGrade }));
}

function riskAxis(byDomain: Map<DomainId, DomainScore>): AxisRead {
  const present = RISK_DOMAINS.map((id) => byDomain.get(id)).filter((d): d is DomainScore => !!d);
  const state = worstOf(present.map(domainState));
  if (state === "insufficient") {
    return { state, summary: "No verified reliability, security or resilience evidence yet.", citations: [] };
  }
  const scoredCount = present.filter((d) => d.state === "scored").length;
  const label =
    state === "clear"
      ? "Reliability, security and resilience read clear on the evidence."
      : state === "caution"
        ? "Mixed — at least one of reliability, security or resilience needs a look."
        : "A reliability, security or resilience signal is a concern.";
  return {
    state,
    summary: label,
    coverageNote: `${scoredCount} of ${RISK_DOMAINS.length} risk domains evidenced`,
    citations: present.flatMap(domainCitations).slice(0, 4),
  };
}

const MARK_KEYS: (keyof VendorShield["marks"])[] = ["training", "retention", "indemnity", "residency"];
const MARK_LABEL: Record<string, string> = {
  training: "training", retention: "retention", indemnity: "indemnity", residency: "residency",
};

function privacyAxis(shield: VendorShield | null, privacyDomain: DomainScore | undefined): AxisRead {
  if (shield) {
    const marks = MARK_KEYS.map((k) => shield.marks[k]);
    const coverage = shieldCoverage(shield); // count of non-"unverified"
    const adverse = MARK_KEYS.filter((k) => shield.marks[k].state === "adverse");
    const protective = marks.filter((m) => m.state === "protective").length;
    // coverage 0 = no verified marks → insufficient (off the ramp), never a
    // caution that implies we looked and found it middling. Defensive today (every
    // ledger row carries ≥2 verified marks), correct if that ever changes.
    const state: AxisState =
      coverage === 0
        ? "insufficient"
        : adverse.length > 0
          ? "watch"
          : coverage >= 3 && protective >= 3
            ? "clear"
            : "caution";
    const summary =
      coverage === 0
        ? "No verified Trust Rank marks for this vendor yet."
        : adverse.length > 0
          ? `Adverse on ${adverse.map((k) => MARK_LABEL[k]).join(", ")} — read the clause.`
          : state === "clear"
            ? "Protective on training, retention, indemnity and residency."
            : "Some data-governance marks are conditional or unverified.";
    const citations: AxisCitation[] = marks
      .map((m: Mark) => m.source)
      .filter((s): s is { name: string; url: string } => !!s)
      .slice(0, 4)
      .map((s) => ({ url: s.url, label: s.name }));
    return { state, summary, coverageNote: `${coverage} of 4 marks verified`, citations };
  }
  // Out of Shield scope (GSIs, infra, most non-model vendors) → the framework
  // privacy domain, if evidenced; else honest insufficient.
  const state = domainState(privacyDomain);
  return {
    state,
    summary:
      state === "insufficient"
        ? "Not covered by the Trust Rank, and no verified privacy evidence yet."
        : "Data-security & privacy read from the assessment framework.",
    citations: domainCitations(privacyDomain),
  };
}

function encroachmentAxis(
  enc: VendorEncroachment,
  shortlistSlugs: Set<string>,
  nameBySlug: Map<string, string>,
): AxisRead {
  if (!enc.mapped) {
    return { state: "insufficient", summary: "Not tracked in the dependency graph.", citations: [], derived: true };
  }
  const inList = (r: { vendorSlug: string }) => shortlistSlugs.has(r.vendorSlug) && nameBySlug.has(r.vendorSlug);
  const rivalsOn = enc.encroachesOn.filter(inList);
  const rivalsBy = enc.encroachedBy.filter(inList);
  const cites = (arr: { sourceUrls: string[] }[]): AxisCitation[] =>
    arr.flatMap((r) => r.sourceUrls).filter(Boolean).slice(0, 3).map((url) => ({ url }));

  if (rivalsOn.length > 0 || rivalsBy.length > 0) {
    const names = [
      ...rivalsOn.map((r) => nameBySlug.get(r.vendorSlug)!),
      ...rivalsBy.map((r) => nameBySlug.get(r.vendorSlug)!),
    ];
    const uniq = [...new Set(names)];
    return {
      state: "watch",
      summary: `Overlaps ${uniq.join(", ")} — also in your shortlist.`,
      citations: cites([...rivalsOn, ...rivalsBy]),
      derived: true,
    };
  }
  if (enc.encroachesOn.length > 0 || enc.encroachedBy.length > 0) {
    return {
      state: "caution",
      summary: "Moving across the stack — encroachment edges present, none in your shortlist.",
      citations: cites([...enc.encroachesOn, ...enc.encroachedBy]),
      derived: true,
    };
  }
  return { state: "clear", summary: "In its layer — no encroachment edges.", citations: [], derived: true };
}

function positioningAxis(marketPosition: DomainScore | null): AxisRead {
  const state = domainState(marketPosition ?? undefined);
  if (state === "insufficient") {
    return {
      state,
      summary: "No cited market-position band for this vendor yet.",
      citations: [],
    };
  }
  const label =
    state === "clear"
      ? "Strong cited market position."
      : state === "caution"
        ? "Mid-pack on the cited market-position bands."
        : "Trailing on the cited market-position bands.";
  return { state, summary: label, citations: domainCitations(marketPosition ?? undefined) };
}

/** Answer-first: the single sharpest current signal. A cross-shortlist
 *  encroachment beats a lone watch, which beats a caution; else null. */
function headlineFor(
  card: Pick<ShortlistVendorCard, "risk" | "privacy" | "encroachment" | "positioning">,
): { text: string; derived: boolean } | null {
  if (card.encroachment.state === "watch") {
    return { text: card.encroachment.summary, derived: !!card.encroachment.derived };
  }
  const watch = ([["Risk", card.risk], ["Privacy", card.privacy], ["Positioning", card.positioning]] as [string, AxisRead][])
    .find(([, a]) => a.state === "watch");
  if (watch) return { text: `${watch[0]} — ${watch[1].summary}`, derived: !!watch[1].derived };
  const caution = [card.risk, card.privacy, card.encroachment, card.positioning].find((a) => a.state === "caution");
  if (caution) return { text: caution.summary, derived: !!caution.derived };
  return null;
}

export interface VendorCardInput {
  entity: Pick<Entity, "id" | "slug" | "name" | "primaryRole">;
  scorecard: VendorScorecard;
  shield: VendorShield | null;
  encroachment: VendorEncroachment;
  /** All slugs across the whole monitor (for the cross-shortlist overlap). */
  shortlistSlugs: Set<string>;
  nameBySlug: Map<string, string>;
}

/** PURE: assemble one vendor's four-axis card. Deterministic + unit-tested. */
export function buildVendorCard(input: VendorCardInput): ShortlistVendorCard {
  const byDomain = new Map<DomainId, DomainScore>(
    input.scorecard.domains.map((d): [DomainId, DomainScore] => [d.domain, d]),
  );
  const risk = riskAxis(byDomain);
  const privacy = privacyAxis(input.shield, byDomain.get(PRIVACY_DOMAIN));
  const encroachment = encroachmentAxis(input.encroachment, input.shortlistSlugs, input.nameBySlug);
  const positioning = positioningAxis(input.scorecard.marketPosition);
  const axes = { risk, privacy, encroachment, positioning };
  const evidenced = [risk, privacy, encroachment, positioning].filter((a) => a.state !== "insufficient").length;
  return {
    vendorId: input.entity.id,
    slug: input.entity.slug,
    name: input.entity.name,
    role: input.entity.primaryRole,
    ...axes,
    headline: headlineFor(axes),
    coverage: { evidenced, total: 4 },
  };
}

/**
 * Async: fetch the four signals for a set of entities and build every card.
 * Batches the scorecard read (one grouped query), derives encroachment once,
 * and reads the in-memory Shield per vendor. Mirrors the vendor-profile id
 * discipline exactly: scorecard on entity.id, Shield on intelVendorId(entity).
 */
export async function shortlistScorecards(
  entities: Pick<Entity, "id" | "slug" | "name" | "primaryRole">[],
  now: Date = new Date(),
): Promise<Map<string, ShortlistVendorCard>> {
  const out = new Map<string, ShortlistVendorCard>();
  if (entities.length === 0) return out;

  const scorecards = await getVendorScorecardsBatch(entities.map((e) => e.id), now);
  const encroachments = encroachmentForVendors(entities.map((e) => e.slug));
  const shortlistSlugs = new Set(entities.map((e) => e.slug));
  const nameBySlug = new Map(entities.map((e) => [e.slug, e.name]));

  for (const entity of entities) {
    const scorecard = scorecards.get(entity.id);
    if (!scorecard) continue; // batch always fills every id, but be defensive
    const shield = shieldForVendorId(intelVendorId(entity));
    const encroachment = encroachments.get(entity.slug) ?? { encroachesOn: [], encroachedBy: [], mapped: false };
    out.set(entity.id, buildVendorCard({ entity, scorecard, shield, encroachment, shortlistSlugs, nameBySlug }));
  }
  return out;
}
