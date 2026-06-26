import { Panel } from "@/components/intelligence-ui";
import type { VendorReputation } from "@/lib/reputation/vendor-reputation";

// Current reputation composite + per-pillar breakdown. Each pillar carries its
// own dataStatus (verified = live API, documented = partial real, seed =
// curated) so the reader knows what is measured vs estimated. The historical
// LINE is on the Score-history chart and accrues forward only.

const STATUS: Record<string, { label: string; cls: string }> = {
  verified: { label: "verified", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  documented: { label: "documented", cls: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  seed: { label: "curated", cls: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200" },
};

const MUTED = "text-[#54647a] dark:text-[#a7bacd]";

function Badge({ status }: { status: "seed" | "documented" | "verified" }) {
  const s = STATUS[status] ?? STATUS.seed;
  return <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

function scoreTone(v: number) {
  return v >= 75 ? "text-emerald-700 dark:text-emerald-300" : v >= 55 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300";
}

function Pillar({
  label,
  overall,
  status,
  metrics,
  themes,
}: {
  label: string;
  overall: number;
  status: "seed" | "documented" | "verified";
  metrics: { k: string; v: number | string }[];
  themes: string[];
}) {
  return (
    <div className="rounded-lg border border-[#e9e0c8] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]/50">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{label}</span>
        <span className="flex items-center gap-2">
          <Badge status={status} />
          <span className={`font-mono text-lg font-bold tabular-nums ${scoreTone(overall)}`}>{overall}</span>
        </span>
      </div>
      <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-wide ${MUTED}`}>
        {metrics.map((m) => (
          <span key={m.k}>{m.k} <span className="font-mono tabular-nums text-[#13294b] dark:text-[#eef3f8]">{m.v}</span></span>
        ))}
      </div>
      {themes.length > 0 && <p className={`mt-2 text-[11px] leading-4 ${MUTED}`}>{themes.slice(0, 2).join(" · ")}</p>}
    </div>
  );
}

export default function ReputationPanel({
  reputation,
  vendorName,
}: {
  reputation: VendorReputation;
  vendorName: string;
}) {
  if (!reputation.hasData) {
    return (
      <Panel title="Reputation">
        <p className={`text-sm ${MUTED}`}>
          Insufficient verified reputation evidence for {vendorName} yet. We report the absence of
          data rather than estimate it.
        </p>
      </Panel>
    );
  }

  const { developer: d, employee: e, customer: c, combined, asOf } = reputation;

  return (
    <Panel title="Reputation">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold tabular-nums ${combined !== null ? scoreTone(combined) : ""}`}>
            {combined ?? "—"}
          </span>
          <span className={`text-xs ${MUTED}`}>combined reputation (developer · employee · customer)</span>
        </div>
        <span className={`text-[11px] ${MUTED}`}>{asOf ? `Live signals as of ${asOf}` : "Curated — no live fetch yet"}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {d && (
          <Pillar
            label="Developer"
            overall={d.overall}
            status={d.dataStatus}
            metrics={[
              { k: "GitHub", v: d.githubScore },
              { k: "Forum", v: d.forumScore },
              { k: "Docs", v: d.documentationScore },
              { k: "API", v: d.apiReliability },
            ]}
            themes={d.primaryThemes}
          />
        )}
        {e && (
          <Pillar
            label="Employee"
            overall={e.overall}
            status={e.dataStatus}
            metrics={[
              { k: "Culture", v: e.culture },
              { k: "WLB", v: e.workLifeBalance },
              { k: "Comp", v: e.compensation },
              { k: "Litig.", v: e.litigationScore },
            ]}
            themes={e.primaryThemes}
          />
        )}
        {c && (
          <Pillar
            label="Customer"
            overall={c.overall}
            status={c.dataStatus}
            metrics={[
              { k: "Uptime", v: `${c.averageUptimePct}%` },
              { k: "Value", v: c.valueForMoney },
              { k: "Support", v: c.customerService },
              { k: "Quality", v: c.qualityOfService },
            ]}
            themes={c.primaryThemes}
          />
        )}
      </div>

      <p className={`mt-3 text-[11px] leading-4 ${MUTED}`}>
        A point-in-time composite — each pillar is labelled with its evidence grade. The reputation
        line on the score-history chart tracks this forward from the day capture began (never
        back-filled).
      </p>
    </Panel>
  );
}
