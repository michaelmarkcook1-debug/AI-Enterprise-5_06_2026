"use client";

// Phase 3 Assessment — Wave 4 (C9): vendor-meeting prep-kit panel.
// Member-gated. Generate → POST /api/member/assessment/prep-kit → render the kit
// (8–12 tailored questions grounded in real weak/thin domains + framework RFP /
// POC / reference / readiness templates) with copy + print export. Draft-framed
// (C4). Anonymous visitors see an upsell, never the action.

import { useState } from "react";
import Link from "next/link";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";
import type { PrepKit, KitSection } from "@/lib/assessment/prep-kit";
import { MEMBER_FEATURES_VISIBLE } from "@/lib/availability";

export interface PrepKitConfig {
  enabled: boolean;
  signedIn: boolean;
}

const CARD = "rounded-xl border border-[#2a6f6b]/40 bg-[#eef7f5]/70 p-4 dark:border-[#2a6f6b]/50 dark:bg-[#07201e]/40";
const KICKER = "text-xs font-semibold uppercase tracking-wider text-[#1f6b63] dark:text-[#5ec8bd]";

function kitToText(k: PrepKit): string {
  const secLines = (s: KitSection) => [`\n## ${s.title}`, s.blurb, ...s.items.map((i) => `- ${i}`)].join("\n");
  return [
    `VENDOR-MEETING PREP KIT — ${k.vendorName}`,
    `(Draft — grounded in reviewed evidence + the 12-domain framework. Probes gaps; asserts no vendor facts.)`,
    `\n## Questions to ask (${k.questions.length})`,
    ...k.questions.map((q, i) => `${i + 1}. [${q.domain ? DOMAIN_LABEL[q.domain] : "General"}] ${q.question}${q.rationale ? `\n   why: ${q.rationale}` : ""}`),
    secLines(k.rfp),
    secLines(k.poc),
    secLines(k.referenceBank),
    secLines(k.readiness),
  ].join("\n");
}

function Section({ s }: { s: KitSection }) {
  return (
    <details className="mt-2 rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer select-none text-sm font-semibold">{s.title}</summary>
      <p className="mt-1 text-xs italic text-[#123d2c]/65 dark:text-[#eef3f8]/60">{s.blurb}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
        {s.items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </details>
  );
}

export default function PrepKitPanel({
  config,
  vendorId,
  vendorName,
}: {
  config: PrepKitConfig;
  vendorId: string;
  vendorName: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [kit, setKit] = useState<PrepKit | null>(null);
  const [copied, setCopied] = useState(false);

  if (!config.enabled) return null;

  // With sign-in disabled the upsell would dead-end at /signin — hide it.
  if (!config.signedIn) {
    if (!MEMBER_FEATURES_VISIBLE) return null;
    return (
      <div className={`${CARD} mt-6`}>
        <div className={KICKER}>Vendor-meeting prep kit — premium</div>
        <p className="mt-1 text-xs leading-5 text-[#123d2c]/70 dark:text-[#eef3f8]/70">
          Walk into the {vendorName} meeting with 8–12 questions grounded in their weak and unevidenced domains, plus
          an RFP, POC success criteria, a reference-check bank and a readiness checklist.{" "}
          <Link href="/signin" className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400">
            Sign in to generate the kit
          </Link>
          .
        </p>
      </div>
    );
  }

  async function generate() {
    setState("loading");
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/member/assessment/prep-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ vendorId, vendorName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setError(
          res.status === 401 ? "Your session expired — sign in again." :
          json.error === "no_evidence" ? "No reviewed evidence to build a kit from yet." :
          json.message ?? json.error ?? `Error ${res.status}`,
        );
        return;
      }
      setKit(json.prepKit as PrepKit);
      setState("idle");
    } catch {
      setState("error");
      setError("Network error — check your connection.");
    }
  }

  async function copy() {
    if (!kit) return;
    try {
      await navigator.clipboard.writeText(kitToText(kit));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className={`${CARD} mt-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className={KICKER}>Vendor-meeting prep kit</div>
        <div className="flex items-center gap-2">
          {kit && (
            <>
              <button type="button" onClick={copy} className="rounded-full border border-[#9fc6c0] px-3 py-1 text-xs font-medium text-[#1f6b63] hover:bg-white dark:border-[#2a6f6b] dark:text-[#5ec8bd] dark:hover:bg-[#07201e]">
                {copied ? "Copied ✓" : "Copy"}
              </button>
              <button type="button" onClick={() => window.print()} className="rounded-full border border-[#9fc6c0] px-3 py-1 text-xs font-medium text-[#1f6b63] hover:bg-white dark:border-[#2a6f6b] dark:text-[#5ec8bd] dark:hover:bg-[#07201e]">
                Print / PDF
              </button>
            </>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={state === "loading"}
            className="rounded-full bg-[#1f6b63] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#185852] disabled:opacity-40 dark:bg-[#2a9d90] dark:hover:bg-[#238a7e]"
          >
            {state === "loading" ? "Generating…" : kit ? "Regenerate" : "Generate prep kit"}
          </button>
        </div>
      </div>

      {!kit && state !== "loading" && (
        <p className="mt-1 text-xs leading-5 text-[#123d2c]/70 dark:text-[#eef3f8]/70">
          A take-into-the-meeting kit: questions targeting {vendorName}&rsquo;s weak and unevidenced domains, plus
          RFP / POC / reference / readiness templates. Draft — it probes gaps, it doesn&rsquo;t assert vendor facts.
        </p>
      )}
      {state === "error" && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {kit && (
        <div className="mt-3">
          <p className="text-xs text-[#123d2c]/65 dark:text-[#eef3f8]/60">
            {kit.scoredCount}/12 domains evidenced · {kit.insufficientCount} insufficient ·{" "}
            {kit.targets.weak.length + kit.targets.insufficient.length} gaps targeted
            {kit.targets.contextAdjusted ? " · context-adjusted" : ""}
            {kit.source === "stub" ? " · (model unavailable — deterministic questions)" : ""}
          </p>

          <h3 className="mt-3 text-sm font-semibold">Questions to ask ({kit.questions.length})</h3>
          <ol className="mt-1 space-y-2">
            {kit.questions.map((q, i) => (
              <li key={i} className="text-xs leading-5">
                <span className="font-mono text-[#1f6b63] dark:text-[#5ec8bd]">{i + 1}.</span>{" "}
                <span className="font-medium text-[#123d2c] dark:text-[#eef3f8]">
                  {q.domain ? DOMAIN_LABEL[q.domain] : "General"}
                </span>
                {q.askTheVendor && (
                  <span className="ml-1 rounded bg-[#2a6f6b]/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1f6b63] dark:text-[#5ec8bd]">
                    ask them
                  </span>
                )}
                <div className="mt-0.5 text-[#123d2c]/90 dark:text-[#eef3f8]/90">{q.question}</div>
                {q.rationale && <div className="text-xs text-[#123d2c]/55 dark:text-[#eef3f8]/55">{q.rationale}</div>}
              </li>
            ))}
          </ol>

          <Section s={kit.rfp} />
          <Section s={kit.poc} />
          <Section s={kit.referenceBank} />
          <Section s={kit.readiness} />

          <p className="mt-3 text-xs italic text-[#123d2c]/55 dark:text-[#eef3f8]/55">{kit.draftNote}</p>
        </div>
      )}
    </div>
  );
}
