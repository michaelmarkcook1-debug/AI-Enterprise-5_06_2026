"use client";

// Hover/focus analyst review for one encroachment signal.
// ─────────────────────────────────────────────────────────────────────────────
// The tile alone says "X could encroach on Y" plus a template rationale, which
// on its own is close to information-free. This lazily fetches the assessed
// read: what the structure implies, what each side has actually DONE (cited),
// what each side has actually SAID (verbatim, with receipts), and what to watch.
//
// HONEST BY CONSTRUCTION:
//  • the depth chip states how many of the three input classes actually fired,
//    so a structure-only claim can never read like a fully-evidenced one;
//  • an ungenerated (no-LLM / guard-rejected) review is labelled as the
//    structural read, never passed off as an analyst assessment;
//  • every line is an ASSESSMENT of a derived signal — the header says so, and
//    the dependency's sources are labelled as evidencing the dependency, not
//    the encroachment.
// Same gesture as ScoreTrendChart: hover, focus, and keyboard all open it.

import { useCallback, useId, useRef, useState } from "react";

interface Review {
  headline: string;
  structuralRead: string;
  movementRead: string;
  statementRead: string;
  watchFor: string[];
  assessedLevel: "watch" | "credible" | "material";
  insufficientContext: boolean;
  citations: string[];
}

interface Payload {
  pair: { threatener: string; threatened: string };
  review: Review;
  depth: { count: number; label: string };
  generated: boolean;
  movementCount: number;
  statementCount: number;
  statementsAsOf: string;
}

// Gold ramp only — never red↔green (clarity standard). Level is an assessed
// strength, not a good/bad verdict.
const LEVEL_LABEL: Record<Review["assessedLevel"], string> = {
  watch: "Watch — adjacency only",
  credible: "Credible — partial corroboration",
  material: "Material — corroborated across inputs",
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export function EncroachmentReview({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const load = useCallback(async () => {
    if (data !== null || loading || error) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/graph/encroachment-review?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [from, to, data, loading, error]);

  const show = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Fixed-positioned: the tile lives inside bordered cards, so an absolute
      // popover would be clipped by the card's own bounds.
      setPos({
        left: Math.min(Math.max(8, rect.left), window.innerWidth - 400),
        top: rect.bottom + 6,
      });
    }
    setOpen(true);
    void load();
  }, [load]);

  const hide = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? labelId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        onKeyDown={(e) => e.key === "Escape" && hide()}
        className="w-full cursor-help text-left underline decoration-dotted decoration-amber-600/40 underline-offset-4"
      >
        {children}
      </button>

      {open && pos && (
        <div
          id={labelId}
          role="tooltip"
          style={{ left: pos.left, top: pos.top }}
          className="fixed z-50 w-[min(24rem,calc(100vw-1rem))] max-h-[70vh] overflow-y-auto rounded-xl border border-black/10 bg-white p-4 text-sm shadow-xl dark:border-white/15 dark:bg-[#0f2019]"
        >
          {loading && <p className={`text-xs ${MUTED}`}>Assessing this signal…</p>}
          {error && (
            <p className={`text-xs ${MUTED}`}>
              Analyst review unavailable for this signal right now.
            </p>
          )}
          {data && (
            <>
              {/* What this IS — stated before anything that could read as fact. */}
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Assessed interpretation — not a reported event
              </p>
              <p className="font-medium leading-6">{data.review.headline}</p>

              <div className={`mt-2 flex flex-wrap gap-1.5 text-[11px] ${MUTED}`}>
                <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/15">
                  {LEVEL_LABEL[data.review.assessedLevel]}
                </span>
                <span className="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/15">
                  Inputs {data.depth.count}/3 · {data.depth.label}
                </span>
              </div>

              <dl className="mt-3 space-y-2.5">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide">Structure</dt>
                  <dd className="mt-0.5 leading-6">{data.review.structuralRead}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide">
                    Previous movements{" "}
                    <span className={`font-normal normal-case ${MUTED}`}>
                      ({data.movementCount} cited)
                    </span>
                  </dt>
                  <dd className="mt-0.5 leading-6">{data.review.movementRead}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide">
                    Stated positions{" "}
                    <span className={`font-normal normal-case ${MUTED}`}>
                      ({data.statementCount} verbatim, as of {data.statementsAsOf})
                    </span>
                  </dt>
                  <dd className="mt-0.5 leading-6">{data.review.statementRead}</dd>
                </div>
              </dl>

              {data.review.watchFor.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">
                    What would confirm or kill this
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-6">
                    {data.review.watchFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.review.citations.length > 0 && (
                <p className={`mt-3 border-t border-black/5 pt-2 text-[11px] leading-5 dark:border-white/10 ${MUTED}`}>
                  Sources evidence the underlying relationship, not the encroachment
                  assessment:{" "}
                  {data.review.citations.map((u, i) => (
                    <span key={u}>
                      {i > 0 && ", "}
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {hostOf(u)}
                      </a>
                    </span>
                  ))}
                </p>
              )}

              {!data.generated && (
                <p className={`mt-2 text-[11px] leading-5 ${MUTED}`}>
                  Structural read only — the analyst layer did not run for this signal.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
