// C16 — Pricing tier ladder (the single source of truth). SCAFFOLD ONLY.
// ─────────────────────────────────────────────────────────────────────────────
// The subscription plans, their entitlements, and their monthly credit
// allotments. This is pure data + types — it charges nothing and enforces
// nothing on its own. Enforcement is gated behind the BILLING_ENABLED /
// PRICING_ENABLED flags (lib/availability.ts); the owner flips billing on
// deliberately (terms, tax, refunds, payment processor) — see
// remaining-roadmap/C16_Pricing-Scaffold.md.
//
// DIRECTIONAL PRICES: the $ figures below are market-anchored placeholders
// (consumer AI subs converge at ~$20/mo; a ~$100/mo power rung is standard;
// enterprise analyst incumbents run $45–125k/seat/yr). CONFIRM final numbers
// against the live market before switch-on — they are NOT a committed price.
//
// Naming firewall: deliberately distinct from the unrelated `tier` concepts
// already in the codebase — VendorCommercial.tier (a vendor sponsoring its own
// profile), WorkflowTier (assessment depth), PartnershipTier (GSI delivery),
// and the dead PRODUCT_EDITIONS. This ladder is the BUYER's subscription only.

/** The paywalled capabilities. The FREE FUNNEL — news, category rankings, the
 *  dependency graph, the use-case front door — is deliberately NOT represented
 *  here: it is never gated, at any tier, for anyone (incl. signed-out). Only
 *  assessment DEPTH + the two premium LLM actions are entitlements. */
export type Feature =
  | "scorecard_full" // the full 12-domain evidence scorecard (free tier sees a capped preview)
  | "weights_rerank" // adjustable domain weights + live re-rank
  | "citations_inline" // inline evidence citations on the scorecard
  | "interrogate" // W3 premium LLM action (context lens re-run) — credit-metered
  | "prep_kit" // W4 premium LLM action (vendor-meeting prep kit) — credit-metered
  | "watchlist_alerts" // saved-watchlist change alerts
  | "exports"; // scorecard / shortlist export

/** The two premium LLM actions that CONSUME credits. Kept as a subset of
 *  Feature so the meter and the entitlement matrix can't drift apart. */
export type MeteredAction = Extract<Feature, "interrogate" | "prep_kit">;
export const METERED_ACTIONS: readonly MeteredAction[] = ["interrogate", "prep_kit"] as const;

export type PlanId = "free" | "individual" | "pro" | "team" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** One-line positioning shown on the pricing card. */
  tagline: string;
  /** Directional monthly price in USD (annual = ~17% off, applied in the UI).
   *  null = "contact sales" (Enterprise). 0 = Free. */
  priceMonthlyUsd: number | null;
  /** Monthly credit allotment for the metered LLM actions. Infinity is not
   *  used — Enterprise is a high fixed number so the meter stays honest. */
  creditsIncluded: number;
  /** Hard ceiling on credits consumed in a period (allotment + any overage).
   *  Reaching it blocks further metered actions even with overage on. */
  creditsHardCap: number;
  /** Whether paid overage credits are offered once the allotment is spent
   *  (still bounded by creditsHardCap). Billing must be ON to actually charge. */
  overageAvailable: boolean;
  /** The features this plan grants. Free grants none of the paywalled set. */
  features: readonly Feature[];
  /** Card emphasis in the pricing grid. */
  highlighted?: boolean;
  /** "contact sales" instead of a self-serve CTA. */
  contactSales?: boolean;
}

// Individual builds on Free; each higher tier is a superset of the one below.
const INDIVIDUAL_FEATURES: readonly Feature[] = [
  "scorecard_full",
  "weights_rerank",
  "citations_inline",
  "interrogate",
  "prep_kit",
];
const PRO_FEATURES: readonly Feature[] = [...INDIVIDUAL_FEATURES, "watchlist_alerts", "exports"];

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Market Today",
    tagline: "The market read — news, rankings, the dependency graph, use-cases. Always free.",
    priceMonthlyUsd: 0,
    creditsIncluded: 0,
    creditsHardCap: 0,
    overageAvailable: false,
    features: [], // the free funnel is never gated — it needs no entitlement
  },
  {
    id: "individual",
    name: "Individual",
    tagline: "Full assessment depth for one analyst — scorecard, live re-rank, cited working.",
    priceMonthlyUsd: 30,
    creditsIncluded: 40,
    creditsHardCap: 80,
    overageAvailable: false,
    features: INDIVIDUAL_FEATURES,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Higher caps, watchlist alerts, and exports for power users.",
    priceMonthlyUsd: 150,
    creditsIncluded: 200,
    creditsHardCap: 400,
    overageAvailable: true,
    features: PRO_FEATURES,
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    tagline: "Seats and shared watchlists for a buying group.",
    priceMonthlyUsd: 500,
    creditsIncluded: 800,
    creditsHardCap: 1600,
    overageAvailable: true,
    features: PRO_FEATURES,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "SSO, custom coverage, API — independent analysis that undercuts the incumbents.",
    priceMonthlyUsd: null,
    creditsIncluded: 5000,
    creditsHardCap: 10000,
    overageAvailable: true,
    features: PRO_FEATURES,
    contactSales: true,
  },
];

/** Annual billing discount (applied in the pricing UI). ~17% ≈ "2 months free". */
export const ANNUAL_DISCOUNT = 0.17;

const PLAN_BY_ID = new Map<PlanId, Plan>(PLANS.map((p) => [p.id, p]));

/** The default plan for anyone without a subscription row — signed-out OR a
 *  signed-in member the owner hasn't assigned a paid tier. Never a locked state. */
export const FREE_PLAN: Plan = PLAN_BY_ID.get("free")!;

/** Resolve a plan by id, defaulting to Free for unknown/absent ids (honest
 *  under-claim — an unrecognised tier is treated as the free funnel, never
 *  as full access). Pure. */
export function planById(id: string | null | undefined): Plan {
  if (!id) return FREE_PLAN;
  return PLAN_BY_ID.get(id as PlanId) ?? FREE_PLAN;
}

/** Monthly price rendered for annual billing (per-month equivalent, discounted).
 *  Returns null for contact-sales plans. Pure. */
export function annualMonthlyUsd(plan: Plan): number | null {
  if (plan.priceMonthlyUsd == null) return null;
  return Math.round(plan.priceMonthlyUsd * (1 - ANNUAL_DISCOUNT));
}
