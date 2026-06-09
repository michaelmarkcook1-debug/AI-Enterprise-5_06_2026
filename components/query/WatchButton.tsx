"use client";

import { useEffect, useRef, useState } from "react";

interface Watchlist {
  id: string;
  vendors: string[];
  email: string | null;
  alertRules: { rankChangeThreshold: number; scoreChangeThreshold: number };
}

interface WatchButtonProps {
  vendorId: string;
  vendorName: string;
}

export default function WatchButton({ vendorId, vendorName }: WatchButtonProps) {
  const [watched, setWatched] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch current watchlist state on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d: { watchlist: Watchlist | null }) => {
        if (cancelled) return;
        const wl = d.watchlist;
        setWatched(wl?.vendors?.includes(vendorId) ?? false);
        setEmail(wl?.email ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vendorId]);

  // Focus the email input when prompt appears
  useEffect(() => {
    if (showEmailPrompt) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showEmailPrompt]);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (saving || loading) return;

    const nextWatched = !watched;
    setWatched(nextWatched); // optimistic

    try {
      setSaving(true);
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextWatched ? "watch" : "unwatch",
          vendorId,
        }),
      });

      if (!res.ok) {
        setWatched(!nextWatched); // revert on error
        return;
      }

      const d = await res.json() as { watchlist: Watchlist | null };
      const wl = d.watchlist;

      if (wl) {
        const nowWatched = wl.vendors.includes(vendorId);
        setWatched(nowWatched);
        setEmail(wl.email ?? null);
        // Show email prompt if this is the first watch action and no email is set
        if (nowWatched && !wl.email) {
          setShowEmailPrompt(true);
        }
      }
    } catch {
      setWatched(!nextWatched); // revert on network error
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!emailInput.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setEmailSaving(true);
    try {
      const res = await fetch("/api/watchlist/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      if (res.ok) {
        setEmail(emailInput);
        setShowEmailPrompt(false);
      } else {
        setEmailError("Failed to save. Please try again.");
      }
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailSaving(false);
    }
  }

  if (loading) {
    return (
      <button
        type="button"
        disabled
        aria-label={`Loading watchlist state for ${vendorName}`}
        className="rounded-full p-1 text-sm text-zinc-300 opacity-50"
      >
        ☆
      </button>
    );
  }

  return (
    <span className="relative inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        aria-label={watched ? `Remove ${vendorName} from watchlist` : `Add ${vendorName} to watchlist`}
        title={watched ? `Remove ${vendorName} from watchlist` : `Add ${vendorName} to watchlist`}
        className={`rounded-full p-1 text-sm transition-colors ${
          saving ? "opacity-50 cursor-wait" : "cursor-pointer"
        } ${
          watched
            ? "text-amber-500 hover:text-amber-600"
            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        }`}
      >
        {watched ? "★" : "☆"}
      </button>

      {/* Inline email prompt — shown the first time a vendor is watched */}
      {showEmailPrompt && (
        <form
          onSubmit={handleSaveEmail}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-8 z-50 flex flex-col gap-1.5 rounded-lg border border-zinc-700 bg-[#0d1f2d] p-3 shadow-xl"
          style={{ minWidth: "220px" }}
        >
          <span className="text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
            Add email to get alerts →
          </span>
          <input
            ref={inputRef}
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="you@company.com"
            className="rounded border border-zinc-600 bg-[#071827] px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {emailError && (
            <span className="text-[10px] text-rose-400">{emailError}</span>
          )}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={emailSaving}
              className="flex-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {emailSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowEmailPrompt(false); }}
              className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Skip
            </button>
          </div>
        </form>
      )}

      {/* Small indicator if email is already set */}
      {watched && email && !showEmailPrompt && (
        <span className="text-[9px] text-emerald-500 leading-none whitespace-nowrap">alerts on</span>
      )}

      {/* Prompt to add email if watching but no email yet (and prompt dismissed) */}
      {watched && !email && !showEmailPrompt && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowEmailPrompt(true); }}
          className="text-[9px] text-amber-400 hover:text-amber-300 leading-none whitespace-nowrap underline underline-offset-2"
        >
          add email
        </button>
      )}
    </span>
  );
}
