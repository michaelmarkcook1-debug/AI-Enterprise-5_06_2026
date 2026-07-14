"use client";

import { useState } from "react";

// Admin unlock screen. Posts the admin token to /api/admin/unlock, which sets
// an httpOnly cookie; on success we reload into the gated page.
export default function AdminUnlock() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setErr(res.status === 503 ? "Admin token is not configured on the server." : "Incorrect token.");
    } catch {
      setErr("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 text-[#123d2c] dark:text-[#eef3f8]">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-[#e3d9c0] dark:border-[#223a2e] bg-white/70 dark:bg-white/5 p-6">
        <h1 className="text-lg font-semibold">Admin access</h1>
        <p className="mt-1 text-xs text-[#4c5d75] dark:text-[#8fa5bb]">
          Enter the admin token to view operator tooling.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          aria-label="Admin token"
          autoComplete="current-password"
          className="mt-4 w-full rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
        />
        {err && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{err}</p>}
        <button
          type="submit"
          disabled={busy || token.length === 0}
          className="mt-4 w-full rounded-lg bg-[#123d2c] px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-[#eef3f8] dark:text-[#081410]"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
