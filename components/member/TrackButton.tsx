"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MEMBER_FEATURES_VISIBLE } from "@/lib/availability";

// In-context "Track" CTA — a small client island (NOT a page-wide provider, no
// poller). One memoized fetch per page load learns sign-in + tracked state so the
// host page stays SSR/ISR-cached. Signed-out → routes to /signin with the intended
// item + return path; signed-in → optimistic inline toggle against the watchlist.

interface WatchlistState {
  signedIn: boolean;
  tracked: Set<string>;
}

// Module-level memoized fetch — shared by every TrackButton on the page, so a
// rankings table with N rows makes ONE request, not N.
let statePromise: Promise<WatchlistState> | null = null;
function loadState(): Promise<WatchlistState> {
  if (!statePromise) {
    statePromise = fetch("/api/member/watchlist", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) return { signedIn: false, tracked: new Set<string>() };
        const d = await r.json();
        const w = (d?.watchlist ?? {}) as { vendors?: string[]; categories?: string[] };
        return {
          signedIn: true,
          tracked: new Set<string>([
            ...(w.vendors ?? []).map((v) => `vendor:${v}`),
            ...(w.categories ?? []).map((c) => `category:${c}`),
          ]),
        };
      })
      .catch(() => ({ signedIn: false, tracked: new Set<string>() }));
  }
  return statePromise;
}

export default function TrackButton({
  item,
  label,
  className = "",
}: {
  item: string;
  label?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadState().then((s) => {
      if (cancelled) return;
      setSignedIn(s.signedIn);
      setTracked(s.tracked.has(item));
    });
    // Post-sign-in confirmation: we were redirected back with ?tracked=<item>.
    try {
      const got = new URLSearchParams(window.location.search).get("tracked");
      if (got && got === item) {
        setTracked(true);
        setJustAdded(true);
        const t = setTimeout(() => setJustAdded(false), 4000);
        return () => { cancelled = true; clearTimeout(t); };
      }
    } catch {
      /* ignore */
    }
    return () => { cancelled = true; };
  }, [item]);

  // Tracking requires a member session; with sign-in disabled there's no path to
  // one, so hide the CTA rather than bounce to a dead /signin. (After all hooks.)
  if (!MEMBER_FEATURES_VISIBLE) return null;

  async function onClick() {
    setError(false);
    if (!signedIn) {
      const params = new URLSearchParams({ track: item, returnTo: pathname || "/" });
      window.location.href = `/signin?${params.toString()}`;
      return;
    }
    if (busy) return;
    const next = !tracked;
    setTracked(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/member/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, action: next ? "add" : "remove" }),
      });
      if (!res.ok) throw new Error("save_failed");
      // Keep the shared cache in sync for other buttons on the page.
      loadState().then((s) => (next ? s.tracked.add(item) : s.tracked.delete(item)));
    } catch {
      setTracked(!next); // revert
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60";
  const tone = tracked
    ? "border-[#b08d2f] bg-[#b08d2f] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0b2519]"
    : "border-black/15 text-[#123d2c] hover:border-[#b08d2f]/60 dark:border-white/20 dark:text-[#eef3f8]";
  const text = busy ? "…" : tracked ? "Tracking ✓" : "+ Track";

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={tracked}
        title={error ? "Couldn't save — try again" : label ? `Track ${label}` : "Add to your watchlist"}
        className={`${base} ${tone} ${className}`}
      >
        {text}
      </button>
      {justAdded && (
        <span className="text-xs text-emerald-700 dark:text-emerald-300">
          Added to your watchlist
        </span>
      )}
      {error && (
        <span className="text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t save</span>
      )}
    </span>
  );
}
