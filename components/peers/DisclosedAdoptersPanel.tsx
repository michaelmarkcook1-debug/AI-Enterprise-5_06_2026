import Link from "next/link";
import type { DisclosedAdopter } from "@/lib/peer/adopters";

// "Disclosed enterprise adopters" — the demand side of a vendor's assessment.
// Server-safe (pure props). Curated, cited reference data with its provenance
// label, in the same class as Implementation partners: it renders regardless
// of the score gating and has no path into scores.

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default function DisclosedAdoptersPanel({
  vendorName,
  adopters,
}: {
  vendorName: string;
  adopters: DisclosedAdopter[];
}) {
  if (adopters.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className={`text-xs ${MUTED}`}>
          Enterprises that have publicly disclosed adopting {vendorName} — from the cited
          peer-AI benchmark. Disclosure only: absence here never means non-use.
        </p>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Analyst-curated
        </span>
      </div>
      <ul className="space-y-3">
        {adopters.map((a) => (
          <li key={a.company.id} className="rounded-lg border border-black/5 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{a.company.name}</span>
              <span className={`text-[11px] ${MUTED}`}>{a.company.industry}</span>
            </div>
            {a.summary && <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{a.summary}</p>}
            <ul className={`mt-1.5 space-y-0.5 text-[11px] ${MUTED}`}>
              {a.citations.map((c) => (
                <li key={c.url}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-[#15263c] dark:hover:text-[#eef3f8]"
                  >
                    {c.title}
                  </a>{" "}
                  — {c.publisher}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className={`mt-2 text-[11px] ${MUTED}`}>
        <Link href="/peers" className="underline underline-offset-2">
          Benchmark your organisation against these peers →
        </Link>
      </p>
    </div>
  );
}
