"use client";

// AIE-05 — the interrogation flow (client).
// ─────────────────────────────────────────────────────────────────────────────
// Drives the adaptive Q&A: opening statement → questions (with optional
// taxonomy-backed chips + always-available free text) → the tailored written
// finding, with its cited sources and the session's inference cost. State lives
// server-side (the client holds only a sessionId), so this component is a thin
// driver over /api/interrogate/{start,answer,finding}.

import { useState, type ReactNode } from "react";
import ContributePrompt from "./ContributePrompt";

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const BTN = "rounded-md bg-[#13294b] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c3a66] disabled:opacity-50 dark:bg-[#d4af37] dark:text-[#0a1f38]";

interface EvidenceRef {
  layer: string;
  scopeLabel: string;
  headline: string;
  sourceUrl: string;
  sourcePublisher?: string;
  sourceDate?: string;
}

type Phase = "opening" | "questioning" | "synthesizing" | "finding" | "failed";

interface QAResult {
  kind: "question" | "finding" | "failed";
  sessionId: string;
  question?: string;
  options?: string[];
  questionsAsked?: number;
  finding?: { markdown: string; citedSourceUrls: string[] };
  reason?: string;
}

/** Minimal, safe inline renderer for the finding's known markdown subset:
 *  ### heading, **bold**, *italic*, and paragraphs. No raw HTML injection. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`${keyBase}-i${i}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Finding({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="space-y-2 text-sm leading-6">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (t.startsWith("### ")) {
          return (
            <h3 key={i} className="font-[var(--font-display)] text-lg font-bold tracking-tight">
              {renderInline(t.slice(4), `h${i}`)}
            </h3>
          );
        }
        const italicOnly = /^\*[^*]+\*$/.test(t);
        return (
          <p key={i} className={italicOnly ? `text-xs ${MUTED}` : undefined}>
            {renderInline(t, `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}

async function postJson(url: string, body: unknown): Promise<QAResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as QAResult & { error?: string; message?: string };
  if (!res.ok && !data.kind) {
    throw new Error(data.message || data.error || `request failed (${res.status})`);
  }
  return data;
}

export default function InterrogationFlow() {
  const [phase, setPhase] = useState<Phase>("opening");
  const [sessionId, setSessionId] = useState<string>("");
  const [opening, setOpening] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [answer, setAnswer] = useState("");
  const [finding, setFinding] = useState<{ markdown: string; citedSourceUrls: string[] } | null>(null);
  const [evidenceRefs, setEvidenceRefs] = useState<EvidenceRef[]>([]);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  function applyResult(r: QAResult) {
    setSessionId(r.sessionId);
    if (r.kind === "question") {
      setQuestion(r.question ?? "");
      setOptions(r.options ?? []);
      setAnswer("");
      // Read the server-authoritative count rather than self-incrementing —
      // the client's own counter can't be trusted to match the real number of
      // question turns persisted (e.g. after a retried/dropped request).
      setQuestionsAsked(r.questionsAsked ?? 0);
      setPhase("questioning");
    } else if (r.kind === "finding") {
      setFinding(r.finding ?? null);
      setPhase("finding");
      void enrichFinding(r.sessionId);
    } else {
      setError(r.reason ?? "The engine couldn't complete a grounded finding.");
      setPhase("failed");
    }
  }

  /** Full reset back to the opening screen — shared by both "start over" exits
   *  (from a finding and from a failure) so they can never drift apart and
   *  leave stale state (a leaked opening statement, a stale question counter)
   *  bleeding into the next attempt. */
  function resetToStart() {
    setPhase("opening");
    setOpening("");
    setQuestion("");
    setOptions([]);
    setAnswer("");
    setQuestionsAsked(0);
    setFinding(null);
    setEvidenceRefs([]);
    setCostUsd(null);
    setError("");
  }

  async function enrichFinding(sid: string) {
    try {
      const res = await fetch(`/api/interrogate/finding/${sid}`);
      if (!res.ok) return;
      const d = (await res.json()) as { evidenceRefs?: EvidenceRef[]; costUsd?: number };
      setEvidenceRefs(d.evidenceRefs ?? []);
      setCostUsd(typeof d.costUsd === "number" ? d.costUsd : null);
    } catch {
      /* enrichment is best-effort; the finding already rendered */
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      applyResult(await postJson("/api/interrogate/start", { opening: opening.trim() }));
    } catch (e) {
      setError((e as Error).message);
      setPhase("failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(ans: string) {
    if (!ans.trim()) return;
    setBusy(true);
    setError("");
    setPhase("synthesizing"); // optimistic; applyResult resets to questioning if more Qs
    try {
      const r = await postJson("/api/interrogate/answer", { sessionId, answer: ans.trim() });
      applyResult(r);
    } catch (e) {
      setError((e as Error).message);
      setPhase("failed");
    } finally {
      setBusy(false);
    }
  }

  // Publisher label for a cited URL, from the evidence refs when available.
  const publisherFor = (url: string) =>
    evidenceRefs.find((r) => r.sourceUrl === url)?.sourcePublisher ?? new URL(url, "https://x").hostname.replace(/^www\./, "");

  return (
    <div className="space-y-4">
      {phase === "opening" && (
        <section className={CARD}>
          <label className="block text-sm font-semibold">Tell me what you're trying to do</label>
          <p className={`mt-1 text-xs ${MUTED}`}>
            One or two sentences — who you are, what you have, and where you want to get to with AI. I&apos;ll
            ask a few sharp questions, then write you a tailored, source-cited finding.
          </p>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            rows={3}
            placeholder="e.g. I'm the CIO of a regional bank rolling out AI coding copilots for a 200-person engineering org. Which frontier model should we standardize on, and what are peers doing?"
            className="mt-3 w-full rounded-md border border-black/15 bg-white/80 p-3 text-sm dark:border-white/15 dark:bg-[#0a1f38]"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className={`text-[11px] ${MUTED}`}>{opening.trim().length < 8 ? "A sentence or two." : `${opening.trim().length} chars`}</span>
            <button className={BTN} onClick={start} disabled={busy || opening.trim().length < 8}>
              {busy ? "Starting…" : "Start"}
            </button>
          </div>
        </section>
      )}

      {phase === "questioning" && (
        <section className={CARD}>
          <div className={`text-[11px] font-semibold uppercase tracking-wide ${MUTED}`}>Question {questionsAsked}</div>
          <p className="mt-1 text-sm font-medium">{question}</p>
          {options.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((o) => (
                <button
                  key={o}
                  onClick={() => submit(o)}
                  disabled={busy}
                  className="rounded-full border border-black/15 px-3 py-1 text-sm hover:border-[#b08d2f] disabled:opacity-50 dark:border-white/15"
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
              placeholder={options.length > 0 ? "…or type your own answer" : "Your answer"}
              className="w-full rounded-md border border-black/15 bg-white/80 p-3 text-sm dark:border-white/15 dark:bg-[#0a1f38]"
            />
            <div className="mt-2 flex justify-end">
              <button className={BTN} onClick={() => submit(answer)} disabled={busy || !answer.trim()}>
                {busy ? "Thinking…" : "Send"}
              </button>
            </div>
          </div>
        </section>
      )}

      {phase === "synthesizing" && (
        <section className={`${CARD} text-sm ${MUTED}`}>Writing your tailored finding from the cited evidence…</section>
      )}

      {phase === "finding" && finding && (
        <section className={CARD}>
          <Finding markdown={finding.markdown} />
          {finding.citedSourceUrls.length > 0 && (
            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>Sources</div>
              <ul className="space-y-1">
                {finding.citedSourceUrls.map((u) => (
                  <li key={u} className="text-xs">
                    {/^https?:\/\//.test(u) ? (
                      <a href={u} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {publisherFor(u)}
                      </a>
                    ) : (
                      // Our own pool aggregate, not a third-party link — never
                      // rendered as a clickable (and non-navigable) anchor.
                      <span className={MUTED}>{publisherFor(u)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <span className={`text-[11px] ${MUTED}`}>
              {costUsd !== null ? `Session inference cost: $${costUsd.toFixed(4)}` : ""}
            </span>
            <button className="text-xs underline underline-offset-2" onClick={resetToStart}>
              Start another
            </button>
          </div>
          <ContributePrompt sessionId={sessionId} />
        </section>
      )}

      {phase === "failed" && (
        <section className={CARD}>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">We couldn&apos;t complete a grounded finding.</p>
          <p className={`mt-1 text-xs ${MUTED}`}>{error || "Something went wrong."} We hold the answer rather than show one we can&apos;t stand behind.</p>
          <button className="mt-3 text-xs underline underline-offset-2" onClick={resetToStart}>
            Start over
          </button>
        </section>
      )}
    </div>
  );
}
