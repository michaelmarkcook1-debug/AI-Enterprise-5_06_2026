/**
 * Manifest patches panel — read-only list of URL-finder agent proposals.
 *
 * Each row shows: vendor + dead URL → candidate URL, confidence, agent
 * rationale, retry status. Operator can copy the candidate URL to update
 * lib/sourcing/manifest.ts manually. Approve/reject endpoints are wired
 * separately at /api/admin/manifest-patches.
 */

type PatchRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  deadUrl: string;
  httpStatus: number;
  candidateUrl: string;
  candidateTitle: string;
  confidenceScore: number;
  rationale: string;
  citations: string[];
  searchesUsed: number;
  retryAttempted: boolean;
  retryOk: boolean | null;
  status: string;
  createdAt: string;
};

export default function ManifestPatchesPanel({ patches }: { patches: PatchRow[] }) {
  if (patches.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Manifest patches (URL-repair agent)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No pending patches. The URL-repair agent fires automatically when an ingest
          run hits an HTTP 4xx — proposed replacements appear here for review.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Manifest patches (URL-repair agent)</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {patches.length} pending replacement{patches.length === 1 ? "" : "s"} found by Claude + web search after ingest 4xx errors. Apply by editing <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">lib/sourcing/manifest.ts</code> with the candidate URL, then re-run ingest.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {patches.filter((p) => p.confidenceScore >= 75).length} high-confidence (≥75)
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {patches.filter((p) => p.retryOk === true).length} auto-retry succeeded
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {patches.filter((p) => p.confidenceScore < 75).length} need review
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {patches.map((p) => {
          const conf = p.confidenceScore;
          const tone = conf >= 90 ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
            : conf >= 75 ? "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20"
            : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20";
          return (
            <article key={p.id} className={`rounded-md border p-4 ${tone}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{p.vendorName}</span>
                    <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                      {p.category.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                      HTTP {p.httpStatus}
                    </span>
                    {p.retryOk === true && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        auto-retry succeeded
                      </span>
                    )}
                    {p.retryOk === false && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        retry failed
                      </span>
                    )}
                    {!p.retryAttempted && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        no auto-retry (confidence &lt; 75)
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="font-mono break-all line-through opacity-60">{p.deadUrl}</div>
                    <div className="font-mono break-all">↳ <a href={p.candidateUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300">{p.candidateUrl}</a></div>
                  </div>
                  <div className="mt-2 text-xs italic text-zinc-600 dark:text-zinc-400">{p.candidateTitle}</div>
                  <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{p.rationale}</p>
                  {p.citations.length > 0 && (
                    <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-500">
                      Cited:{" "}
                      {p.citations.map((c, i) => (
                        <span key={c}>
                          <a href={c} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-900 dark:hover:text-zinc-200">{shortHost(c)}</a>
                          {i < p.citations.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">Confidence</div>
                  <div className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{conf}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">{p.searchesUsed} web searches</div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function shortHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url.slice(0, 32); }
}
