"use client";

// "Save this weighting as a decision" — captures the LIVE slider values +
// currently-ranked shortlist for one category into a named, reopenable
// MemberDecision. A private lens only: this POSTs to /api/member/decisions,
// which never touches a score/ranking table (lib/member/decisions.ts) — saving
// cannot change the published composite for anyone, including the saver.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DomainId } from "@/lib/types";
import { bumpJourneyStepClient } from "@/lib/member/journey-client";

type State = "idle" | "naming" | "saving" | "saved" | "error";

export default function SaveDecisionButton({
  category,
  weights,
  shortlist,
  asOfDate,
}: {
  category: string;
  weights: Record<DomainId, number>;
  shortlist: string[]; // vendor ids, currently ranked
  asOfDate: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return;
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/member/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          category,
          weights,
          shortlist: shortlist.map((vendorId) => ({ vendorId })),
          asOfDate,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setError(
          res.status === 401 ? "Sign in to save a decision." : (json.error as string | undefined) ?? `Error ${res.status}`,
        );
        return;
      }
      setState("saved");
      setName("");
      bumpJourneyStepClient(5); // golden path step 5 — decision saved
      // Brief visual confirmation, then land on the decision itself — the
      // fix for the golden-path gap this closes: saving used to just show
      // "Saved" and dead-end, no way to reach prep kit / export / share.
      const decisionId = (json.decision as { id?: string } | undefined)?.id;
      if (decisionId) {
        setTimeout(() => router.push(`/decisions/${decisionId}`), 700);
      } else {
        setTimeout(() => setState("idle"), 2500);
      }
    } catch {
      setState("error");
      setError("Network error — check your connection.");
    }
  }

  if (state === "saved") {
    return <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Saved — opening your decision…</span>;
  }

  if (state === "naming" || state === "saving") {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setState("idle");
          }}
          placeholder="Name this decision…"
          maxLength={120}
          disabled={state === "saving"}
          className="w-44 rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs text-[#13294b] placeholder:text-[#9aa7b8] focus:border-[#b08d2f] focus:outline-none dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
        />
        <button
          type="button"
          onClick={save}
          disabled={state === "saving" || !name.trim()}
          className="rounded-full bg-[#b08d2f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#987625] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#1a1605]"
        >
          {state === "saving" ? "…" : "Save"}
        </button>
        <button type="button" onClick={() => setState("idle")} className="text-xs text-[#7a8aa0] hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setState("naming")}
        className="rounded-full border border-[#d6c9a8] px-3 py-1 text-xs font-medium text-[#4c5d75] hover:bg-white dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
      >
        Save this weighting as a decision
      </button>
      {state === "error" && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  );
}
