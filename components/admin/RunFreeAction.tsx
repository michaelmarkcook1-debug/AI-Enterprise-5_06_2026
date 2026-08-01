"use client";

// Manual trigger for an action that spends NOTHING.
// ─────────────────────────────────────────────────────────────────────────────
// Deliberately not RunPaidAction with a $0 price. That component's whole job is
// the arm-then-confirm step, and that step exists because money is about to be
// spent. Re-using it here would train the operator to click through a spend
// confirmation on a free action, which is exactly how a confirmation stops
// meaning anything. Free actions run on one press.
//
// No credential: the Server Action attaches ADMIN_API_TOKEN server-side, same
// as the paid buttons. Nothing to paste.

import { useCallback, useState, useTransition } from "react";
import { runInboxPull, type RunResult } from "@/app/admin/costs/actions";

export default function RunFreeAction({ label, note }: { label: string; note: string }) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = useCallback(() => {
    setResult(null);
    startTransition(async () => setResult(await runInboxPull()));
  }, []);

  return (
    <div className="text-[13px]">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded-md border border-black/15 bg-black/[0.03] px-3 py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-white/5"
      >
        {pending ? "Running…" : label}{" "}
        <span className="font-mono tabular-nums">· $0</span>
      </button>
      <p className="mt-1 text-[12px] text-[#15263c]/65 dark:text-[#eef3f8]/60">{note}</p>

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
