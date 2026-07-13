"use client";

// "Ask AI" — the per-tab grounded chat launcher + panel (piece 3).
// ────────────────────────────────────────────────────────────────
// AnalystGenius UX (launcher → prompt chips → chat), wired to the grounded
// engine at /api/chat/tab. The client sends ONLY {tab, question, history};
// the evidence snapshot is built server-side, and answers carry inline
// citations drawn exclusively from it. Honest states everywhere: signed-out,
// flag-off, credit-capped, no-evidence, and "I don't have evidence for that".

import { useRef, useState } from "react";
import Link from "next/link";
import { MEMBER_FEATURES_VISIBLE } from "@/lib/availability";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export interface TabChatProps {
  tab: { kind: "vendor" | "category" | "peers" | "news" | "dependencies"; id?: string; peerIds?: string[] };
  /** Human label for the header, e.g. the vendor or category name. */
  label: string;
  /** Suggested-question chips (AnalystGenius pattern) — feed the input. */
  chips: string[];
}

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  citations?: { sourceUrl: string }[];
  insufficient?: boolean;
  whatWouldHelp?: string | null;
  error?: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function TabChat({ tab, label, chips }: TabChatProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [signedOut, setSignedOut] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Ask AI is member-gated; with sign-in disabled there's no way to authenticate,
  // so hide the launcher entirely rather than dead-end at a 401. (After all hooks
  // so the Rules of Hooks hold.)
  if (!MEMBER_FEATURES_VISIBLE) return null;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: q }]);

    try {
      const res = await fetch("/api/chat/tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, question: q, history }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (res.status === 401) {
        setSignedOut(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Sign in to use Ask AI — it's a member feature so the assistant can't be abused anonymously.", error: "unauthorized" },
        ]);
      } else if (res.status === 402) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "You've reached your plan's credit limit for AI actions this period.", error: "credit_limit" },
        ]);
      } else if (res.status === 403) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Ask AI isn't enabled right now.", error: "not_enabled" },
        ]);
      } else if (res.status === 422) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "There's no verified evidence to ground on for this view yet — so there's honestly nothing I can answer from.",
            insufficient: true,
          },
        ]);
      } else if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "The assistant hit an error — try again in a moment.", error: String(data.error ?? res.status) },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: (data.answer as string) || "I don't have evidence for that in this tab's data.",
            citations: Array.isArray(data.citations) ? (data.citations as { sourceUrl: string }[]) : [],
            insufficient: data.insufficientEvidence === true,
            whatWouldHelp: (data.whatWouldHelp as string | null) ?? null,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error — the assistant couldn't be reached.", error: "network" },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  };

  return (
    <>
      {/* Launcher. `fixed` chrome always occupies the same screen corner
          regardless of what scrolls underneath it, so it stays icon-only
          (44×44, a real touch target) by default — on a page whose whole
          value proposition is "every claim is cited," a source line landing
          in that corner shouldn't become unreadable under a wide label
          pill. Expands to the labelled pill on hover/focus (desktop) or
          while the panel is open, when context already makes it obvious
          what the control does. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-40 inline-flex h-11 items-center justify-center gap-0 overflow-hidden whitespace-nowrap rounded-full border border-[#d4af37]/60 bg-[#0a1f38] text-sm font-semibold text-[#f6f1e3] shadow-lg transition-[width,gap,padding-left,padding-right] duration-200 ease-out hover:bg-[#13294b] motion-reduce:transition-none ${
          open ? "w-24 gap-2 px-4" : "w-11 px-0 hover:w-28 hover:gap-2 hover:px-4 focus-visible:w-28 focus-visible:gap-2 focus-visible:px-4"
        }`}
        aria-expanded={open}
        aria-controls="tab-chat-panel"
        aria-label={open ? "Close Ask AI" : "Ask AI"}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#d4af37]" aria-hidden />
        <span aria-hidden>{open ? "Close" : "Ask AI"}</span>
      </button>

      {open && (
        <div
          id="tab-chat-panel"
          className="fixed bottom-20 right-5 z-40 flex max-h-[70vh] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-black/15 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0a1f38]"
          role="dialog"
          aria-label={`Ask AI about ${label}`}
        >
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold">Ask AI — {label}</p>
            <p className={`mt-0.5 text-xs leading-4 ${MUTED}`}>
              Grounded in this tab&apos;s cited data only. Beyond the evidence, it says so —
              it never guesses, and it never changes a score.
            </p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-1.5">
                <p className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>Try asking</p>
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => ask(c)}
                    disabled={busy}
                    className="block w-full rounded-lg border border-black/10 px-3 py-2 text-left text-xs transition-colors hover:border-[#d4af37]/60 dark:border-white/15"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[92%] rounded-lg px-3 py-2 text-left text-xs leading-5 ${
                    m.role === "user"
                      ? "bg-[#13294b] text-white dark:bg-[#d4af37] dark:text-[#0a1f38]"
                      : m.error
                        ? "border border-rose-300/50 bg-rose-50 text-rose-900 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
                        : m.insufficient
                          ? "border border-amber-400/40 bg-amber-500/10"
                          : "border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.06]"
                  }`}
                >
                  {m.insufficient && !m.error && (
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      No evidence for this
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.whatWouldHelp && (
                    <p className={`mt-1.5 text-xs ${MUTED}`}>What would answer it: {m.whatWouldHelp}</p>
                  )}
                  {(m.citations ?? []).length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {(m.citations ?? []).map((c) => (
                        <a
                          key={c.sourceUrl}
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-black/15 px-2 py-0.5 text-xs underline-offset-2 hover:underline dark:border-white/20"
                        >
                          {hostOf(c.sourceUrl)}
                        </a>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {busy && <p className={`text-xs ${MUTED}`}>Reading the evidence…</p>}
            {signedOut && (
              <p className="text-xs">
                <Link href="/signin" className="font-semibold underline underline-offset-2">
                  Sign in →
                </Link>
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-2 border-t border-black/10 px-3 py-2.5 dark:border-white/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this tab's data…"
              maxLength={600}
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-[#d4af37]/70 dark:border-white/15"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length < 3}
              className="rounded-md bg-[#13294b] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#0a1f38]"
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
