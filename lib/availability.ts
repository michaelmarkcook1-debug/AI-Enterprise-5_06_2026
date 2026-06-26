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
