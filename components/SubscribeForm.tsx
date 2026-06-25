"use client";

import { useState } from "react";

// Email capture form → POST /api/subscribe (double opt-in). Anonymous until the
// user opts in; no tracking beyond the email they type.
export default function SubscribeForm({ source = "site", className = "" }: { source?: string; className?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (res.ok) {
        setState("done");
        setMsg("Check your inbox to confirm your subscription.");
        setEmail("");
      } else if (res.status === 422) {
        setState("error");
        setMsg("Please enter a valid email address.");
      } else if (res.status === 429) {
        setState("error");
        setMsg("Too many attempts — please try again later.");
      } else if (res.status === 503) {
        setState("error");
        setMsg("Sign-up is temporarily unavailable. Please try again later.");
      } else {
        setState("error");
        setMsg("Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMsg("Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return <p className={`text-sm text-emerald-700 dark:text-emerald-300 ${className}`}>{msg}</p>;
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email address"
          className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="rounded-lg bg-[#15263c] px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-[#eef3f8] dark:text-[#071827]"
        >
          {state === "loading" ? "…" : "Subscribe"}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{msg}</p>}
      <p className="mt-2 text-[11px] text-[#15263c]/50 dark:text-[#eef3f8]/50">
        Double opt-in. No spam, unsubscribe any time.
      </p>
    </form>
  );
}
