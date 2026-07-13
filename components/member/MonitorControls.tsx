"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface MonitorItem {
  item: string; // "vendor:<slug>" | "category:<id>"
  label: string;
  type: "vendor" | "category";
}

// In-page "manage your shortlist" — search + add/remove vendors & categories so a
// new member can populate the Monitor immediately. Writes via the existing
// per-user /api/member/track endpoint, then router.refresh() recomputes the
// server-rendered "what changed" from cached data (no per-user compute here).
export default function MonitorControls({
  saved,
  options,
}: {
  saved: MonitorItem[];
  options: MonitorItem[];
}) {
  const router = useRouter();
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set(saved.map((s) => s.item)));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const meta = useMemo(() => {
    const m = new Map<string, MonitorItem>();
    for (const i of [...saved, ...options]) if (!m.has(i.item)) m.set(i.item, i);
    return m;
  }, [saved, options]);

  async function change(item: string, action: "add" | "remove") {
    setError(false);
    setBusy(item);
    const prev = savedSet;
    const next = new Set(prev);
    if (action === "add") next.add(item);
    else next.delete(item);
    setSavedSet(next); // optimistic
    try {
      const res = await fetch("/api/member/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item, action }),
      });
      if (!res.ok) throw new Error("save_failed");
      router.refresh(); // recompute the server-rendered monitor for the new shortlist
    } catch {
      setSavedSet(prev); // revert
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  const suggestions = q.trim()
    ? options
        .filter((o) => !savedSet.has(o.item) && o.label.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 8)
    : [];
  const savedItems = [...savedSet];

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
      <h2 className="text-sm font-semibold">Your shortlist</h2>
      <p className="mt-1 text-xs text-[#15263c]/65 dark:text-[#eef3f8]/60">
        Add the vendors and categories you want watched — private to you. Changes update your Monitor below.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {savedItems.length === 0 ? (
          <span className="text-xs text-[#15263c]/65 dark:text-[#eef3f8]/60">
            Nothing saved yet — search below to add vendors and categories.
          </span>
        ) : (
          savedItems.map((item) => {
            const m = meta.get(item);
            return (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#b08d2f] bg-[#b08d2f]/10 px-2.5 py-1 text-xs font-medium text-[#15263c] dark:border-[#d4af37] dark:text-[#eef3f8]"
              >
                {m?.label ?? item}
                <span className="text-[9px] uppercase tracking-wide opacity-60">{m?.type ?? ""}</span>
                <button
                  type="button"
                  onClick={() => change(item, "remove")}
                  disabled={busy === item}
                  aria-label={`Remove ${m?.label ?? item}`}
                  className="ml-0.5 rounded-full px-1 text-sm leading-none hover:text-rose-600 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            );
          })
        )}
      </div>

      <div className="relative mt-3 max-w-sm">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Add a vendor or category…"
          aria-label="Search vendors and categories to add"
          className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-[#0c2238]">
            {suggestions.map((o) => (
              <button
                key={o.item}
                type="button"
                onClick={() => {
                  void change(o.item, "add");
                  setQ("");
                }}
                disabled={busy === o.item}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              >
                <span>+ {o.label}</span>
                <span className="text-xs uppercase tracking-wide text-[#15263c]/50 dark:text-[#eef3f8]/50">{o.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t save — try again.</p>}
    </div>
  );
}
