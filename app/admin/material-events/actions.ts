"use server";

// Server Actions for the material-event review buttons.
// ─────────────────────────────────────────────────────────────────────────────
// No credential in the browser: the page is already reachable without one (see
// lib/intelligence/material-event-review.ts on why the stored fact is "reviewed
// in the back office", not "analyst-verified").
//
// revalidatePath is what makes the row move between the open and reviewed lists
// on the next render — the page is force-dynamic, so without it the action
// would succeed while the list appeared unchanged, which reads as a broken
// button.

import { revalidatePath } from "next/cache";
import {
  recordMaterialEventReview,
  clearMaterialEventReview,
  isVerdict,
} from "@/lib/intelligence/material-event-review";

const PATH = "/admin/material-events";

export interface ReviewResult {
  ok: boolean;
  message?: string;
}

export async function reviewMaterialEvent(
  newsItemId: string,
  verdict: string,
  note?: string,
): Promise<ReviewResult> {
  if (!newsItemId) return { ok: false, message: "Missing item id." };
  // Validate here rather than trusting the caller: a Server Action is a public
  // HTTP endpoint, so the button's own props are not a constraint on the input.
  if (!isVerdict(verdict)) return { ok: false, message: `Unknown verdict "${verdict}".` };

  const ok = await recordMaterialEventReview(newsItemId, verdict, note);
  if (!ok) return { ok: false, message: "Could not save — the review was not recorded." };
  revalidatePath(PATH);
  return { ok: true };
}

export async function undoMaterialEventReview(newsItemId: string): Promise<ReviewResult> {
  if (!newsItemId) return { ok: false, message: "Missing item id." };
  const ok = await clearMaterialEventReview(newsItemId);
  if (!ok) return { ok: false, message: "Could not reopen — nothing changed." };
  revalidatePath(PATH);
  return { ok: true };
}
