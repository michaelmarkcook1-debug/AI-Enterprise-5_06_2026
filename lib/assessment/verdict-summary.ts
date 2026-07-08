// Verdict-card "why" summary (Prompt 2 — vendor page restructure).
// ─────────────────────────────────────────────────────────────────────────
// Pure derivation over the SAME computeWeightedComposite() output every other
// surface already reads — no new scoring, no new data path. Picks the domains
// that moved the composite most (by default-weight contribution), split into
// what's carrying the score vs. what's holding it back, so the verdict card
// can say "strong on X, Y — thin on Z" instead of just a number.

import { ASSESSMENT_DOMAINS, type DomainScore } from "./domain-rubric";
import { DOMAIN_LABEL } from "./domain-labels";
import { computeWeightedComposite, DEFAULT_DOMAIN_WEIGHTS, type DomainContribution } from "./composite";

export interface VerdictDomainNote {
  domain: DomainContribution["domain"];
  label: string;
  score: number;
}

export interface VerdictSummary {
  composite: number;
  coverage: number;
  confidence: number;
  /** Top-scoring domains actually contributing weight — the "why" positives. */
  strengths: VerdictDomainNote[];
  /** Lowest-scoring SCORED domains (never insufficient-evidence ones — those
   *  are a coverage gap, not a weakness, and get their own honest label). */
  weaknesses: VerdictDomainNote[];
}

const STRENGTH_THRESHOLD = 3.5;
const WEAKNESS_THRESHOLD = 2.5;
const MAX_PER_SIDE = 2;

/** Deterministic, framework-default view (matches WeightedScorecard's initial
 *  slider state) — the verdict card shows the stable global read, not
 *  whatever a visitor happens to have dragged the sliders to. */
export function summariseVerdict(domains: DomainScore[]): VerdictSummary {
  const result = computeWeightedComposite(domains, DEFAULT_DOMAIN_WEIGHTS);
  const byDomain = new Map(domains.map((d) => [d.domain, d]));

  const scored = ASSESSMENT_DOMAINS
    .map((domain) => {
      const d = byDomain.get(domain);
      if (!d || d.state !== "scored") return null;
      return { domain, label: DOMAIN_LABEL[domain], score: d.score };
    })
    .filter((x): x is VerdictDomainNote => x !== null);

  const strengths = [...scored]
    .filter((x) => x.score >= STRENGTH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PER_SIDE);

  const weaknesses = [...scored]
    .filter((x) => x.score <= WEAKNESS_THRESHOLD)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_PER_SIDE);

  return { composite: result.composite, coverage: result.rawCoverage, confidence: result.confidence, strengths, weaknesses };
}

/** The numbers the verdict card HEADLINE shows. When the vendor holds a live
 *  in-category standing, the headline MUST be that category composite — the
 *  identical assessmentComposite every other surface (compare / category /
 *  vendor-list / homepage) already renders — so the headline number and the
 *  "#N of M in <category>" rank beside it can never disagree, and two vendors
 *  can never read a different winner on their profiles than on the category
 *  page. Only when a vendor is evidenced but ranked in NO live category (no
 *  category composite exists) does it fall back to the global 12-domain summary
 *  — there is no category number to contradict there. This is the single rule
 *  the parity test locks; the VerdictCard is a dumb renderer of whatever it's
 *  handed, so the basis decision has to live in one tested place. */
export interface VerdictHeadline {
  composite: number | null;
  confidence: number | null;
  coverage: number | null;
  /** Which basis produced the numbers above — for the card's provenance label. */
  basis: "category" | "global" | "none";
}

/** Category standing shape the headline needs — a structural subset of
 *  CategoryRankedVendor, so this stays decoupled from lib/ranking and unit-
 *  testable with plain fixtures. */
export interface HeadlineStanding {
  assessmentComposite: number | null;
  compositeConfidence: number | null;
  domainCoverage: number;
}

export function verdictHeadline(
  categoryStanding: HeadlineStanding | null,
  fallback: VerdictSummary | null,
): VerdictHeadline {
  // Category basis wins whenever a real in-category composite exists — this is
  // the canonical, cross-surface-consistent number.
  if (categoryStanding && categoryStanding.assessmentComposite != null) {
    return {
      composite: categoryStanding.assessmentComposite,
      confidence: categoryStanding.compositeConfidence,
      coverage: categoryStanding.domainCoverage,
      basis: "category",
    };
  }
  // No live category ranking → the global 12-domain read is the only basis, and
  // there is no category winner for it to contradict.
  if (fallback) {
    return { composite: fallback.composite, confidence: fallback.confidence, coverage: fallback.coverage, basis: "global" };
  }
  return { composite: null, confidence: null, coverage: null, basis: "none" };
}

/** One sentence for the verdict card. Honest when there's nothing decisive
 *  either way — never forces a strength/weakness that isn't real. */
export function verdictWhySentence(summary: VerdictSummary): string {
  const { strengths, weaknesses } = summary;
  if (strengths.length === 0 && weaknesses.length === 0) {
    return "No domain scores clearly above or below the pack yet — see the full breakdown.";
  }
  const parts: string[] = [];
  if (strengths.length > 0) parts.push(`Strong on ${strengths.map((s) => s.label).join(", ")}`);
  if (weaknesses.length > 0) parts.push(`thinner on ${weaknesses.map((w) => w.label).join(", ")}`);
  return parts.join(" — ") + ".";
}
