"use client";

// Phase 3 Assessment — Wave 3 (Interrogate): buyer-context re-run panel.
// ─────────────────────────────────────────────────────────────────────────────
// The premium, member-gated action. A buyer types their real constraints; on
// "Re-run" it POSTs to /api/member/assessment/interrogate, gets back a SessionLens
// (adjusted WEIGHTS + cited "what changed" + per-vendor deltas), and feeds the
// adjusted weights into the SAME Wave-2 island state (onApplyLens → setSliders) so
// the composite/re-rank updates live via the existing deterministic engine. This
// panel adjusts EMPHASIS, never a score. Every output is a DRAFT to pressure-test
// (C4), with a refine path. Anonymous visitors see an upsell, never the action.

import { useState } from "react";
import Link from "next/link";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import type { DomainId } from "@/lib/types";
import type { SessionLens } from "@/lib/assessment/session-lens";

export interface InterrogateConfig {
  /** Paid-depth flag (INTERROGATE_ENABLED) resolved server-side. */
  enabled: boolean;
  /** Whether a member session is present (getMember() server-side). */
  signedIn: boolean;
  scope:
    | { kind: "vendor"; vendorId: string }
    | { kind: "category"; categoryId: string };
}

interface ContextForm {
  incumbents: string;
  renewalTiming: string;
  region: string;
  regulatory: string;
  riskAppetite: string;
  inHouseSkills: string;
  timeline: string;
  freeform: string;
}

const EMPTY_FORM: ContextForm = {
  incumbents: "",
  renewalTiming: "",
  region: "",
  regulatory: "",
  riskAppetite: "",
  inHouseSkills: "",
  timeline: "",
  freeform: "",
};

const FIELDS: { key: keyof ContextForm; label: string; placeholder: string }[] = [
  { key: "incumbents", label: "Existing stack / incumbents", placeholder: "e.g. standardised on Azure; ServiceNow for ITSM" },
  { key: "renewalTiming", label: "Contract-renewal timing", placeholder: "e.g. ServiceNow renews in 3 months" },
  { key: "region", label: "Region / data-residency", placeholder: "e.g. EU-only, data can't leave region" },
  { key: "regulatory", label: "Regulatory bar", placeholder: "e.g. SOC 2 non-negotiable; HIPAA" },
  { key: "riskAppetite", label: "Risk appetite", placeholder: "e.g. regulated, low tolerance" },
  { key: "inHouseSkills", label: "In-house skills", placeholder: "e.g. small platform team, no ML engineers" },
  { key: "timeline", label: "Timeline", placeholder: "e.g. live within two quarters" },
];

function hasAnyContext(f: ContextForm): boolean {
  return Object.values(f).some((v) => v.trim().length > 0);
}

const CARD =
  "rounded-xl border border-[#d4af37]/50 bg-[#fbf6e4]/60 p-4 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/30";
const KICKER =
  "text-[10px] font-semibold uppercase tracking-wider text-[#a07f1f] dark:text-[#d4af37]";

export default function InterrogatePanel({
  config,
  activeDomains,
  vendorIds,
  onApplyLens,
}: {
  config: InterrogateConfig;
  /** The island's active domain set — labels the delta explanation. */
  activeDomains: DomainId[];
  /** Category scope only: the in-scope vendor ids to re-rank. */
  vendorIds?: string[];
  /** Feed the returned adjusted weights into the island's slider state. */
  onApplyLens: (sliders: Record<DomainId, number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ContextForm>(EMPTY_FORM);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [lens, setLens] = useState<SessionLens | null>(null);
  const [stubbed, setStubbed] = useState(false);
  const [truncated, setTruncated] = useState(false);

  if (!config.enabled) return null;

  // Anonymous → upsell teaser, never the action.
  if (!config.signedIn) {
    return (
      <div className={`${CARD} mb-4`}>
        <div className={KICKER}>Interrogate — premium</div>
        <p className="mt-1 text-xs leading-5 text-[#3f5068] dark:text-[#a7bacd]">
          Feed in what the scores can’t know — <em>“ServiceNow renews in 3 months,” “EU-only,” “regulated”</em> — and
          re-run this assessment through <strong>your</strong> context: it re-weights the domains your situation makes
          decisive and re-ranks accordingly, with a cited explanation.{" "}
          <Link href="/signin" className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400">
            Sign in to interrogate
          </Link>
          .
        </p>
      </div>
    );
  }

  async function run() {
    setState("loading");
    setError("");
    const scopeBody =
      config.scope.kind === "vendor"
        ? { kind: "vendor", vendorId: config.scope.vendorId }
        : { kind: "category", categoryId: config.scope.categoryId, vendorIds: vendorIds ?? [] };
    try {
      const res = await fetch("/api/member/assessment/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ scope: scopeBody, context: form }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setError(
          res.status === 401 ? "Your session expired — sign in again." :
          res.status === 429 ? "Too many runs — try again shortly." :
          json.error === "no_evidence" ? "No reviewed evidence to interrogate yet." :
          json.message ?? json.error ?? `Error ${res.status}`,
        );
        return;
      }
      const sl = json.sessionLens as SessionLens;
      setLens(sl);
      setStubbed(json.source === "stub");
      setTruncated(Boolean(json.truncated));
      onApplyLens(sl.adjustedSliders);
      setState("idle");
      setOpen(false);
    } catch {
      setState("error");
      setError("Network error — check your connection.");
    }
  }

  const topDeltas = lens
    ? [...lens.domainLens]
        .filter((d) => Math.abs(d.weightDelta) >= 0.005 || d.decisive)
        .sort((a, b) => Math.abs(b.weightDelta) - Math.abs(a.weightDelta))
        .slice(0, 6)
    : [];

  // "Ask the vendor" — decisive-but-thin domains, unioned across in-scope vendors.
  const askDomains = lens
    ? [...new Set(lens.vendorLens.flatMap((v) => v.weakDecisiveDomains))]
    : [];

  return (
    <div className={`${CARD} mb-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className={KICKER}>Interrogate — re-run through your context</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-[#d6c9a8] px-3 py-1 text-xs font-medium text-[#4c5d75] hover:bg-white dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0c2238]"
        >
          {open ? "Hide" : lens ? "Refine context & re-run" : "Add your context"}
        </button>
      </div>

      {!open && !lens && (
        <p className="mt-1 text-xs leading-5 text-[#3f5068] dark:text-[#a7bacd]">
          Tell the assessment what it can’t know — incumbents, a renewal clock, region, your regulatory bar — and it
          re-weights the domains your situation makes decisive. The 0–5 evidence scores never change; only their
          emphasis does. Draft — you pressure-test it.
        </p>
      )}

      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-[11px]">
                <span className="text-[#3f5068] dark:text-[#a7bacd]">{f.label}</span>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-0.5 w-full rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs text-[#13294b] placeholder:text-[#9aa7b8] focus:border-[#b08d2f] focus:outline-none dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
                />
              </label>
            ))}
          </div>
          <label className="mt-2 block text-[11px]">
            <span className="text-[#3f5068] dark:text-[#a7bacd]">Anything else</span>
            <textarea
              value={form.freeform}
              onChange={(e) => setForm((s) => ({ ...s, freeform: e.target.value }))}
              rows={2}
              placeholder="Free-text: the constraints, priorities, or deal context that matter most."
              className="mt-0.5 w-full rounded-md border border-[#d6c9a8] bg-white/80 px-2 py-1 text-xs text-[#13294b] placeholder:text-[#9aa7b8] focus:border-[#b08d2f] focus:outline-none dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8]"
            />
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={state === "loading" || !hasAnyContext(form)}
              onClick={run}
              className="rounded-full bg-[#b08d2f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#987625] disabled:opacity-40 dark:bg-[#d4af37] dark:text-[#1a1605] dark:hover:bg-[#c39f2f]"
            >
              {state === "loading" ? "Re-running…" : "Re-run through my context"}
            </button>
            {!hasAnyContext(form) && (
              <span className="text-[11px] text-[#7a8aa0]">Add at least one detail to re-run.</span>
            )}
            {state === "error" && <span className="text-[11px] text-rose-600 dark:text-rose-400">{error}</span>}
          </div>
        </div>
      )}

      {/* Result — a DRAFT explanation of what the context changed. */}
      {lens && (
        <div className="mt-3 border-t border-[#e3d9c0] pt-3 dark:border-[#2a4a6b]">
          {stubbed || lens.insufficientContext ? (
            <p className="text-[11px] leading-5 text-[#7a8aa0]">
              {lens.overallNote} <span className="italic">Default weighting shown — nothing was re-weighted.</span>
            </p>
          ) : (
            <>
              <p className="text-xs leading-5 text-[#13294b] dark:text-[#eef3f8]">
                <span className="font-semibold">Draft — what your context changed:</span> {lens.overallNote}
              </p>
              {topDeltas.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {topDeltas.map((d) => (
                    <li key={d.domain} className="text-[11px] leading-5 text-[#3f5068] dark:text-[#a7bacd]">
                      <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{DOMAIN_LABEL[d.domain]}</span>{" "}
                      <span
                        className={
                          d.weightDelta > 0
                            ? "font-mono text-emerald-700 dark:text-emerald-300"
                            : d.weightDelta < 0
                              ? "font-mono text-rose-600 dark:text-rose-400"
                              : "font-mono text-[#7a8aa0]"
                        }
                      >
                        {d.weightDelta > 0 ? "+" : ""}{Math.round(d.weightDelta * 100)}%
                      </span>
                      {d.decisive && (
                        <span className="ml-1 rounded bg-[#d4af37]/25 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a07f1f] dark:text-[#d4af37]">
                          decisive
                        </span>
                      )}
                      {d.rationale && <span> — {d.rationale}</span>}
                      {d.citations.map((c) => (
                        <a
                          key={c.sourceUrl}
                          href={c.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-sky-700 hover:underline dark:text-sky-400"
                        >
                          ({c.evidenceGrade} · source)
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              )}

              {askDomains.length > 0 && (
                <div className="mt-2 rounded-md border border-[#d6c9a8] bg-white/50 px-2.5 py-2 dark:border-[#2a4a6b] dark:bg-[#0c2238]/40">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a07f1f] dark:text-[#d4af37]">
                    Ask the vendor — decisive for you, thin on evidence
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-[#3f5068] dark:text-[#a7bacd]">
                    {askDomains.map((d) => DOMAIN_LABEL[d]).join(", ")}. We couldn’t evidence{" "}
                    {askDomains.length === 1 ? "this" : "these"} to your bar — take{" "}
                    {askDomains.length === 1 ? "it" : "them"} to the vendor rather than assume a score.
                  </p>
                </div>
              )}

              {truncated && (
                <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">
                  Large shortlist — this lens was computed over the first {60} vendors; narrow the category for full
                  per-vendor coverage.
                </p>
              )}
              <p className="mt-2 text-[10px] italic text-[#7a8aa0]">
                A draft lens over the cited evidence — not a verdict. The 0–5 scores are unchanged; only their weight
                is. Refine your context and re-run to pressure-test it.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
