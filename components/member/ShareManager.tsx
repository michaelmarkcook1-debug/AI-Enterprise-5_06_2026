"use client";

// Owner-side share management for one decision: list existing links, create a
// new one, revoke. The raw share URL is shown ONCE, right after creation —
// only its hash is ever persisted server-side, so it can't be shown again
// after this response. Losing it means revoking and creating a new share.

import { useEffect, useState } from "react";

interface ShareView {
  id: string;
  displayName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  viewCount: number;
  status: "active" | "expired" | "revoked";
  createdAt: string;
}

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: ShareView["status"]): string {
  if (status === "active") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "expired") return "bg-black/5 text-[#5e6b7e] dark:bg-white/5 dark:text-[#a7bacd]";
  return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
}

export default function ShareManager({ decisionId }: { decisionId: string }) {
  const [shares, setShares] = useState<ShareView[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/member/decisions/${decisionId}/shares`, { credentials: "same-origin" });
      if (!res.ok) return;
      const json = await res.json();
      setShares(json.shares ?? []);
    } catch {
      // leave shares as-is
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId]);

  async function create() {
    setCreating(true);
    setError("");
    setNewLink(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/member/decisions/${decisionId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ displayName: displayName.trim() || undefined, expiresInDays }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json.error as string | undefined) ?? `Error ${res.status}`);
        return;
      }
      setNewLink(json.share.url as string);
      setDisplayName("");
      await load();
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(shareId: string) {
    if (!window.confirm("Revoke this link? Anyone using it will immediately see a not-found page.")) return;
    try {
      await fetch(`/api/member/decisions/${decisionId}/shares/${shareId}`, { method: "DELETE", credentials: "same-origin" });
      await load();
    } catch {
      // leave list as-is; user can retry
    }
  }

  async function copyLink() {
    if (!newLink) return;
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
    } catch {
      // clipboard API may be unavailable — link is still selectable/visible
    }
  }

  return (
    <section className={CARD}>
      <h2 className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">Share (read-only)</h2>
      <p className={`mt-1 text-xs ${MUTED}`}>
        Anyone with the link can view this decision&apos;s weighting, shortlist, and evidence — no account, no edit
        access. They can never reach your other decisions.
      </p>

      {newLink && (
        <div className="mt-3 rounded-lg border border-[#d4af37]/50 bg-[#fbf6e4]/50 p-3 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/30">
          <p className="text-xs font-semibold text-[#5e6b7e] dark:text-[#a7bacd]">
            Copy this now — it won&apos;t be shown again.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={newLink}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full min-w-0 rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs text-[#123d2c] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-full bg-[#b08d2f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#987625] dark:bg-[#d4af37] dark:text-[#1a1605]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className={MUTED}>Label (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. procurement team"
            maxLength={80}
            className="w-44 rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs dark:border-[#2a4a6b] dark:bg-[#0d1f17]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className={MUTED}>Expires</span>
          <select
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className="rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs dark:border-[#2a4a6b] dark:bg-[#0d1f17]"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="rounded-full bg-[#b08d2f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#987625] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#1a1605]"
        >
          {creating ? "…" : "Create link"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {shares && shares.length > 0 && (
        <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
          {shares.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className="text-xs font-medium">{s.displayName || "Unnamed link"}</span>
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${statusClass(s.status)}`}>
                  {s.status}
                </span>
                <p className={`mt-0.5 text-xs ${MUTED}`}>
                  Expires {fmtDate(s.expiresAt)} · {s.viewCount} view{s.viewCount === 1 ? "" : "s"} · created {fmtDate(s.createdAt)}
                </p>
              </div>
              {s.status === "active" && (
                <button
                  type="button"
                  onClick={() => revoke(s.id)}
                  className="shrink-0 rounded-full border border-black/15 px-2.5 py-1 text-xs font-medium text-rose-700 hover:border-rose-400 dark:border-white/15 dark:text-rose-400"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
