"use client";

// AIE-06 — the explicit consent step, shown once a finding completes.
// ─────────────────────────────────────────────────────────────────────────────
// "A clear, explicit consent step. A customer knows their data feeds the pool
// and has agreed to it." Terms are DRAFT — pending legal review (see
// lib/pool/types.ts's DRAFT_TERMS_VERSION) — the UI says so plainly rather than
// presenting placeholder copy as if it were an enforceable agreement.
// Declining is a full no-op for the interrogation engine itself: this prompt
// appears AFTER the finding already rendered, so nothing here can degrade the
// value the CIO already received.

import { useState } from "react";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

type Status = "asking" | "submitting" | "done" | "error";

export default function ContributePrompt({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<Status>("asking");
  const [consented, setConsented] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  async function decide(consent: boolean) {
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/pool/contribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, consent }),
      });
      const data = (await res.json()) as { ok?: boolean; consented?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message || data.error || "Something went wrong.");
        setStatus("error");
        return;
      }
      setConsented(data.consented ?? consent);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className={`mt-3 text-xs ${MUTED}`}>
        {consented
          ? "Thanks — this session now contributes anonymously to the peer pool. Nothing that could identify you or your company was included."
          : "No problem — your finding is unaffected either way."}
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
      <p className="text-xs font-medium">Contribute this session anonymously?</p>
      <p className={`mt-1 text-xs leading-4 ${MUTED}`}>
        Your goal and constraints would be reduced to coarse categories (never your company name or raw
        answers) and added to the shared pool, so future CIOs in a similar position see what peers are
        actually doing. Declining doesn&apos;t affect this finding at all.{" "}
        <span className="italic">Draft terms — pending legal review, not yet a final agreement.</span>
      </p>
      {status === "error" && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => decide(true)}
          disabled={status === "submitting"}
          className="rounded-md bg-[#123d2c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1c5f46] disabled:opacity-50 dark:bg-[#d4af37] dark:text-[#0b2519]"
        >
          {status === "submitting" ? "…" : "Yes, contribute"}
        </button>
        <button
          onClick={() => decide(false)}
          disabled={status === "submitting"}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:border-[#b08d2f] disabled:opacity-50 dark:border-white/15"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
