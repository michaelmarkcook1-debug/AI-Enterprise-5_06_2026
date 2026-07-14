"use client";

// News→Assessment bridge panel (C12). Per news item: the vendor(s) it touches →
// a route into that vendor's assessment (where the gated re-run "act" lives), the
// honest State-B "pending re-assessment" label (NEVER a number/delta), and an
// inline, collapsed "suggest a correction" affordance (moderated — never
// auto-applied). Reading is free; the deep re-assessment is the gated action.

import { useState } from "react";
import Link from "next/link";
import type { NewsBridge, BridgeVendor } from "@/lib/news-bridge/bridge";
import { PENDING_LABEL } from "@/lib/news-bridge/bridge";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function CorrectionForm({ bridge, onDone }: { bridge: NewsBridge; onDone: () => void }) {
  const [kind, setKind] = useState<"wrong_vendor" | "other">(bridge.vendors.length > 0 ? "wrong_vendor" : "other");
  const [vendorSlug, setVendorSlug] = useState<string>(bridge.vendors[0]?.slug ?? "");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    setState("sending");
    try {
      const res = await fetch("/api/news/correction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          newsItemId: bridge.newsItemId,
          kind,
          vendorSlug: kind === "wrong_vendor" ? vendorSlug : undefined,
          note: note.trim() || undefined,
        }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Thanks — flagged for review. It won&apos;t change anything until an analyst checks it.</p>;
  }

  return (
    <div className="mt-2 rounded-md border border-black/10 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap gap-2 text-xs">
        {bridge.vendors.length > 0 && (
          <label className="inline-flex items-center gap-1">
            <input type="radio" checked={kind === "wrong_vendor"} onChange={() => setKind("wrong_vendor")} />
            Wrong vendor
          </label>
        )}
        <label className="inline-flex items-center gap-1">
          <input type="radio" checked={kind === "other"} onChange={() => setKind("other")} />
          Something else
        </label>
      </div>
      {kind === "wrong_vendor" && bridge.vendors.length > 0 && (
        <select
          value={vendorSlug}
          onChange={(e) => setVendorSlug(e.target.value)}
          aria-label="Which vendor this item is not actually about"
          className="mt-2 w-full rounded border border-black/15 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-[#0d1f17]"
        >
          {bridge.vendors.map((v) => (
            <option key={v.slug} value={v.slug}>
              Not actually about {v.name}
            </option>
          ))}
        </select>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder={kind === "other" ? "What's off? (required)" : "Add a note (optional)"}
        aria-label={kind === "other" ? "What's off? (required)" : "Add a note (optional)"}
        rows={2}
        className="mt-2 w-full rounded border border-black/15 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-[#0d1f17]"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={state === "sending" || (kind === "other" && !note.trim())}
          onClick={submit}
          className="rounded-full border border-[#d6c9a8] px-2.5 py-1 text-xs font-medium disabled:opacity-50 dark:border-[#2a4a6b]"
        >
          {state === "sending" ? "Sending…" : "Send suggestion"}
        </button>
        <button type="button" onClick={onDone} className={`text-xs ${MUTED}`}>Cancel</button>
        {state === "error" && <span className="text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t send — try again.</span>}
      </div>
    </div>
  );
}

export default function NewsBridgePanel({ bridge, compact = false }: { bridge: NewsBridge; compact?: boolean }) {
  const [correcting, setCorrecting] = useState(false);
  if (bridge.vendors.length === 0) return null; // no tracked vendor matched → invent nothing

  return (
    <div className={compact ? "mt-1.5" : "mt-2"}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={`font-semibold uppercase tracking-wide ${MUTED}`}>Assessment</span>
        {bridge.vendors.map((v: BridgeVendor) => (
          <Link
            key={v.slug}
            href={`/vendors/${v.slug}`}
            className="rounded border border-[#e0d6ba] bg-[#faf6ec] px-1.5 py-0.5 font-medium text-[#475a72] hover:underline dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#c2d1e0]"
          >
            {v.name} →
          </Link>
        ))}
        {/* State B — the ONLY honest state today. No number, ever. */}
        <span
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-800 dark:text-amber-200"
          title={PENDING_LABEL}
        >
          pending re-assessment
        </span>
        {!correcting && (
          <button type="button" onClick={() => setCorrecting(true)} className={`underline underline-offset-2 ${MUTED}`}>
            Suggest a correction
          </button>
        )}
      </div>
      {!compact && (
        <p className={`mt-1 text-xs leading-4 ${MUTED}`}>
          We link the item to the vendor&apos;s evidence-based assessment — we don&apos;t claim a score
          movement until the evidence pipeline actually re-scores it.
        </p>
      )}
      {correcting && <CorrectionForm bridge={bridge} onDone={() => setCorrecting(false)} />}
    </div>
  );
}
