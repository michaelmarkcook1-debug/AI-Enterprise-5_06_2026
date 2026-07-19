"use client";

// Shortlist monitor — grouped, curatable four-axis watch over the user's vendors.
// ─────────────────────────────────────────────────────────────────────────────
// Renders the groups buildShortlistMonitor() assembled (decisions by type + the
// watchlist) and lets the user curate the REAL stores: drop a vendor, or remove a
// whole decision group (with a two-step confirm, since that deletes the saved
// decision). Every mutation hits an owned, same-origin member route and then
// router.refresh() re-derives the cards server-side. Optimistic hide gives instant
// feedback; a signature-keyed effect clears it once fresh server data arrives.
//
// Honesty carries straight through from the scorecard: the 4th "insufficient"
// state sits OFF the good→watch ramp (dashed, never filled), the coverage line is
// an honest denominator, and every derived/curated axis says so.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShortlistMonitorView, MonitorGroup } from "@/lib/shortlist/groups";
import type { ShortlistVendorCard, AxisRead, AxisState } from "@/lib/shortlist/scorecard";

const DEEP = "text-[#123d2c] dark:text-[#eef3f8]";
const MUTED = "text-[#123d2c]/60 dark:text-[#eef3f8]/55";

// No red↔green: clear = sky (settled), caution/watch = amber ramp (attention),
// insufficient = dashed grey, deliberately off the good→watch ramp.
const AXIS_STYLE: Record<AxisState, string> = {
  clear: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  caution: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  watch: "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200 font-semibold",
  insufficient: "border-dashed border-[#123d2c]/25 text-[#123d2c]/45 dark:border-white/20 dark:text-white/40",
};
const AXIS_WORD: Record<AxisState, string> = { clear: "Clear", caution: "Caution", watch: "Watch", insufficient: "Insufficient" };
const AXES: { key: keyof Pick<ShortlistVendorCard, "risk" | "privacy" | "encroachment" | "positioning">; label: string }[] = [
  { key: "risk", label: "Risk" },
  { key: "privacy", label: "Privacy" },
  { key: "encroachment", label: "Encroachment" },
  { key: "positioning", label: "Positioning" },
];

function AxisChip({ label, read }: { label: string; read: AxisRead }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${AXIS_STYLE[read.state]}`}
      title={read.summary}
    >
      {label} · {AXIS_WORD[read.state]}
    </span>
  );
}

function AxisDetail({ label, read }: { label: string; read: AxisRead }) {
  return (
    <div className="border-t border-black/5 pt-2.5 dark:border-white/5">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>{label}</span>
        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[11px] ${AXIS_STYLE[read.state]}`}>{AXIS_WORD[read.state]}</span>
      </div>
      <p className={`mt-1 text-sm leading-5 ${DEEP}`}>{read.summary}</p>
      <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${MUTED}`}>
        {read.coverageNote && <span>{read.coverageNote}</span>}
        {read.derived && <span>Derived — not a stated fact.</span>}
        {read.citations.slice(0, 3).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
            {c.label ? c.label : "source"}
          </a>
        ))}
      </div>
    </div>
  );
}

function VendorCard({
  card,
  group,
  onRemove,
  busy,
}: {
  card: ShortlistVendorCard;
  group: MonitorGroup;
  onRemove: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#e3d9c0] bg-white/70 px-4 py-3 dark:border-[#223a2e] dark:bg-[#0d1f17]/50">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${DEEP}`}>{card.name}</span>
          <span className={`rounded-full bg-black/5 px-2 py-0.5 text-[11px] dark:bg-white/10 ${MUTED}`}>{card.role}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${card.name}`}
          className={`shrink-0 rounded-md px-1.5 text-lg leading-none ${MUTED} hover:text-[#123d2c] disabled:opacity-40 dark:hover:text-white`}
        >
          {busy ? "…" : "×"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {AXES.map((a) => (
          <AxisChip key={a.key} label={a.label} read={card[a.key]} />
        ))}
        {card.momentum && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
              card.momentum.delta > 0
                ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
                : card.momentum.delta < 0
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : `border-black/10 dark:border-white/15 ${MUTED}`
            }`}
            title={`${card.momentum.fromDate} → ${card.momentum.toDate}`}
          >
            {card.momentum.delta > 0 ? "▲" : card.momentum.delta < 0 ? "▼" : "—"} {Math.abs(card.momentum.delta).toFixed(2)}
          </span>
        )}
      </div>

      {card.headline && (
        <p className={`mt-2.5 text-sm leading-5 ${DEEP}`}>
          {card.headline.text}
          {card.headline.derived && (
            <span className={`ml-1.5 whitespace-nowrap rounded border border-black/10 px-1 py-px text-[10px] uppercase tracking-wide dark:border-white/15 ${MUTED}`}>
              derived
            </span>
          )}
        </p>
      )}

      <div className={`mt-2 flex items-center gap-3 text-[11px] ${MUTED}`}>
        <span>Evidence: {card.coverage.evidenced} of {card.coverage.total} dimensions</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sky-700 hover:underline dark:text-sky-400">
          {open ? "Hide detail" : "Show detail"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2.5">
          {AXES.map((a) => (
            <AxisDetail key={a.key} label={a.label} read={card[a.key]} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  group,
  hidden,
  busyKey,
  confirming,
  onConfirmGroup,
  onRemoveGroup,
  onRemoveVendor,
}: {
  group: MonitorGroup;
  hidden: Set<string>;
  busyKey: string | null;
  confirming: boolean;
  onConfirmGroup: () => void;
  onRemoveGroup: () => void;
  onRemoveVendor: (card: ShortlistVendorCard) => void;
}) {
  const cards = group.cards.filter((c) => !hidden.has(`${group.decisionId ?? "wl"}:${c.vendorId}`));
  if (cards.length === 0) return null;
  return (
    <section className="mb-7">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-base font-semibold ${DEEP}`}>{group.title}</h3>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            {group.typeLabel}
          </span>
        </div>
        {group.kind === "decision" && group.decisionId && (
          confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className={MUTED}>Remove this decision group?</span>
              <button type="button" onClick={onRemoveGroup} className="rounded-md border border-amber-500 px-2 py-0.5 text-amber-800 dark:text-amber-300">
                Confirm
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onConfirmGroup}
              className={`rounded-md border border-black/10 px-2 py-0.5 text-xs dark:border-white/15 ${MUTED} hover:text-[#123d2c] dark:hover:text-white`}
            >
              Remove group
            </button>
          )
        )}
      </div>
      <div className="space-y-2.5">
        {cards.map((c) => (
          <VendorCard
            key={c.vendorId}
            card={c}
            group={group}
            busy={busyKey === `${group.decisionId ?? "wl"}:${c.vendorId}`}
            onRemove={() => onRemoveVendor(c)}
          />
        ))}
      </div>
    </section>
  );
}

export default function ShortlistMonitorPanel({
  monitor,
  sharedSeat,
}: {
  monitor: ShortlistMonitorView | null;
  sharedSeat: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmingGroup, setConfirmingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Signature of the server data — when it changes (after a refresh), clear the
  // optimistic overlays so we track the authoritative set again.
  const sig = useMemo(
    () => (monitor?.groups ?? []).map((g) => `${g.decisionId}:${g.cards.map((c) => c.vendorId).join(",")}`).join("|"),
    [monitor],
  );
  useEffect(() => {
    setHidden(new Set());
    setHiddenGroups(new Set());
  }, [sig]);

  async function mutate(key: string, run: () => Promise<Response>, onOk: () => void) {
    setBusyKey(key);
    setError(null);
    try {
      const res = await run();
      if (!res.ok) throw new Error(String(res.status));
      onOk();
      router.refresh();
    } catch {
      setError("Couldn't update your shortlist. Try again.");
    } finally {
      setBusyKey(null);
    }
  }

  function removeVendor(group: MonitorGroup, card: ShortlistVendorCard) {
    const key = `${group.decisionId ?? "wl"}:${card.vendorId}`;
    void mutate(
      key,
      () =>
        fetch("/api/member/monitor/remove-vendor", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decisionId: group.decisionId, vendorId: card.vendorId, slug: card.slug }),
        }),
      () => setHidden((s) => new Set(s).add(key)),
    );
  }

  function removeGroup(group: MonitorGroup) {
    if (!group.decisionId) return;
    const id = group.decisionId;
    setConfirmingGroup(null);
    void mutate(
      `group:${id}`,
      () => fetch(`/api/member/decisions/${id}`, { method: "DELETE" }),
      () => setHiddenGroups((s) => new Set(s).add(id)),
    );
  }

  const groups = (monitor?.groups ?? []).filter((g) => !(g.decisionId && hiddenGroups.has(g.decisionId)));
  const hasAny = groups.some((g) => g.cards.some((c) => !hidden.has(`${g.decisionId ?? "wl"}:${c.vendorId}`)));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className={`text-sm ${MUTED}`}>
          Your shortlisted vendors, grouped by the decision they came from — each watched on risk, privacy,
          encroachment and market positioning.
        </p>
      </div>

      {sharedSeat && (
        <p className={`mb-5 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-800/50 dark:bg-amber-950/20 ${MUTED}`}>
          This is a shared preview seat — everyone testing sees the same shortlist. Per-visitor shortlists activate once
          sign-in is switched on.
        </p>
      )}

      {error && <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">{error}</p>}

      {!hasAny ? (
        <div className={`rounded-xl border border-dashed border-[#123d2c]/25 px-4 py-8 text-center text-sm dark:border-white/20 ${MUTED}`}>
          No shortlisted vendors yet. Add vendors from a decision in{" "}
          <a href="/decisions" className="text-sky-700 hover:underline dark:text-sky-400">your decisions</a>{" "}
          or your{" "}
          <a href="/watchlist" className="text-sky-700 hover:underline dark:text-sky-400">watchlist</a>, and they&apos;ll
          appear here to monitor.
        </div>
      ) : (
        groups.map((g) => (
          <GroupSection
            key={g.decisionId ?? "watchlist"}
            group={g}
            hidden={hidden}
            busyKey={busyKey}
            confirming={confirmingGroup === g.decisionId}
            onConfirmGroup={() => setConfirmingGroup(g.decisionId)}
            onRemoveGroup={() => removeGroup(g)}
            onRemoveVendor={(c) => removeVendor(g, c)}
          />
        ))
      )}
    </div>
  );
}
