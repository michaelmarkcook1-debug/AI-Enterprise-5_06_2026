// Encroachment context assembly (deterministic; no LLM, no invention).
// ─────────────────────────────────────────────────────────────────────────────
// An encroachment edge on its own says almost nothing: "X relies on Y and also
// operates in Y's layer" is a structural fact with no bearing on whether X is
// actually moving on Y. Owner's definition (2026-07-25):
//
//   "encroachment is an assessed metric that interprets market data, overlayed
//    with contextual reasoning from previous vendor movements and stated
//    signals from the vendors leadership"
//
// So an encroachment claim needs THREE input classes, and this module gathers
// them — each from a real, cited source already held in the app. It NEVER
// invents, infers or back-fills. Where an input class is empty for a pair, it
// says so explicitly (`present: false`) so the review downstream can report the
// gap instead of padding it out.
//
//   1. STRUCTURAL   — the derived edge's own facts (dependency kind, shared
//                     product layer, strength, the dependency's source URLs).
//                     From lib/graph/encroachment.ts + dependency-projection.
//   2. MOVEMENTS    — what each side has actually DONE, from the real news feed
//                     (https-cited only) and the corporate-event detector.
//   3. STATEMENTS   — what each side has actually SAID, as verbatim quotes with
//                     receipts, from the Shield terms corpus (lib/shield/data.ts,
//                     built on "nothing is inferred beyond the quoted document").
//
// Everything here is a fact WITH a source. The LLM layer that consumes it is
// forbidden from adding any fact that did not arrive through this module.

import { EXPOSURE_NODES } from "../investing/exposure-map-data";
import { SHIELD, SHIELD_VERSION } from "../shield/data";
import { detectCorporateEvent } from "../intelligence/corporate-events";
import { NODE_TO_SLUG } from "./encroachment";
import type { DependencyEdge } from "./dependency-projection";

/** A thing a vendor DID, with a citation. Never a characterisation — the
 *  headline and its source, so the reader can check us. */
export interface VendorMovement {
  /** Which side of the pair this movement belongs to. */
  side: "threatener" | "threatened";
  vendorLabel: string;
  headline: string;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /** Set when the corporate-event detector matched an acquisition/investment. */
  eventKind: "acquisition" | "investment" | null;
}

/** A thing a vendor SAID, verbatim, with a receipt. Shield marks are quotes
 *  from the vendor's own published terms — the only statements in this app that
 *  are safe to attribute to a vendor's stated position. */
export interface VendorStatement {
  side: "threatener" | "threatened";
  vendorLabel: string;
  /** Which commitment dimension the quote governs (training/retention/…). */
  dimension: string;
  /** Verbatim from the vendor's own document. */
  quote: string;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface EncroachmentSide {
  nodeId: string;
  label: string;
  slug: string | null;
  roles: string[];
}

export interface EncroachmentFacts {
  threatener: EncroachmentSide;
  threatened: EncroachmentSide;
  structural: {
    /** The UNDERLYING dependency's type (investment/cloud/model_hosting/…).
     *  NOT the edge's own `kind`, which is always "encroachment" by the time
     *  the derivation has run and would tell the reader nothing. */
    relationshipType: string;
    /** Product layers BOTH sides operate in — the overlap that makes this a
     *  competitive adjacency rather than a plain supply relationship. */
    sharedLayers: string[];
    /** 0–100, carried from the derivation (capped: it is an inference). */
    strength: number;
    confidence: number;
    rationale: string;
    /** The underlying DEPENDENCY's sources — not evidence of encroachment. */
    dependencySourceUrls: string[];
    reciprocal: boolean;
  };
  movements: VendorMovement[];
  statements: VendorStatement[];
  /** Which of the three input classes actually fired. The honest per-pair
   *  depth signal: a pair with structure only is a much weaker claim than one
   *  with movements and statements behind it, and the UI must show that. */
  inputsPresent: { structural: boolean; movements: boolean; statements: boolean };
  /** Verified-as-of stamp for the statement corpus. */
  statementsAsOf: string;
}

const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));

function sideOf(nodeId: string, rolesByNodeId: Map<string, string[]>): EncroachmentSide {
  return {
    nodeId,
    label: labelById.get(nodeId) ?? nodeId,
    slug: NODE_TO_SLUG[nodeId] ?? null,
    roles: rolesByNodeId.get(nodeId) ?? [],
  };
}

/** Shield ids are per-surface ("openai-api", "google-gemini-api"), so a vendor
 *  slug matches its shield entries by prefix. Exact-equality would silently
 *  return zero statements for every vendor. */
function shieldEntriesForSlug(slug: string | null) {
  if (!slug) return [];
  return SHIELD.filter((s) => s.slug === slug || s.slug.startsWith(`${slug}-`));
}

const DIMENSION_LABEL: Record<string, string> = {
  training: "training on customer data",
  retention: "data retention",
  indemnity: "IP indemnity",
  residency: "data residency",
};

/** Verbatim published positions for one side. Only marks we actually VERIFIED
 *  (state !== "unverified") and that carry a resolvable receipt — an unverified
 *  mark is a gap in our receipts, not a vendor position, and must not be quoted
 *  as one. */
function statementsFor(side: EncroachmentSide, which: "threatener" | "threatened"): VendorStatement[] {
  const out: VendorStatement[] = [];
  for (const entry of shieldEntriesForSlug(side.slug)) {
    for (const [dimension, mark] of Object.entries(entry.marks)) {
      if (mark.state === "unverified") continue;
      if (!mark.source?.url) continue;
      out.push({
        side: which,
        vendorLabel: entry.vendor,
        dimension: DIMENSION_LABEL[dimension] ?? dimension,
        quote: mark.note,
        sourceName: mark.source.name,
        sourceUrl: mark.source.url,
      });
    }
  }
  return out;
}

const bareId = (id: string) => id.toLowerCase().replace(/^vendor_/, "");

/** Does this news item concern this side? Matches the feed's own tagged vendor
 *  ids first (authoritative), then falls back to a whole-word label match in the
 *  headline. Substring matching alone pulls in "AI21" for "ai", so the label
 *  path is word-boundary anchored. */
function itemConcerns(
  item: { primaryVendorId: string | null; vendors: string[]; title: string },
  side: EncroachmentSide,
): boolean {
  if (side.slug) {
    if (item.primaryVendorId && bareId(item.primaryVendorId) === side.slug) return true;
    if (item.vendors.some((v) => bareId(v) === side.slug)) return true;
  }
  const escaped = side.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(item.title);
}

/**
 * Assemble every real, cited fact we hold about one encroachment pair.
 *
 * Deterministic apart from the news read (which is itself a read of stored,
 * cited items). Returns `null` inputs-present flags rather than filler when a
 * class is empty — absence of evidence is reported, never papered over.
 */
export async function buildEncroachmentFacts(
  edge: DependencyEdge,
  rolesByNodeId: Map<string, string[]>,
  opts: { newsDays?: number; maxMovements?: number } = {},
): Promise<EncroachmentFacts> {
  const threatener = sideOf(edge.fromVendorId, rolesByNodeId);
  const threatened = sideOf(edge.toVendorId, rolesByNodeId);

  // Shared product layers — recomputed here rather than parsed back out of the
  // rationale string, which would break the moment the copy changes.
  const sharedLayers = threatener.roles.filter((r) => threatened.roles.includes(r));

  const statements = [
    ...statementsFor(threatener, "threatener"),
    ...statementsFor(threatened, "threatened"),
  ];

  // Movements: real stored news only. A feed read that throws must not take the
  // whole review down — we degrade to "no movements found", which is honest and
  // visibly distinct from a confident empty.
  const movements: VendorMovement[] = [];
  try {
    // Imported lazily: a static import pulls Prisma/pg into every consumer of
    // this module — including the agent layer and its tests, which only need
    // the pure fact-shaping above and would otherwise block on the DB client
    // at import time.
    const { getBreakingNews } = await import("../intelligence/repository");
    const news = await getBreakingNews({
      days: opts.newsDays ?? 120,
      minImpact: 0,
      limit: 200,
      maxPerVendor: 200,
    });
    for (const item of news.items) {
      // Seed items are illustrative, not reported events — they can never
      // support an assessment of what a vendor has actually done.
      if (item.sourceKind === "seed") continue;
      const side = itemConcerns(item, threatener)
        ? ("threatener" as const)
        : itemConcerns(item, threatened)
          ? ("threatened" as const)
          : null;
      if (!side) continue;
      const url = item.sourceUrl ?? null;
      // https-cited only: an uncited headline cannot be checked, so it cannot
      // be used to support an assessment.
      if (!url || !url.startsWith("https://")) continue;
      const event = detectCorporateEvent(item.title, item.summary ?? undefined);
      movements.push({
        side,
        vendorLabel: side === "threatener" ? threatener.label : threatened.label,
        headline: item.title,
        publishedAt: item.publishedAt ?? null,
        sourceName: item.sourceName ?? null,
        sourceUrl: url,
        eventKind: event?.kind ?? null,
      });
    }
  } catch {
    // Leave movements empty — reported as "none found in our sources".
  }

  // Corporate events first (an acquisition is a louder movement than a mention),
  // then newest first. Capped so one noisy vendor can't crowd out the other.
  movements.sort((a, b) => {
    if (!!a.eventKind !== !!b.eventKind) return a.eventKind ? -1 : 1;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });
  const capped = movements.slice(0, opts.maxMovements ?? 8);

  return {
    threatener,
    threatened,
    structural: {
      relationshipType: edge.relationshipType,
      sharedLayers,
      strength: edge.strength,
      confidence: edge.confidence,
      rationale: edge.rationale,
      dependencySourceUrls: edge.sourceUrls,
      reciprocal: edge.rationale.includes("Reciprocal dependency"),
    },
    movements: capped,
    statements,
    inputsPresent: {
      structural: true, // by construction — the edge exists
      movements: capped.length > 0,
      statements: statements.length > 0,
    },
    statementsAsOf: SHIELD_VERSION,
  };
}

/** How many of the three input classes fired, and whether each actually covers
 *  BOTH sides of the pair.
 *
 *  The both-sides part matters: a pair can score 3/3 while every stated position
 *  we hold belongs to one vendor, which reads as fuller coverage than we have.
 *  The generated prose says so, but a bare "3/3" chip beside it would not — and
 *  under-claiming is the standard here. */
export function evidenceDepth(facts: EncroachmentFacts): {
  count: number;
  label: string;
  /** True when a present class only has evidence for one of the two vendors. */
  oneSided: boolean;
} {
  const count =
    (facts.inputsPresent.structural ? 1 : 0) +
    (facts.inputsPresent.movements ? 1 : 0) +
    (facts.inputsPresent.statements ? 1 : 0);

  const bothSides = (rows: { side: "threatener" | "threatened" }[]) =>
    rows.some((r) => r.side === "threatener") && rows.some((r) => r.side === "threatened");
  const oneSided =
    (facts.inputsPresent.movements && !bothSides(facts.movements)) ||
    (facts.inputsPresent.statements && !bothSides(facts.statements));

  const base =
    count >= 3
      ? "Structure, movements and stated positions"
      : count === 2
        ? facts.inputsPresent.movements
          ? "Structure and recent movements"
          : "Structure and stated positions"
        : "Structural position only";
  return { count, label: oneSided ? `${base} (one side only)` : base, oneSided };
}
