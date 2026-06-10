import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel } from "@/components/intelligence-ui";
import { listInvestmentProviderScores, isWatchlistOnly } from "@/lib/investing/intelligence";
import { WarningStrip, label } from "../investing-ui";

export const dynamic = "force-dynamic";

export default function InvestmentWatchlistPage() {
  const all = listInvestmentProviderScores();
  const ipoWatch = all.filter((row) => row.provider.investabilityStatus === "ipo_watch");
  const private_ = all.filter((row) =>
    row.provider.investabilityStatus === "private_inaccessible"
    || row.provider.investabilityStatus === "accredited_only"
    || row.provider.investabilityStatus === "not_legitimately_accessible",
  );
  const indirect = all.filter((row) => row.provider.investabilityStatus === "etf_indirect" || row.provider.investabilityStatus === "public_indirect");

  return (
    <PageFrame
      title="Investment watchlist"
      kicker="Track, don't trade"
      description="Track providers, IPO rumours, and indirect exposures. No buy/sell instructions; confidence and access discipline first."
    >
      <WarningStrip />

      <Panel title="IPO watch">
        <Section rows={ipoWatch} />
      </Panel>
      <Panel title="Private (watchlist only)">
        <Section rows={private_} />
      </Panel>
      <Panel title="Indirect / ETF exposures">
        <Section rows={indirect} />
      </Panel>
    </PageFrame>
  );
}

function Section({ rows }: { rows: ReturnType<typeof listInvestmentProviderScores> }) {
  if (rows.length === 0) {
    return <p className="text-xs text-[#5d6b80]">Nothing tracked in this segment yet.</p>;
  }
  return (
    <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
      {rows.sort((a, b) => b.privateIpoInvestmentPotential - a.privateIpoInvestmentPotential).map((row) => (
        <Link key={row.provider.id} href={`/investor-tools/provider/${row.provider.slug}`} className="grid grid-cols-[1fr_120px_180px] items-center gap-3 py-3 text-sm hover:bg-[#faf5e9] dark:hover:bg-[#0c2238]/40">
          <span>
            <span className="font-medium">{row.provider.name}</span>
            <span className="ml-2 text-[11px] text-[#5d6b80]">{label(row.provider.exposureClass)}</span>
            {isWatchlistOnly(row.provider) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">Watchlist only</span>}
          </span>
          <span className="text-right font-mono">{row.privateIpoInvestmentPotential.toFixed(0)} potential</span>
          <Confidence value={row.provider.evidenceConfidence} />
        </Link>
      ))}
    </div>
  );
}
