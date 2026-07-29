"use client";

// Manual trigger for a paid action.
// ─────────────────────────────────────────────────────────────────────────────
// NO CREDENTIAL. It calls a Server Action, which runs the pipeline in server
// code — nothing to paste, nothing held in localStorage, no header. An earlier
// version made the operator type an admin token into their own back office to
// press their own button; that was friction, not security.
//
// The one guard kept is the confirm step, because the price should be known
// BEFORE the spend, not discovered on the invoice. It states the figure twice:
// on the button, and again in the confirmation.

import { useCallback, useState, useTransition } from "react";
import { runRefresh, type RunResult } from "@/app/admin/costs/actions";

export default function RunPaidAction({
  label,
  full,
  costHint,
  estimatedUsd,
  estimateBasis,
}: {
  label: string;
  /** true = force every step (the web-search-heavy ones). */
  full: boolean;
  costHint: string;
  /** Expected cost of one run. Null = never measured; the button says so
   *  rather than implying it is free or printing an invented figure. */
  estimatedUsd: number | null;
  estimateBasis: string | null;
}) {
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [pending, startTransition] = useTransition();

  const priceTag =
    estimatedUsd === null ? "cost not yet measured" : `~$${estimatedUsd.toFixed(2)}`;

  const run = useCallback(() => {
    setResult(null);
    startTransition(async () => {
      setResult(await runRefresh(full));
      setArmed(false);
    });
  }, [full]);

  return (
    <div className="text-[13px]">
      {!armed ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setArmed(true)}
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run now <span className="font-mono tabular-nums">· {priceTag}</span>
        </button>
      ) : (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="font-medium">
            This spends about <span className="font-mono tabular-nums">{priceTag}</span>. Run {label}?
          </p>
          <p className="mt-1 text-[12px] text-[#15263c]/70 dark:text-[#eef3f8]/65">
            {estimateBasis ?? costHint}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={run}
              className="rounded-md border border-amber-600/50 bg-amber-500/20 px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
            >
              {pending ? "Running…" : "Yes, run it"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setArmed(false)}
              className="rounded-md border border-black/15 px-3 py-1.5 text-[13px] dark:border-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          className={`mt-2 rounded-md border px-3 py-2 text-[12px] leading-5 ${
            result.ok
              ? "border-black/10 bg-black/[0.03] dark:border-white/15 dark:bg-white/5"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
