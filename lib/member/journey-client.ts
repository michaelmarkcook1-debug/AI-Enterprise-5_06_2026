// Client-safe journey constants (Prompt 4 — golden-path progress affordance).
// Split out for the same reason view-mode-client.ts is: this must be
// importable from client components without dragging in anything server-only.

export const JOURNEY_COOKIE = "ae_journey_step";
export const JOURNEY_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days — a shopping cycle, not forever

export const JOURNEY_TOTAL_STEPS = 5;

export const JOURNEY_STEP_LABEL: Record<number, string> = {
  1: "Start here",
  2: "Shortlist",
  3: "Vendor verdict",
  4: "Interrogate",
  5: "Decision saved",
};

/** Where the badge's "jump back in" link points for the step reached. Not a
 *  precise resume (we don't track WHICH category/vendor) — an honest, useful
 *  hub for that stage, not a claim of exact-position memory. */
export const JOURNEY_STEP_RESUME_HREF: Record<number, string> = {
  1: "/use-cases",
  2: "/vendors",
  3: "/vendors",
  4: "/vendors",
  5: "/decisions",
};

function readJourneyCookie(): number {
  if (typeof document === "undefined") return 0;
  const match = document.cookie.match(new RegExp(`(?:^|; )${JOURNEY_COOKIE}=(\\d)`));
  const n = match ? Number(match[1]) : 0;
  return Number.isFinite(n) && n >= 0 && n <= JOURNEY_TOTAL_STEPS ? n : 0;
}

/** Bump the journey cookie to at least `step` — never regresses an
 *  already-further-along visitor back to an earlier step. */
export function bumpJourneyStepClient(step: number): number {
  const current = readJourneyCookie();
  const next = Math.max(current, step);
  if (next !== current) {
    document.cookie = `${JOURNEY_COOKIE}=${next}; path=/; max-age=${JOURNEY_MAX_AGE_S}; samesite=lax`;
  }
  return next;
}

export function readJourneyStepClient(): number {
  return readJourneyCookie();
}
