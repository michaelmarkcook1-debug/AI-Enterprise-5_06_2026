"use client";

import { useState } from "react";

// Passwordless sign-in request. Email + explicit UNTICKED consent → POST
// /api/auth/request. Enumeration-safe by design (the API returns the same
// response either way), so the success state never confirms whether the email
// existed.
export default function SignInForm({ track, returnTo }: { track?: string; returnTo?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    if (!consent) {
      setState("error");
      setMsg("Please tick the consent box to continue.");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, track, returnTo }),
      });
      if (res.ok || res.status === 202) {
        setState("sent");
      } else if (res.status === 422) {
        setState("error");
        setMsg("Please enter a valid email and tick consent.");
      } else if (res.status === 429) {
        setState("error");
        setMsg("Too many attempts — please try again later.");
      } else {
        setState("error");
        setMsg("Something went wrong. Please try again.");
      }
    } catch {
      setState("error");
      setMsg("Something went wrong. Please try again.");
    }
  }

  if (state === "sent") {
    return (
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Check your inbox</p>
        <p className="mt-1 text-sm text-[#15263c]/70 dark:text-[#eef3f8]/70">
          If that email is valid, a single-use sign-in link is on its way — it expires in 15 minutes.
          You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Email address"
        className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
      />
      <label className="mt-3 flex items-start gap-2 text-xs text-[#15263c]/70 dark:text-[#eef3f8]/70">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-black/30 dark:border-white/30"
          aria-label="Consent to receive a sign-in link and store my email"
        />
        <span>
          Email me a single-use sign-in link and store my email so I can save a watchlist. I can
          unsubscribe / delete any time.
        </span>
      </label>
      <button
        type="submit"
        disabled={state === "loading" || !consent}
        className="mt-3 w-full rounded-lg bg-[#15263c] px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-[#eef3f8] dark:text-[#071827]"
      >
        {state === "loading" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{msg}</p>}
      <p className="mt-2 text-xs text-[#15263c]/50 dark:text-[#eef3f8]/50">
        Passwordless. No spam — just your sign-in link.
      </p>
    </form>
  );
}
