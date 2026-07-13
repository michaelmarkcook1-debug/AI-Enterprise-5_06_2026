"use client";

import { useState, useRef } from "react";

export default function AdminUnlockForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = inputRef.current?.value ?? "";
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "same-origin",
      });
      if (res.ok) {
        // Cookie is set — reload to let the server layout see it.
        window.location.reload();
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError("Too many attempts — try again later.");
      } else if (res.status === 503) {
        setError("Admin not configured — ADMIN_API_TOKEN is not set.");
      } else {
        setError(json.error === "unauthorized" ? "Incorrect token." : (json.error ?? "Unknown error."));
      }
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-8 shadow-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b08d2f]">Admin access</p>
        <h1 className="mb-5 text-xl font-extrabold tracking-tight">Enter admin token</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="ADMIN_API_TOKEN"
            required
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[#b08d2f]/50"
          />
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#b08d2f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a7a28] disabled:opacity-50 transition"
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        <p className="mt-4 text-xs text-[#15263c]/50 dark:text-[#eef3f8]/40">
          Session lasts 90 days. Set <code className="font-mono">ADMIN_API_TOKEN</code> in Vercel env vars.
        </p>
      </div>
    </div>
  );
}
