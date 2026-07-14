"use client";

import { useEffect, useRef, useState } from "react";

interface Opt {
  id: string;
  label: string;
}
interface View {
  vendors: string[];
  categories: string[];
  useCases: string[];
  currentStack: string[];
}

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function chipClass(on: boolean): string {
  return on
    ? "rounded-full border border-[#b08d2f] bg-[#b08d2f] px-3 py-1 text-xs font-medium text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0b2519]"
    : "rounded-full border border-black/15 dark:border-white/15 px-3 py-1 text-xs text-[#123d2c] hover:border-[#b08d2f]/60 dark:text-[#eef3f8]";
}

function Section({
  title,
  opts,
  selected,
  onToggle,
  filterable = false,
}: {
  title: string;
  opts: Opt[];
  selected: string[];
  onToggle: (id: string) => void;
  filterable?: boolean;
}) {
  const [q, setQ] = useState("");
  const shown = filterable && q.trim()
    ? opts.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
    : opts;

  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`text-xs ${MUTED}`}>{selected.length} selected</span>
      </div>
      {filterable && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter…"
          aria-label={`Filter ${title}`}
          className="mt-2 w-full rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs outline-none focus:border-black/40 dark:focus:border-white/40"
        />
      )}
      <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-auto">
        {shown.map((o) => (
          <button key={o.id} type="button" onClick={() => onToggle(o.id)} className={chipClass(selected.includes(o.id))}>
            {o.label}
          </button>
        ))}
        {shown.length === 0 && <span className={`text-xs ${MUTED}`}>No matches.</span>}
      </div>
    </div>
  );
}

export default function WatchlistEditor({
  initial,
  vendors,
  categories,
  useCases,
}: {
  initial: View;
  vendors: Opt[];
  categories: Opt[];
  useCases: Opt[];
}) {
  const [state, setState] = useState<View>(initial);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const firstRender = useRef(true);

  // Debounced autosave — PUT the full selection 700ms after the last change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSave("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/member/watchlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        setSave(res.ok ? "saved" : "error");
      } catch {
        setSave("error");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [state]);

  function toggle(key: keyof View, id: string) {
    setState((s) => {
      const cur = s[key];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...s, [key]: next };
    });
  }

  const total = state.vendors.length + state.categories.length + state.useCases.length + state.currentStack.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${MUTED}`}>Changes save automatically — private to you, never shown to vendors.</p>
        <span className="text-xs font-medium text-[#123d2c]/70 dark:text-[#eef3f8]/70" aria-live="polite">
          {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : save === "error" ? "Save failed — retry" : ""}
        </span>
      </div>

      {total === 0 && (
        <p className={`text-sm ${MUTED}`}>
          Nothing saved yet. Pick the vendors, categories, use-cases and current stack you care about —
          your personalised Monitor (coming next) will track changes for exactly these.
        </p>
      )}

      <Section title="Vendors you're watching" opts={vendors} selected={state.vendors} onToggle={(id) => toggle("vendors", id)} filterable />
      <Section title="Categories" opts={categories} selected={state.categories} onToggle={(id) => toggle("categories", id)} />
      <Section title="Use-cases" opts={useCases} selected={state.useCases} onToggle={(id) => toggle("useCases", id)} />
      <Section title="Your current stack" opts={vendors} selected={state.currentStack} onToggle={(id) => toggle("currentStack", id)} filterable />
    </div>
  );
}
