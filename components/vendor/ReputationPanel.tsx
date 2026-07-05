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

type Grade = "seed" | "documented" | "verified";
const RANK: Record<Grade, number> = { seed: 1, documented: 2, verified: 3 };

// A pillar's row-level dataStatus is "seed" even when individual cells were
// fetched live (cellStatus), so the badge must reflect the BEST real grade among
// its cells — otherwise verified-live signals read as "curated", contradicting
// the "live signals" caption. Honest direction: surface the strongest evidence.
function effectiveStatus(dataStatus: Grade, cellStatus?: Partial<Record<string, Grade>>): Grade {
  let best: Grade = dataStatus ?? "seed";
  if (cellStatus) {
    for (const v of Object.values(cellStatus)) {
      if (v && RANK[v] > RANK[best]) best = v;
    }
  }
  return best;
}

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

/** The Sources & independence disclosure — genuinely live (connector health +
 *  a fixed policy statement), never seed-derived. Rendered regardless of
 *  whether pillar-level reputation data is present, so a vendor with zero
 *  reputation evidence still gets an honest, non-empty panel. */
function SourcesFooter({ reviewSources }: { reviewSources?: { configured: boolean; contributing: boolean } }) {
  return (
    <div className="mt-3 rounded-lg border border-[#e9e0c8] bg-[#faf6ec] p-2.5 dark:border-[#1d3a57] dark:bg-[#0c2238]/40">
      <p className={`text-[11px] leading-4 ${MUTED}`}>
        <span className="font-semibold text-[#13294b] dark:text-[#d8e2ec]">Sources: </span>
        reputation blends developer, employee and customer signals from public and operational
        evidence.{" "}
        {reviewSources?.contributing ? (
          <>Dedicated customer-review platforms (G2 · TrustRadius · Trustpilot) are connected and contributing.</>
        ) : reviewSources?.configured ? (
          <>A customer-review provider key is set, but the fetch adapter is not wired yet — those ratings are <span className="font-medium">not yet contributing</span>.</>
        ) : (
          <>Dedicated customer-review platforms (G2 · TrustRadius · Trustpilot) are <span className="font-medium">not connected</span> — they need paid partner APIs, so customer reputation here is provisional until licensed. No scraping, no estimated ratings.</>
        )}
      </p>
      <p className={`mt-1.5 text-[11px] leading-4 ${MUTED}`}>
        <span className="font-semibold text-[#13294b] dark:text-[#d8e2ec]">Independence: </span>
        analyst-house recognition (Gartner · Forrester · IDC) is deliberately <span className="font-medium">excluded</span> as a
        scored reputation signal. This tracker is the independent alternative to the paywalled
        houses — it does not launder their verdicts into a score.
      </p>
    </div>
  );
}

export default function ReputationPanel({
  reputation,
  vendorName,
  reviewSources,
}: {
  reputation: VendorReputation;
  vendorName: string;
  /** Live status of the paid customer-review connector (G2/TrustRadius/Trustpilot). */
  reviewSources?: { configured: boolean; contributing: boolean };
}) {
  if (!reputation.hasData) {
    return (
      <Panel title="Reputation">
        <p className={`text-sm ${MUTED}`}>
          Insufficient verified reputation evidence for {vendorName} yet. We report the absence of
          data rather than estimate it.
        </p>
        <SourcesFooter reviewSources={reviewSources} />
      </Panel>
    );
  }

  const { developer: d, employee: e, customer: c, combined, asOf } = reputation;

  // Effective per-pillar grades (best real evidence among cells), and the
  // composite's worst-case grade — the combined blends seed + live, so it can
  // only honestly claim its weakest contributor.
  const devStatus = d ? effectiveStatus(d.dataStatus, d.cellStatus) : null;
  const empStatus = e ? effectiveStatus(e.dataStatus, e.cellStatus) : null;
  const cusStatus = c ? c.dataStatus : null;
  const present = [devStatus, empStatus, cusStatus].filter((s): s is Grade => s !== null);
  const combinedGrade: Grade = present.reduce<Grade>(
    (worst, s) => (RANK[s] < RANK[worst] ? s : worst),
    "verified",
  );

  return (
    <Panel title="Reputation">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold tabular-nums ${combined !== null ? scoreTone(combined) : ""}`}>
            {combined ?? "—"}
          </span>
          {present.length > 0 && <Badge status={combinedGrade} />}
          <span className={`text-xs ${MUTED}`}>combined reputation (developer · employee · customer)</span>
        </div>
        <span className={`text-[11px] ${MUTED}`}>
          {present.length}/3 pillars · {asOf ? `live signals to ${asOf}` : "curated, no live fetch yet"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {d && devStatus && (
          <Pillar
            label="Developer"
            overall={d.overall}
            status={devStatus}
            metrics={[
              { k: "GitHub", v: d.githubScore },
              { k: "Forum", v: d.forumScore },
              { k: "Docs", v: d.documentationScore },
              { k: "API", v: d.apiReliability },
            ]}
            themes={d.primaryThemes}
          />
        )}
        {e && empStatus && (
          <Pillar
            label="Employee"
            overall={e.overall}
            status={empStatus}
            metrics={[
              { k: "Culture", v: e.culture },
              { k: "WLB", v: e.workLifeBalance },
              { k: "Comp", v: e.compensation },
              { k: "Litig.", v: e.litigationScore },
            ]}
            themes={e.primaryThemes}
          />
        )}
        {c && cusStatus && (
          <Pillar
            label="Customer"
            overall={c.overall}
            status={cusStatus}
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

      <SourcesFooter reviewSources={reviewSources} />
    </Panel>
  );
}
