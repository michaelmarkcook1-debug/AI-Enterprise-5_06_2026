"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes ONE decision, ownership enforced server-side (lib/member/decisions.ts).
// Used from both the list page (refresh in place) and the detail page
// (redirect back to the list, since the row it was viewing is now gone).
export default function DeleteDecisionButton({
  id,
  name,
  redirectTo,
}: {
  id: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/decisions/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok && res.status !== 404) {
        setBusy(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium text-rose-700 hover:border-rose-400 disabled:opacity-40 dark:border-white/15 dark:text-rose-400"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
