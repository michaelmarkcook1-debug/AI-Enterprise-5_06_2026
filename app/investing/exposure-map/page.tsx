import { PageFrame } from "@/components/app-shell";
import { Panel } from "@/components/intelligence-ui";
import { getInvestmentProvider, listIndirectExposureScores } from "@/lib/investing/intelligence";
import { WarningStrip } from "../investing-ui";

export const dynamic = "force-dynamic";

// SVG node-link visualisation of public/private indirect-exposure edges.
// Public tickers anchor on the left; private providers on the right; edge
// thickness scales with exposureStrength times revenueLinkage; opacity with confidence.

interface NodePos { x: number; y: number; label: string; ticker?: string; isPublic: boolean }

export default function ExposureMapPage() {
  const exposures = listIndirectExposureScores();

  const publicTickers = Array.from(new Set(exposures.map((e) => e.publicTicker))).sort();
  const privateIds = Array.from(new Set(exposures.map((e) => e.privateProviderId))).sort();

  const W = 880;
  const H = 60 + Math.max(publicTickers.length, privateIds.length) * 56;

  const publicNodes: Record<string, NodePos> = {};
  publicTickers.forEach((ticker, i) => {
    publicNodes[ticker] = { x: 140, y: 60 + i * 56, label: ticker, ticker, isPublic: true };
  });
  const privateNodes: Record<string, NodePos> = {};
  privateIds.forEach((id, i) => {
    const p = getInvestmentProvider(id);
    privateNodes[id] = { x: W - 140, y: 60 + i * 56, label: p?.name ?? id, isPublic: false };
  });

  return (
    <PageFrame
      title="Indirect exposure map"
      kicker="Public to private linkage"
      description="How public companies provide indirect exposure to private AI providers. Edge thickness = strength times revenue linkage; opacity = confidence; dilution penalty in tooltip."
    >
      <WarningStrip />

      <Panel title="Indirect exposure network">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="text-[#18201b] dark:text-zinc-100">
            <text x={140} y={28} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-wider">Public ticker</text>
            <text x={W - 140} y={28} textAnchor="middle" className="fill-current text-[11px] font-semibold uppercase tracking-wider">Private AI provider</text>

            {exposures.map((e) => {
              const a = publicNodes[e.publicTicker];
              const b = privateNodes[e.privateProviderId];
              if (!a || !b) return null;
              const score = e.indirectExposureScore ?? 0;
              const stroke = 1 + (e.exposureStrength * e.revenueLinkage * 7);
              const opacity = 0.25 + e.confidence * 0.7;
              const colour = score >= 50 ? "#2f5d50" : score >= 30 ? "#7d8a5c" : "#b9a55a";
              const cx = (a.x + b.x) / 2;
              return (
                <g key={`${e.publicTicker}-${e.privateProviderId}`}>
                  <title>
                    {`${e.publicTicker} to ${e.privateProviderId}\n${e.exposureType}\nscore ${score.toFixed(0)} | strength ${e.exposureStrength.toFixed(2)} | linkage ${e.revenueLinkage.toFixed(2)} | confidence ${e.confidence.toFixed(2)} | dilution ${e.dilutionPenalty.toFixed(2)}`}
                  </title>
                  <path d={`M ${a.x + 14} ${a.y} C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x - 14} ${b.y}`}
                    fill="none" stroke={colour} strokeWidth={stroke} strokeOpacity={opacity} />
                </g>
              );
            })}

            {Object.values(publicNodes).map((n) => (
              <g key={`p-${n.label}`} transform={`translate(${n.x},${n.y})`}>
                <rect x={-50} y={-16} width={100} height={32} rx={6}
                  className="fill-emerald-50 stroke-emerald-400 dark:fill-emerald-950 dark:stroke-emerald-700" strokeWidth={1} />
                <text textAnchor="middle" dy={5} className="fill-current text-[12px] font-semibold font-mono">{n.label}</text>
              </g>
            ))}
            {Object.values(privateNodes).map((n) => (
              <g key={`q-${n.label}`} transform={`translate(${n.x},${n.y})`}>
                <rect x={-90} y={-16} width={180} height={32} rx={6}
                  className="fill-violet-50 stroke-violet-400 dark:fill-violet-950 dark:stroke-violet-700" strokeWidth={1} />
                <text textAnchor="middle" dy={5} className="fill-current text-[11px]">{n.label}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          {exposures.map((e) => (
            <div key={`${e.publicTicker}-${e.privateProviderId}`} className="rounded-lg border border-[#dfe4da] p-3 dark:border-zinc-800">
              <div className="font-semibold">{e.publicTicker} to {getInvestmentProvider(e.privateProviderId)?.name ?? e.privateProviderId}</div>
              <div className="mt-1 text-[#66705f]">{e.exposureType}</div>
              <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px]">
                <span>strength {e.exposureStrength.toFixed(2)}</span>
                <span>linkage {e.revenueLinkage.toFixed(2)}</span>
                <span>confidence {e.confidence.toFixed(2)}</span>
                <span className="text-rose-700 dark:text-rose-400">dilution {e.dilutionPenalty.toFixed(2)}</span>
              </div>
              <div className="mt-1 font-mono">score {(e.indirectExposureScore ?? 0).toFixed(0)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
