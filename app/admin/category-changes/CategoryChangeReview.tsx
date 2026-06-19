"use client";

import { useState } from "react";
import type { CategoryChangeProposal } from "@/lib/services/category-change";

// Admin review for auto-detected vendor category / role-tag changes. Approving
// applies the change to the vendor (moves it in rankings/quadrant); rejecting
// records the decision and leaves the vendor unchanged. Human-in-the-loop only.
export default function CategoryChangeReview({ initial }: { initial: CategoryChangeProposal[] }) {
  const [proposals, setProposals] = useState<CategoryChangeProposal[]>(initial);
  const [token, setToken] = useState("");
  const [reviewerId, setReviewerId] = useState("admin@local");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/category-changes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ action, reviewerId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="text-xs text-[#4c5d75]">
          <div className="mb-1 font-medium">Reviewer</div>
          <input
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            className="rounded border border-[#d8cba6] bg-white px-2 py-1 text-sm dark:border-[#1d3a57] dark:bg-[#0c2238]"
          />
        </label>
        <label className="text-xs text-[#4c5d75]">
          <div className="mb-1 font-medium">x-admin-token (if not in dev mode)</div>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            className="rounded border border-[#d8cba6] bg-white px-2 py-1 text-sm dark:border-[#1d3a57] dark:bg-[#0c2238]"
          />
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#d8cba6] p-6 text-center text-sm text-[#6b7d93] dark:border-[#1d3a57] dark:text-[#7a9bb8]">
          No pending category / role change proposals. They appear here when ingested evidence shows a vendor
          gaining a capability that implies a role it doesn&apos;t currently hold.
        </div>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const added = p.proposedRoleTags.filter((r) => !p.currentRoleTags.includes(r));
            return (
              <li
                key={p.id}
                className="rounded-lg border border-[#e6dcc3] bg-white p-4 dark:border-[#1d3a57] dark:bg-[#0c2238]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{p.vendorName}</div>
                    <div className="mt-1 text-sm text-[#33455e] dark:text-[#c2d1e0]">
                      Roles: <span className="text-[#6b7d93]">{p.currentRoleTags.join(", ") || "—"}</span>{" "}
                      → <strong>{p.proposedRoleTags.join(", ")}</strong>
                      {added.length > 0 && (
                        <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          +{added.join(", ")}
                        </span>
                      )}
                    </div>
                    {p.proposedCategory && p.proposedCategory !== p.currentCategory && (
                      <div className="mt-0.5 text-sm text-[#33455e] dark:text-[#c2d1e0]">
                        Category: <span className="text-[#6b7d93]">{p.currentCategory}</span> →{" "}
                        <strong>{p.proposedCategory}</strong>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy === p.id}
                      onClick={() => act(p.id, "approve")}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy === p.id ? "…" : "Approve"}
                    </button>
                    <button
                      disabled={busy === p.id}
                      onClick={() => act(p.id, "reject")}
                      className="rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{p.rationale}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#8a98a8]">
                  <span>
                    Trigger: {p.triggerCapabilityId ?? "—"}
                    {p.triggerMaturity != null ? ` @ ${Math.round(p.triggerMaturity)}` : ""}
                  </span>
                  {p.sourceUrls.slice(0, 3).map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="underline">
                      source {i + 1}
                    </a>
                  ))}
                  <span className="ml-auto tabular-nums">{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
