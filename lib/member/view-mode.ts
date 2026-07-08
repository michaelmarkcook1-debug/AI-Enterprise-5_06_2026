// Home view-mode resolution (Prompt 3 — nav shell + home toggle).
// ─────────────────────────────────────────────────────────────────────────
// "/" renders either the visitor market feed or the buyer dashboard from the
// SAME URL, per the locked IA decision. Two independent things decide which:
//   1. Is a buyer view even POSSIBLE right now? Only true for a real signed-in
//      member, or (test/preview only) when memberTestOpenEffective() is true.
//   2. If possible without a real session, has THIS visitor explicitly chosen
//      it via the toggle? Test-open being on does NOT silently switch anyone
//      into buyer view — the cookie is opt-in, flipped only by pressing the
//      toggle, so a cold visit always lands on the public market feed.
// The toggle cookie carries no access of its own — memberTestOpenEffective()
// being false (real production) makes buyer view unreachable regardless of
// the cookie's value, satisfying "never render on production as if real."
//
// SERVER-ONLY (imports getMember -> Prisma). Client components must import
// VIEW_MODE_COOKIE / HomeViewMode from view-mode-client.ts instead, never
// from here — see that file's header comment for why.

import { cookies } from "next/headers";
import { getMember } from "./auth";
import { memberTestOpenEffective } from "../availability";
import { VIEW_MODE_COOKIE, type HomeViewMode } from "./view-mode-client";

export { VIEW_MODE_COOKIE } from "./view-mode-client";
export type { HomeViewMode } from "./view-mode-client";

/** Which view "/" should render right now. */
export async function resolveHomeViewMode(): Promise<HomeViewMode> {
  const real = await getMember();
  if (real) return "buyer";
  if (!memberTestOpenEffective()) return "visitor";
  const jar = await cookies();
  return jar.get(VIEW_MODE_COOKIE)?.value === "buyer" ? "buyer" : "visitor";
}

