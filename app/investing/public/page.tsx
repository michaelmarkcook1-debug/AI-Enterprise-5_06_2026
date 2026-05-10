import Link from "next/link";
import { PageFrame } from "@/components/app-shell";
import { Confidence, Panel } from "@/components/intelligence-ui";
import { listInvestmentProviderScores } from "@/lib/investing/intelligence";
import { WarningStrip, label } from "../investing-ui";

export const dynamic = "force-dynamic";

export default function PublicAiStocksPage() {
  const rows = listInvestmentProviderScores().filter((row) =>
    row.provider.investabilityStatus === "public_direct"
    || row.provider.investabilityStatus === "public_indirect"
    || row.provider.investabilityStatus === "etf_indirect",
  );

  return (
    <PageFrame
      title="Public AI stocks"
      kicker="Public direct + indirect rankings"
      description="Public direct + indirect AI exposure with provider quality, attractiveness, horizon scores, and valuation discipline. Ranked under this model, not investment advice."
    >
      <WarningStrip />

      <Panel title="Public AI provider universe">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#dfe4da] dark:border-zinc-800 text-left uppercase tracking-wide text-[10px] text-[#697362] dark:text-zinc-500">
              <tr>
                <th className="py-2 pr-2">Provider</th>
                <th className="py-2 pr-2">Ticker</th>
                <th className="py-2 pr-2">Exposure</th>
                <th className="py-2 pr-2 text-right">Quality</th>
                <th className="py-2 pr-2 text-right">Attractiveness</th>
                <th className="py-2 pr-2 text-right">Short-term</th>
                <th className="py-2 pr-2 text-right">Long-term</th>
                <th className="py-2 pr-2 text-right">Speculative</th>
                <th className="py-2 pr-2 text-right">Valuation risk</th>
                <th className="py-2 pr-2">Confidence</th>
                <th className="py-2 pr-2">Main risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.sort((a, b) => b.consumerInvestmentPotential - a.consumerInvestmentPotential).map((row) => (
                <tr key={row.provider.id} className="border-b border-[#edf0ea] dark:border-zinc-900 hover:bg-[#f5f7f2] dark:hover:bg-zinc-900/40">
                  <td className="py-2 pr-2">
                    <Link href={`/investor-tools/provider/${row.provider.slug}`} className="font-medium hover:underline">
                      {row.provider.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 font-mono">{row.provider.ticker ?? "n/a"}</td>
                  <td className="py-2 pr-2 text-[#66705f]">{label(row.provider.exposureClass)}</td>
                  <td className="py-2 pr-2 text-right font-mono">{row.aiProviderQualityScore.toFixed(0)}</td>
                  <td className="py-2 pr-2 text-right font-mono">{row.investmentAttractivenessScore.toFixed(0)}</td>
                  <td className="py-2 pr-2 text-right font-mono">{row.provider.shortTermCatalystScore}</td>
                  <td className="py-2 pr-2 text-right font-mono">{row.provider.longTermHoldScore}</td>
                  <td className="py-2 pr-2 text-right font-mono">{row.provider.speculativeUpsideScore}</td>
                  <td className="py-2 pr-2 text-right font-mono text-rose-700 dark:text-rose-400">{row.provider.valuationRiskScore}</td>
                  <td className="py-2 pr-2"><Confidence value={row.provider.evidenceConfidence} /></td>
                  <td className="py-2 pr-2 text-[#66705f] max-w-[260px] truncate" title={row.provider.mainRisk}>{row.provider.mainRisk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageFrame>
  );
}
