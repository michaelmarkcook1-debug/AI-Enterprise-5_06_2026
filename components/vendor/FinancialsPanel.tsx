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
  const isPublic = ownership.toLowerCase() === "public";
  const signals = capitalSignals.filter((s) => s && s.trim().length > 0);

  return (
    <Panel title="Financial profile">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#e9e0c8] bg-white px-2 py-0.5 text-[11px] font-medium text-[#13294b] dark:border-[#1d3a57] dark:bg-[#0c2238]/60 dark:text-[#eef3f8]">
          {isPublic ? "Publicly traded" : "Privately held"}
        </span>
        {evidenceGrade && (
          <span className={`rounded-full border border-[#e9e0c8] px-2 py-0.5 text-[11px] dark:border-[#1d3a57] ${MUTED}`}>
            Evidence {evidenceGrade}
          </span>
        )}
      </div>

      <p className={`mt-3 text-sm ${MUTED}`}>
        {isPublic ? (
          <>
            {vendorName} is publicly traded — revenue and margins are disclosed in its regulatory
            filings. We do not restate them here; figures should be read from the primary filings.
          </>
        ) : (
          <>
            {vendorName} is privately held — <strong className="text-[#13294b] dark:text-[#eef3f8]">revenue is not publicly disclosed</strong>.
            We report that absence rather than estimate a number. What we can source is its capital
            position.
          </>
        )}
      </p>

      <div className="mt-3">
        <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${MUTED}`}>Capital &amp; funding signals</div>
        {signals.length === 0 ? (
          <p className={`text-sm ${MUTED}`}>No sourced capital signals on file.</p>
        ) : (
          <ul className="space-y-1.5">
            {signals.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#13294b] dark:text-[#eef3f8]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium">
        Capital signals are analyst-sourced context — not audited financials
      </p>
      {dataCaveats && <p className={`mt-2 text-[11px] leading-4 ${MUTED}`}>{dataCaveats}</p>}
    </Panel>
  );
}
