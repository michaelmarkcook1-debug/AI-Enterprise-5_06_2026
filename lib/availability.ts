// Data availability + the seed-fallback firewall.
// ───────────────────────────────────────────────────────────────────────────
// HARD RULE (non-negotiable): a DEPLOYED build (production OR preview) must
// NEVER render seed / mock / placeholder / fabricated data to a user. When the
// live, source-backed data isn't available, surfaces show an honest
// "live data unavailable / insufficient evidence" state instead.
//
// Seed/mock modules still exist — they are LOCAL-DEV + unit-test fixtures only.
// `seedFallbackAllowed()` is the single chokepoint that decides whether any seed
// value may be returned, and it is structurally false on every Vercel deploy.

/** Thrown by data readers when the live source is unavailable in a deployed
 *  build (instead of silently substituting seed). Pages catch this and render
 *  an explicit "live data unavailable" state via `isDataUnavailable()`. */
export class DataUnavailableError extends Error {
  /** Optional surface hint for the rendered message (e.g. "rankings"). */
  readonly surface?: string;
  constructor(message: string, surface?: string) {
    super(message);
    this.name = "DataUnavailableError";
    this.surface = surface;
  }
}

/** True when `error` is a DataUnavailableError (name-checked so it survives
 *  serialization / cross-realm boundaries). */
export function isDataUnavailable(error: unknown): error is DataUnavailableError {
  return error instanceof Error && error.name === "DataUnavailableError";
}

/**
 * The ONE place that decides whether seed/mock data may be served.
 *
 * - Any Vercel deployment (`VERCEL` is set on prod AND preview builds) → NEVER.
 * - NODE_ENV=production (belt-and-suspenders for non-Vercel prod) → NEVER.
 * - NODE_ENV=test → allowed (the unit suite runs against fixtures by design).
 * - Plain local dev → allowed only with an explicit `ALLOW_SEED_FALLBACK=1`
 *   opt-in, so even `next dev` doesn't quietly dress seed as real by default.
 *
 * This makes "using seed data" impossible in any deployed build — and a single
 * grep-able predicate the CI guard test pins down.
 */
export function seedFallbackAllowed(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NODE_ENV === "test") return true;
  return process.env.ALLOW_SEED_FALLBACK === "1";
}

/**
 * Surfaces still rendered from HARDCODED data (the dependency/exposure graph,
 * the ENTITIES vendor-profile scores, the /models inventory) — NOT the live DB.
 *
 * These must NOT ride the provenance "live" flip. Once real market-share rows
 * exist, `isLiveData()` becomes true and the evidence-backed surfaces (composite
 * rankings, news) correctly light up — but these hardcoded surfaces would then
 * show hardcoded data AS live, breaking the no-fabrication promise. So they gate
 * on this flag and stay an honest "unavailable" state until each is wired to real
 * DB data. Flip when that wiring lands. See [[no-seed-strict-live-db-only]].
 */
export const HARDCODED_SURFACES_WIRED: boolean = false;

/**
 * Assessment "paid depth" gate (Phase 3 Wave 2+). The interactive trust-layer
 * pieces — adjustable domain weights / live re-rank, show-the-working, why-this/
 * why-not — are the eventual paid surface. This flag is the gate, SCAFFOLDED but
 * NOT ENFORCED (Wave-1 posture): currently open so the depth is visible, with the
 * soft-paywall hooking here later. When false, surfaces fall back to the Wave-1
 * read-only evidence scorecard (no weight controls). The base scorecard + its
 * data stay deterministic and seed-free regardless of this flag.
 */
export const INTERACTIVE_ASSESSMENT_ENABLED: boolean = true;

/**
 * Member sign-in (passwordless magic-link identity) master switch.
 * DISABLED for now (owner request, 2026-07-04) — a plain boolean literal (NOT
 * an env read) so it inlines correctly in client bundles too. When false, the
 * sign-in surface is removed end-to-end and no NEW sessions can be minted:
 *   • /signin page 404s; the (member) area redirects to "/";
 *   • POST /api/auth/request and GET /api/auth/callback are turned off;
 *   • the "Sign in" nav link and every member-feature entry point that would
 *     otherwise dead-end at /signin (Ask AI chat, TrackButton, the Interrogate
 *     / prep-kit upsells) are hidden.
 * Existing valid session cookies are NOT force-revoked — flipping this back to
 * true restores the full flow with one line + a redeploy. The member data
 * model, tables, and firewall are untouched.
 */
export const MEMBER_AUTH_ENABLED: boolean = false;

/**
 * TEST-OPEN mode (owner request, 2026-07-04) — open ALL member-gated features
 * for testing WITHOUT requiring sign-in. Plain boolean literal (client-safe).
 * When true, an unauthenticated visitor is transparently treated as a shared
 * "test member" (a real, auto-provisioned Subscriber row, so the watchlist FK
 * holds), so the per-tab Ask AI chat, watchlist Track, Interrogate and prep-kit
 * all render and function. Sign-in itself stays disabled (no /signin, no login
 * link) — this is purely a testing bypass.
 *
 * SPEND GUARD: because this opens the LLM endpoints (chat / interrogate /
 * prep-kit) to unauthenticated callers on prod, those routes carry a per-IP
 * rate limit (see each route). Still, this is a TEST posture — before a real
 * launch set MEMBER_TEST_OPEN=false and turn MEMBER_AUTH_ENABLED back on so the
 * features are members-only again. The shared test watchlist is intentionally
 * common across anonymous testers.
 */
export const MEMBER_TEST_OPEN: boolean = true;

/** Member-feature UI visibility: shown when real auth is on OR test-open is on.
 *  Client-safe (both operands are plain literals). The "Sign in" nav link is
 *  gated on MEMBER_AUTH_ENABLED alone — test-open does NOT resurrect sign-in. */
export const MEMBER_FEATURES_VISIBLE: boolean = MEMBER_AUTH_ENABLED || MEMBER_TEST_OPEN;

/**
 * Interrogate (Phase 3 Wave 3) gate — the PREMIUM, member-only LLM action:
 * a buyer feeds real context ("ServiceNow renewal in 3 months, EU-only") and the
 * assessment re-runs through that lens. Unlike the free manual re-weighting
 * (INTERACTIVE_ASSESSMENT_ENABLED), this spends an LLM call, so it is gated
 * separately: member route group, server-guarded, metered (C16) but — like the
 * rest of Phase 2/3 — SCAFFOLDED, NOT ENFORCED. Currently open so the depth is
 * visible; the soft-paywall / credit meter hooks here later. Turning this off
 * leaves the free sliders (INTERACTIVE_ASSESSMENT_ENABLED) untouched.
 *
 * FIREWALL: the re-run only adjusts the viewing buyer's domain WEIGHTS (a personal
 * lens) + cites/explains. It can NEVER write a canonical 0–5 score — see the
 * score-writer firewall test, which pins lib/agents/composite-lens.ts and
 * lib/assessment/session-lens.ts read-only.
 */
export const INTERROGATE_ENABLED: boolean = true;

/**
 * Vendor-meeting prep kit (Phase 3 Wave 4, C9) gate — the second premium,
 * member-only LLM action: generate a take-into-the-meeting kit (8–12 tailored
 * questions grounded in the vendor's real weak/thin domains + framework-derived
 * RFP / POC / reference / readiness templates). Like Interrogate it is gated,
 * SCAFFOLDED but NOT ENFORCED. The LLM writes questions/structure only — it never
 * invents evidence, scores, or vendor facts; the score-writer firewall test pins
 * lib/agents/prep-kit.ts and lib/assessment/prep-kit.ts read-only.
 */
export const PREP_KIT_ENABLED: boolean = true;

/**
 * Per-tab grounded chat (AnalystGenius batch, piece 3) gate — the third premium
 * LLM action: an "Ask AI" assistant on each surface, grounded EXCLUSIVELY in
 * that tab's cited evidence snapshot (built server-side from canonical reads).
 * Like Interrogate/prep-kit: SCAFFOLDED, member-gated, credit-metered but NOT
 * enforced while BILLING_ENABLED is off — open during test per the batch spec.
 * FIREWALL: answers cite only snapshot URLs (fabricated citations dropped by
 * the parser), a question beyond the evidence returns an honest "no evidence"
 * — and the route writes nothing canonical, ever.
 */
export const TAB_CHAT_ENABLED: boolean = true;

/**
 * Developer-sentiment AS A RANKING VARIABLE (dev-sentiment spec, consumer #2).
 * OFF by default and deliberately so: the dev-sentiment SIGNAL is compiled,
 * cited, and surfaced today (Developer-sentiment panel on coding-vendor
 * profiles), but BLENDING it into the coding-model composite is a significant,
 * public-methodology change gated on three locks from the spec:
 *   1. the weight is set by category rationale + DOCUMENTED in the public
 *      methodology, NEVER tuned to move a specific vendor (zero pay-to-play);
 *   2. it is coverage/confidence-gated — a thin model is discounted and reads
 *      "insufficient", never scored on noise;
 *   3. scope: coding / developer-agent categories ONLY.
 * Plus Mic sign-off + legal OK on any Reddit data (not used yet). Until this is
 * true the composite is UNCHANGED — the signal is a distinct labelled panel,
 * not folded into a score. Flip to true only after the weight is signed off.
 */
export const DEV_SENTIMENT_IN_RANKING: boolean = false;

/**
 * Investor-tools gate — PARKED per the Chris change-list CUT/PARK ("Investor
 * tools — already parked by you; keep parked. Not part of the buyer's job.").
 * Default OFF: the daily-refresh investor step (SEC financials, valuations,
 * weekly Opus IPO forecasts + Sonnet analyst coverage) is skipped entirely, so
 * parked scope burns zero LLM spend. Flip via INVESTOR_TOOLS_ENABLED=1 only if
 * the investor surface is deliberately revived (an owner decision).
 */
export const INVESTOR_TOOLS_ENABLED: boolean = process.env.INVESTOR_TOOLS_ENABLED === "1";

/**
 * C16 pricing scaffold — SHOW the tier ladder / pricing page + upgrade UI.
 * Default OFF: the /pricing page, nav entry, and any upgrade CTAs stay hidden
 * until the owner deliberately reveals the pricing surface. This is the
 * "shelves are being stocked" switch — turning it on shows the plans but does
 * NOT by itself charge or enforce anything (see BILLING_ENABLED). Flip via
 * PRICING_ENABLED=1. See remaining-roadmap/C16_Pricing-Scaffold.md.
 */
export const PRICING_ENABLED: boolean = process.env.PRICING_ENABLED === "1";

/**
 * C16 pricing scaffold — ENFORCE entitlements + meter credits (the money switch).
 * Default OFF and OWNER-OWNED: while off, entitlement checks are permissive and
 * the credit meter records nothing, so the app behaves exactly as it does today
 * (the two premium LLM actions stay open, gated only by INTERROGATE_ENABLED /
 * PREP_KIT_ENABLED). Turning this on makes the tier matrix + hard credit caps
 * bite. It NEVER captures a card or charges on its own — real payment capture is
 * a separate, deliberate switch-on the owner performs (terms, tax, refunds,
 * payment processor). Flip via BILLING_ENABLED=1 only when billing is truly live.
 */
export const BILLING_ENABLED: boolean = process.env.BILLING_ENABLED === "1";
