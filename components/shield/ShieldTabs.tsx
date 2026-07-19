"use client";

// Two-tab strip for /shield: the Trust Rank ledger (tab 1) and the personal
// Shortlist monitor (tab 2, to its right). A thin presentational toggle in the
// established in-repo pattern (ReputationTabs) — both panels are server-rendered
// and passed in as slots; this only chooses which is visible.

import { useState, type ReactNode } from "react";

const ACTIVE = "border-[#123d2c] text-[#123d2c] dark:border-[#eef3f8] dark:text-[#eef3f8]";
const IDLE = "border-transparent text-[#123d2c]/55 hover:text-[#123d2c] dark:text-[#eef3f8]/50 dark:hover:text-[#eef3f8]";

export default function ShieldTabs({
  trustRank,
  monitor,
  monitorCount,
}: {
  trustRank: ReactNode;
  monitor: ReactNode;
  monitorCount: number;
}) {
  const [active, setActive] = useState<"trust" | "monitor">("trust");
  const tab = (id: "trust" | "monitor", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      onClick={() => setActive(id)}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active === id ? ACTIVE : IDLE}`}
    >
      {label}
      {id === "monitor" && monitorCount > 0 && (
        <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] tabular-nums dark:bg-white/10">{monitorCount}</span>
      )}
    </button>
  );

  return (
    <div>
      <div role="tablist" className="mb-7 flex flex-wrap items-center gap-1 border-b border-black/10 dark:border-white/10">
        {tab("trust", "Trust Rank")}
        {tab("monitor", "Shortlist monitor")}
      </div>
      {active === "trust" ? trustRank : monitor}
    </div>
  );
}
