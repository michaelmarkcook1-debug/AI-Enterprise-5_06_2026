"use client";

// Manual trigger for a paid action.
// ─────────────────────────────────────────────────────────────────────────────
// Two things this must get right, because pressing it spends real money:
//
// 1. NOT PRESSABLE BY STRANGERS. Every /admin page on this deployment is public
//    (isAdminPageAuthed() returns true unconditionally, owner instruction
//    2026-07-10). A bare button here would be a spend endpoint anyone could
//    click. So the action carries an admin token, entered once and kept in
//    localStorage on this device only — never baked into the page, never sent
//    to the server as part of the HTML.
//
// 2. NOT PRESSABLE BY ACCIDENT. It costs money, so it asks first, and the
//    confirmation states what it will cost before it runs — not after.

import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "ae_admin_api_token";

export default function RunPaidAction({
  label,
  path,
  costHint,
}: {
  label: string;
  path: string;
  costHint: string;
}) {
  const [token, setToken] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Read on mount only — localStorage isn't available during SSR.
  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_KEY) ?? "");
    } catch {
      /* private mode — the field just stays empty and must be typed each time */
    }
  }, []);

  const remember = useCallback((v: string) => {
    setToken(v);
    try {
      if (v) window.localStorage.setItem(TOKEN_KEY, v);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* non-fatal */
    }
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? `Started (HTTP ${res.status}). ${body.started ? "Running in the background — spend appears in the ledger as steps complete." : ""}`
          : `HTTP ${res.status} — ${body.error ?? "failed"}${res.status === 401 ? ". Check the admin token." : ""}`,
      );
    } catch (err) {
      setResult(`Request failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }, [path, token]);

  return (
    <div className="text-[13px]">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide">Admin token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => remember(e.target.value)}
          placeholder="ADMIN_API_TOKEN"
          autoComplete="off"
          className="mt-1 block w-full max-w-sm rounded-md border border-black/15 bg-white/70 px-2 py-1 font-mono text-[12px] dark:border-white/20 dark:bg-white/10"
        />
      </label>
      <p className="mt-1 text-[11px] text-[#15263c]/60 dark:text-[#eef3f8]/55">
        Held in this browser only. Required — without it the run is rejected.
      </p>

      {!armed ? (
        <button
          type="button"
          disabled={!token || busy}
          onClick={() => setArmed(true)}
          className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run {label} now
        </button>
      ) : (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="font-medium">This spends money. Run {label}?</p>
          <p className="mt-1 text-[12px] text-[#15263c]/70 dark:text-[#eef3f8]/65">
            Billed as: {costHint}. Capped by the daily limit shown above.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={run}
              className="rounded-md border border-amber-600/50 bg-amber-500/20 px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
            >
              {busy ? "Starting…" : "Yes, run it"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setArmed(false)}
              className="rounded-md border border-black/15 px-3 py-1.5 text-[13px] dark:border-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-2 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 font-mono text-[12px] dark:border-white/15 dark:bg-white/5">
          {result}
        </p>
      )}
    </div>
  );
}
