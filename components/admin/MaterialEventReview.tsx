"use client";

// Review controls for one flagged material event.
// ─────────────────────────────────────────────────────────────────────────────
// Three verdicts, one press each. No confirmation step: every outcome is
// reversible with Reopen, so an extra click would only add friction to a queue
// whose whole problem was being too slow to get through.
//
// The optional note is for what the article said that the headline did not —
// "raise is reported, not closed", "already covered by the Feb item". It is
// free text and is never parsed into a number.

import { useCallback, useState, useTransition } from "react";
import {
  reviewMaterialEvent,
  undoMaterialEventReview,
  type ReviewResult,
} from "@/app/admin/material-events/actions";

const BTN =
  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function MaterialEventReview({
  newsItemId,
  reviewed,
}: {
  newsItemId: string;
  /** Present when this item already carries a verdict. */
  reviewed?: { verdict: string; note: string | null; reviewedAt: string } | null;
}) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  const send = useCallback(
    (verdict: string) => {
      setResult(null);
      startTransition(async () => setResult(await reviewMaterialEvent(newsItemId, verdict, note)));
    },
    [newsItemId, note],
  );

  const undo = useCallback(() => {
    setResult(null);
    startTransition(async () => setResult(await undoMaterialEventReview(newsItemId)));
  }, [newsItemId]);

  if (reviewed) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#123d2c]/65 dark:text-[#eef3f8]/60">
          Reviewed {new Date(reviewed.reviewedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          {reviewed.note ? ` — ${reviewed.note}` : ""}
        </span>
        <button
          type="button"
          onClick={undo}
          disabled={pending}
          className={`${BTN} border-black/15 dark:border-white/20`}
        >
          {pending ? "…" : "Reopen"}
        </button>
        {result && !result.ok && <span className="text-amber-700 dark:text-amber-300">{result.message}</span>}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => send("confirmed")}
          disabled={pending}
          className={`${BTN} border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300`}
        >
          Deal is real
        </button>
        <button
          type="button"
          onClick={() => send("not_a_deal")}
          disabled={pending}
          className={`${BTN} border-black/15 dark:border-white/20`}
        >
          Not a deal
        </button>
        <button
          type="button"
          onClick={() => send("duplicate")}
          disabled={pending}
          className={`${BTN} border-black/15 dark:border-white/20`}
        >
          Already captured
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional)"
          maxLength={400}
          className="min-w-0 flex-1 rounded-md border border-black/15 bg-white/60 px-2 py-1 text-xs dark:border-white/20 dark:bg-white/5"
        />
      </div>
      {result && !result.ok && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{result.message}</p>
      )}
      <p className="mt-1.5 text-[11px] text-[#123d2c]/55 dark:text-[#eef3f8]/50">
        Recording a verdict changes no score and creates no evidence — it only clears this queue.
      </p>
    </div>
  );
}
