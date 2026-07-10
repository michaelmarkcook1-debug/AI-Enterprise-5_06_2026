// Legislative / regulatory tracker — the net-new "4th launch module".
// Public, static reference surface: a curated, cited register of enterprise-AI
// instruments, filterable by jurisdiction + sector, each tied to the assessment
// domains it touches. No DB, no LLM at request time — pure curated data, so this
// stays in the lean public shell and statically generates.
import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import {
  LEGISLATIVE_DISCLAIMER,
  REGISTER_STATUS,
  STATUS_LABEL,
  JURISDICTION_LABEL,
} from "@/lib/legislative/instruments";
import {
  listInstruments,
  jurisdictionsPresent,
  verticalsPresent,
  recentlyUpdated,
} from "@/lib/legislative/registry";
import LegislationClient from "./LegislationClient";

const TITLE = "AI legislation & regulation tracker";
const DESCRIPTION =
  "A curated, source-cited register of the legislative and regulatory instruments shaping enterprise AI — EU AI Act, US federal and state law, UK and sector rules — filterable by jurisdiction and sector, and tied to the assessment domains each one touches. We track and cite; not legal advice.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/legislation" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/legislation"), type: "website" },
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function LegislationPage() {
  const instruments = listInstruments();
  const jurisdictions = jurisdictionsPresent();
  const verticals = verticalsPresent();
  const updates = recentlyUpdated(4);
  const lastVerified = instruments.map((i) => i.asOf).sort().at(-1) ?? null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#b08d2f] dark:text-[#d4af37]">
          Regulatory intelligence
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-3xl font-extrabold tracking-tight">
          AI legislation &amp; regulation
        </h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
          The instruments a CIO&apos;s risk and audit functions are tracking — cited to primary sources, tied to the
          assessment domains they touch. Filter by jurisdiction and sector.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200">
            {REGISTER_STATUS}
          </span>
          {lastVerified && <span className={MUTED}>Register last verified {fmtDate(lastVerified)}</span>}
        </div>
      </header>

      {/* Standing "not legal advice" disclaimer — non-negotiable. */}
      <div className="mb-5 rounded-lg border border-[#e3d9c0] bg-[#fbf7ec] px-4 py-3 text-xs leading-5 text-[#5b4b1f] dark:border-[#3a3218] dark:bg-[#171200] dark:text-[#d3c193]">
        <strong>Not legal advice.</strong> {LEGISLATIVE_DISCLAIMER.replace(/^We track/, "we track")}
      </div>

      {instruments.length === 0 ? (
        <div className="rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
          <p className="text-sm">
            The register is being compiled. We publish an instrument only once its status, dates and primary-source
            citation are verified — an empty register rather than an unsourced one.
          </p>
        </div>
      ) : (
        <>
          {/* Updates feed — "Market Today" pattern for law/reg: most recently verified. */}
          {updates.length > 0 && (
            <section className="mb-5 rounded-xl border border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5">
              <h2 className="text-sm font-semibold">Recently verified</h2>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {updates.map((u) => (
                  <li key={u.id} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{u.shortName}</span>
                      <span className={MUTED}> · {JURISDICTION_LABEL[u.jurisdiction]} · {STATUS_LABEL[u.status]}</span>
                    </span>
                    <span className={`shrink-0 tabular-nums text-[10px] ${MUTED}`}>{fmtDate(u.asOf)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LegislationClient instruments={instruments} jurisdictions={jurisdictions} verticals={verticals} />
        </>
      )}

      <p className={`mt-6 text-[11px] leading-5 ${MUTED}`}>
        Framework anchors (NIST AI RMF, ISO/IEC 42001, EU AI Act articles) are shared with the{" "}
        <Link href="/insights" className="underline underline-offset-2 hover:no-underline">
          methodology crosswalk
        </Link>
        . We do not score vendors on regulatory status, and we treat no analyst-house commentary as a scored signal.
      </p>
    </main>
  );
}
