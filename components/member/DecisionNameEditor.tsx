"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DomainId } from "@/lib/types";

interface ShortlistItem {
  vendorId: string;
  note?: string;
}

// Inline rename. PUT requires the full decision shape (sanitizeDecision treats
// name/category/weights as REQUIRED), so this resends the unchanged
// category/weights/shortlist/asOfDate alongside the new name.
export default function DecisionNameEditor({
  id,
  name,
  category,
  weights,
  shortlist,
  asOfDate,
}: {
  id: string;
  name: string;
  category: string;
  weights: Record<DomainId, number>;
  shortlist: ShortlistItem[];
  asOfDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/member/decisions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: trimmed, category, weights, shortlist, asOfDate }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{name}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-[#7a8aa0] underline-offset-2 hover:underline"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setEditing(false);
            setValue(name);
          }
        }}
        maxLength={120}
        disabled={saving}
        className="rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xl font-semibold text-[#13294b] focus:border-[#b08d2f] focus:outline-none dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !value.trim()}
        className="rounded-full bg-[#b08d2f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#987625] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#1a1605]"
      >
        {saving ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setValue(name);
        }}
        className="text-[11px] text-[#7a8aa0] hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
