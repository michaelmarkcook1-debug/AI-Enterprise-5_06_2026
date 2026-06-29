"use client";

import { useState } from "react";

export default function TriggerDailyRefresh() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function trigger() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch("/api/cron/daily-refresh", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("ok");
        setMsg(json.message ?? "Refresh complete.");
      } else {
        setState("err");
        setMsg(json.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setState("err");
      setMsg(String(e));
    }
  }

  const TONE =
    state === "ok" ? "text-green-600 dark:text-green-400" :
    state === "err" ? "text-red-500 dark:text-red-400" :
    "text-[#475a72] dark:text-[#8aa4c1]";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={trigger}
        disabled={state === "running"}
        className="rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-1.5 text-sm font-medium hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 transition"
      >
        {state === "running" ? "Running…" : "Run daily refresh now"}
      </button>
      {msg && <span className={`text-xs ${TONE}`}>{msg}</span>}
      {state === "running" && (
        <span className="text-xs text-[#475a72]">
          This takes ~2–5 min. The page will show the result when the run writes to the DB.
        </span>
      )}
    </div>
  );
}
