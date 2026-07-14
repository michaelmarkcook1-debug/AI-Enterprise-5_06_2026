import { Panel } from "@/components/intelligence-ui";

// Financial profile — honest by construction. Most frontier AI labs are private
// with NO disclosed revenue, so we never print a revenue number we can't source.
// We show: ownership, the revenue-disclosure status that follows from it, and the
// sourced capital/funding/valuation signals the platform actually holds
// (investorRelationships on the entity) — labelled as analyst-sourced context,
// not audited financials.

const MUTED = "text-[#54647a] dark:text-[#a7bacd]";

export default function FinancialsPanel({
  ownership,
  capitalSignals,
  evidenceGrade,
  dataCaveats,
  vendorName,
}: {
  ownership: string;
  capitalSignals: string[];
  evidenceGrade?: string;
  dataCaveats?: string;
  vendorName: string;
}) {
  // Ownership is a 3-value enum (public | private | subsidiary). A subsidiary of
  // a public parent is NOT "privately held" and its revenue may be in the
  // parent's filings — so we never collapse it into the private branch.
  const kind = ownership.toLowerCase();
  const badge = kind === "public" ? "Publicly traded" : kind === "subsidiary" ? "Subsidiary" : "Privately held";
  const signals = capitalSignals.filter((s) => s && s.trim().length > 0);

  return (
    <Panel title="Financial profile">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#e9e0c8] bg-white px-2 py-0.5 text-xs font-medium text-[#123d2c] dark:border-[#223a2e] dark:bg-[#0d1f17]/60 dark:text-[#eef3f8]">
          {badge}
        </span>
        {evidenceGrade && (
          <span className={`rounded-full border border-[#e9e0c8] px-2 py-0.5 text-xs dark:border-[#223a2e] ${MUTED}`}>
            Evidence {evidenceGrade}
          </span>
        )}
      </div>

      <p className={`mt-3 text-sm ${MUTED}`}>
        {kind === "public" ? (
          <>
            {vendorName} is publicly traded — revenue and margins are disclosed in its regulatory
            filings. We do not restate them here; figures should be read from the primary filings.
          </>
        ) : kind === "subsidiary" ? (
          <>
            {vendorName} is a subsidiary — its financials may be consolidated into its parent&apos;s
            filings (e.g. acquisition consideration or segment data) and are{" "}
            <strong className="text-[#123d2c] dark:text-[#eef3f8]">not separately disclosed here</strong>.
            What we can source is its capital position.
          </>
        ) : (
          <>
            {vendorName} is privately held — <strong className="text-[#123d2c] dark:text-[#eef3f8]">revenue is not publicly disclosed</strong>.
            We report that absence rather than estimate a number. What we can source is its capital
            position.
          </>
        )}
      </p>

      <div className="mt-3">
        <div className={`mb-1 text-xs font-semibold uppercase tracking-wider ${MUTED}`}>Capital &amp; funding signals</div>
        {signals.length === 0 ? (
          <p className={`text-sm ${MUTED}`}>No sourced capital signals on file.</p>
        ) : (
          <ul className="space-y-1.5">
            {signals.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#123d2c] dark:text-[#eef3f8]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium">
        Capital signals are analyst-sourced context — not audited financials
      </p>
      {dataCaveats && <p className={`mt-2 text-xs leading-4 ${MUTED}`}>{dataCaveats}</p>}
    </Panel>
  );
}
