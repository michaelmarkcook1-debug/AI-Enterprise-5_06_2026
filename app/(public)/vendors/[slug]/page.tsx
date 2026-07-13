// ─────────────────────────────────────────────────────────────────────────────
// Vendor Deep-Dive Profile — app/vendors/[slug]/page.tsx
//
// Server Component. Renders the full profile for a Query-leaderboard entity
// (from ENTITIES in lib/intelligence/entities.ts). No browser APIs used —
// the SVG chart is pure maths + markup so it renders correctly on the server.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

import { ENTITIES, roleLeadership, layerLeadership, type Entity, type Role } from "@/lib/intelligence/entities";
import {
  layersForRoles,
  lensesForRoles,
  tagsForRoles,
  primaryLayerForRoles,
  isRankableVendor,
  LAYER_LABEL,
  LENS_LABEL,
  TAG_LABEL,
} from "@/lib/intelligence/taxonomy";
import { listNewsItems } from "@/lib/intelligence/repository";
import { HARDCODED_SURFACES_WIRED, INTERACTIVE_ASSESSMENT_ENABLED, INTERROGATE_ENABLED, PREP_KIT_ENABLED } from "@/lib/availability";
import { getMemberOrHeroDemo } from "@/lib/member/auth";
import DataUnavailable from "@/components/DataUnavailable";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import { Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { strategicScores } from "@/lib/intelligence/strategic-scores";
import AnalystInsight from "@/components/analyst-insight";
import { entityInsight } from "@/lib/insights/tab-insights";
import { OwnershipBadge } from "@/components/ownership-indicator";
import ReputationPanel from "@/components/vendor/ReputationPanel";
import VendorPulsePanel from "@/components/vendor/VendorPulsePanel";
import { reviewsConnector } from "@/lib/connectors/reviews";
import FinancialsPanel from "@/components/vendor/FinancialsPanel";
import TrackButton from "@/components/member/TrackButton";
import { getVendorReputation, type VendorReputation } from "@/lib/reputation/vendor-reputation";
import { hasLiveGitHubRepo, fetchLiveGitHubSignalForVendor } from "@/lib/reputation/live-github";
import { getReputationSnapshots, type ReputationSnapshotPoint } from "@/lib/reputation/reputation-snapshots";
import { intelVendorId } from "@/lib/intelligence/vendor-id";
import { getVendorCategoryStandings } from "@/lib/ranking/category-composite";
import PillarContributionTable from "@/components/ranking/PillarContributionTable";
import { getDeliveryPartnershipsForVendor } from "@/lib/delivery/repository";
import ImplementationPartnersPanel from "@/components/vendor/ImplementationPartnersPanel";
import { disclosedAdoptersOf } from "@/lib/peer/adopters";
import DisclosedAdoptersPanel from "@/components/peers/DisclosedAdoptersPanel";
import TabChat from "@/components/chat/TabChat";
import { aggregateDevSentiment } from "@/lib/dev-sentiment/aggregate";
import DevSentimentPanel from "@/components/dev-sentiment/DevSentimentPanel";
import { getVendorScorecard, getModelQualityBreakdown } from "@/lib/assessment/domain-scores";
import { MODEL_QUALITY_CATEGORY_COUNT } from "@/lib/system/model-quality-blend";
import DomainScorecard from "@/components/assessment/DomainScorecard";
import WeightedScorecard from "@/components/assessment/WeightedScorecard";
import ExportPackLinks from "@/components/export/ExportPackLinks";
import PrepKitPanel from "@/components/assessment/PrepKitPanel";
import VendorPageShell, { type VendorTabKey } from "@/components/vendor/VendorPageShell";
import type { VerdictStanding } from "@/components/vendor/VerdictCard";
import EvidenceTrail from "@/components/vendor/EvidenceTrail";
import VendorDependencies from "@/components/vendor/VendorDependencies";
import { summariseVerdict, verdictWhySentence, verdictHeadline } from "@/lib/assessment/verdict-summary";

export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

interface SnapshotPoint {
  date: string;          // ISO date string (YYYY-MM-DD)
  overallScore: number;
  momentumScore: number;
  rank: number;
  trackedVendors: number;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = ENTITIES.find((e) => e.slug === slug);
  const title = entity ? `${entity.name} · AI Vendor Profile` : "Vendor Profile";
  return {
    title,
    description: entity
      ? `Independent, evidence-based profile of ${entity.name}: scores, momentum, role, and the sources behind every rating.`
      : undefined,
    alternates: { canonical: `/vendors/${slug}` },
    openGraph: { title, url: absoluteUrl(`/vendors/${slug}`), type: "profile" },
  };
}

// ── Role badge colours (matching QueryV2Client ROLE_TONE) ─────────────────────

const ROLE_TONE: Record<Role, { bg: string; text: string }> = {
  "Platform Vendor":        { bg: "bg-emerald-50 dark:bg-emerald-950/40",  text: "text-emerald-800 dark:text-emerald-300"  },
  "Model Provider":         { bg: "bg-sky-50 dark:bg-sky-950/40",          text: "text-sky-800 dark:text-sky-300"          },
  "Application Vendor":     { bg: "bg-violet-50 dark:bg-violet-950/40",    text: "text-violet-800 dark:text-violet-300"    },
  "Infrastructure Player":  { bg: "bg-amber-50 dark:bg-amber-950/40",      text: "text-amber-900 dark:text-amber-300"      },
  "Investor":               { bg: "bg-lime-50 dark:bg-lime-950/40",        text: "text-lime-900 dark:text-lime-300"        },
  "Hardware Provider":      { bg: "bg-orange-50 dark:bg-orange-950/40",    text: "text-orange-900 dark:text-orange-300"    },
  "Data & Services Provider": { bg: "bg-cyan-50 dark:bg-cyan-950/40",      text: "text-cyan-900 dark:text-cyan-300"        },
  "Cloud / Hosting Provider": { bg: "bg-teal-50 dark:bg-teal-950/40",      text: "text-teal-900 dark:text-teal-300"        },
  "Sovereign / Regional AI":  { bg: "bg-rose-50 dark:bg-rose-950/40",      text: "text-rose-900 dark:text-rose-300"        },
  "Regulator / Policy Actor": { bg: "bg-[#ece3cb] dark:bg-[#143049]",        text: "text-[#2e3f57] dark:text-[#c2d1e0]"        },
  "Open-Source Ecosystem":  { bg: "bg-indigo-50 dark:bg-indigo-950/40",    text: "text-indigo-900 dark:text-indigo-300"    },
  "Vertical Specialist":    { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",  text: "text-fuchsia-900 dark:text-fuchsia-300"  },
};

function RoleBadge({ role }: { role: Role }) {
  const tone = ROLE_TONE[role] ?? { bg: "bg-[#ece3cb] dark:bg-[#143049]", text: "text-[#3f5068] dark:text-[#c2d1e0]" };
  return (
    <span className={`inline-flex rounded border border-current/20 px-1.5 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
      {role}
    </span>
  );
}

// C13 — the vendor's place in the taxonomy: standard-stack LAYER chips (what it
// is), TAG chips (cross-cutting attributes), and LENS chips (investor / sovereign
// / regulator — a different axis, shown dashed with a ◇ so they never read as a
// vendor tier / ranking).
function TaxoChip({ label, variant }: { label: string; variant: "layer" | "lens" | "tag" }) {
  const cls =
    variant === "layer"
      ? "bg-[#e6f0ea] text-[#14503f] dark:bg-emerald-950/40 dark:text-emerald-300"
      : variant === "lens"
        ? "border border-dashed border-[#8a6df0]/50 bg-transparent text-[#6b4fd0] dark:text-[#b8a6ff]"
        : "bg-[#ece3cb] text-[#3f5068] dark:bg-[#143049] dark:text-[#c2d1e0]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}
      title={variant === "lens" ? "Cross-cutting lens — a different axis, not a vendor tier" : variant === "tag" ? "Cross-cutting tag" : "Standard-stack layer"}
    >
      {variant === "lens" && <span aria-hidden>◇</span>}
      {label}
    </span>
  );
}

// C7 — Strategic position panel (single formula source: strategicScores()).
// The caller supplies the provenance badge matching its INPUTS: the strict
// live-data branch feeds the latest score-writer snapshot (live, evidence-based);
// the legacy flag-on branch feeds seed roster figures and must badge them as such.
function StrategicPositionPanel({
  badge,
  inputs,
  momentum,
}: {
  badge: React.ReactNode;
  inputs: { overallScore: number; confidenceScore: number; ownershipType?: string; category: string };
  momentum: number;
}) {
  const s = strategicScores(inputs, momentum);
  const good = (v: number) => (v >= 70 ? "text-emerald-700 dark:text-emerald-300" : v >= 45 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300");
  const risk = (v: number) => (v >= 60 ? "text-rose-700 dark:text-rose-300" : v >= 35 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");
  const cells = [
    { label: "Sustainability", value: s.sustainability, tone: good(s.sustainability), note: "Advantage stays defensible over 6–24 months." },
    { label: "Encroachment risk", value: s.encroachment, tone: risk(s.encroachment), note: "Risk a frontier model or hyperscaler absorbs the differentiation." },
    { label: "Dependency risk", value: s.dependency, tone: risk(s.dependency), note: "Exposure to model, cloud, GPU or platform dependencies." },
    { label: "Optionality", value: s.optionality, tone: good(s.optionality), note: "Whether adopting this raises or lowers future flexibility." },
    { label: "Viability", value: s.viability, tone: good(s.viability), note: "Vendor health — funding, revenue maturity, delivery record." },
  ];
  return (
    <Panel title="Strategic position">
      <p className="mb-2 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
        How defensible this vendor&apos;s position looks over 6–24 months — sustainability,
        plus the risks a CIO underwrites by adopting it. A transparent heuristic model
        (formulas in lib/intelligence/strategic-scores.ts), not a measured assessment.
      </p>
      {badge}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-[#e9e0c8] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]/50">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{c.label}</div>
            <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div>
            <p className="mt-1 text-[10px] leading-4 text-[#5b6b7f] dark:text-[#8fa5bb]">{c.note}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Score tile colour ─────────────────────────────────────────────────────────

function scoreTone(value: number) {
  if (value >= 80) return { num: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" };
  if (value >= 60) return { num: "text-amber-700 dark:text-amber-300",   bar: "bg-amber-500"   };
  return             { num: "text-rose-700 dark:text-rose-300",           bar: "bg-rose-500"    };
}

function DeltaArrow({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className={value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
      {value > 0 ? "▲" : "▼"} {Math.abs(value)}
    </span>
  );
}

function ScoreTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: number;
}) {
  const { num, bar } = scoreTone(value);
  return (
    <div className="rounded-xl border border-[#e9e0c8] bg-white dark:border-[#1d3a57] dark:bg-[#0c2238]/50 p-5 flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${num}`}>{value}</div>
      <div className={`h-1 rounded-full ${bar}`} style={{ width: `${value}%` }} />
      {delta !== undefined && delta !== 0 && (
        <div className="text-xs font-medium">
          <DeltaArrow value={delta} />
        </div>
      )}
    </div>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, string> = {
    positive: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    negative: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    neutral:  "border-[#d6c9a8] bg-[#f6f1e3] text-[#2e3f57] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#c2d1e0]",
    mixed:    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[sentiment] ?? map["neutral"]}`}>
      {sentiment}
    </span>
  );
}

// ── Chip list ─────────────────────────────────────────────────────────────────

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel?: string }) {
  if (!items.length) {
    return <span className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{emptyLabel ?? "None recorded"}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded border border-[#e0d6ba] bg-[#faf6ec] px-2 py-0.5 text-xs text-[#475a72] dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#c2d1e0]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Evidence grade explanation ────────────────────────────────────────────────

const EVIDENCE_GRADE_DESCRIPTIONS: Record<Entity["evidenceGrade"], string> = {
  E1: "E1 — Directional estimate only. Limited or no verified public evidence. Use for orientation, not procurement decision.",
  E2: "E2 — Partial public evidence. Based on selective public disclosures, analyst inference or partner announcements.",
  E3: "E3 — Moderate public evidence. Multiple credible sources including third-party analysts, earnings disclosures or product documentation.",
  E4: "E4 — Strong public evidence. Broad analyst and market coverage, financial disclosures, verifiable product and customer data.",
  E5: "E5 — High-confidence verified data. Primary sources, contracts, audited financials or direct vendor disclosure.",
};

function EvidenceGradeChip({ grade }: { grade: Entity["evidenceGrade"] }) {
  const colours: Record<Entity["evidenceGrade"], string> = {
    E1: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
    E2: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    E3: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300",
    E4: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    E5: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${colours[grade]}`}
      title={EVIDENCE_GRADE_DESCRIPTIONS[grade]}
    >
      {grade}
    </span>
  );
}

// ── Pure-SVG score history chart ──────────────────────────────────────────────

function ScoreHistoryChart({ snapshots, reputation = [] }: { snapshots: SnapshotPoint[]; reputation?: ReputationSnapshotPoint[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[#e0d6ba] bg-[#fdfaf1] dark:border-[#2a4a6b] dark:bg-[#081c30]/30">
        <p className="text-sm text-[#5b6b7f] dark:text-[#8fa5bb]">
          Fewer than 2 snapshots — backfill score history from the admin panel.
        </p>
      </div>
    );
  }

  const W = 800;
  const H = 200;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 36;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  const minScore = 0;
  const maxScore = 100;

  function xOf(index: number): number {
    return PAD_LEFT + (index / (snapshots.length - 1)) * chartW;
  }

  function yOf(score: number): number {
    return PAD_TOP + chartH - ((score - minScore) / (maxScore - minScore)) * chartH;
  }

  // Build polyline point strings
  const overallPoints = snapshots.map((s, i) => `${xOf(i)},${yOf(s.overallScore)}`).join(" ");
  const momentumPoints = snapshots.map((s, i) => `${xOf(i)},${yOf(s.momentumScore)}`).join(" ");

  // Area fill path for overall score
  const firstX = xOf(0);
  const lastX = xOf(snapshots.length - 1);
  const baseY = PAD_TOP + chartH;
  const areaPath = `M ${firstX} ${baseY} L ${overallPoints.split(" ").map((p) => p).join(" L ")} L ${lastX} ${baseY} Z`;

  // Y-axis gridlines at 25, 50, 75, 100
  const gridLines = [25, 50, 75, 100];

  // X-axis date labels: first, last, and every ~30-day interval
  const dateLabels: Array<{ x: number; label: string }> = [];
  const firstDate = new Date(snapshots[0].date).getTime();
  const lastDate = new Date(snapshots[snapshots.length - 1].date).getTime();
  const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

  // Reputation line — mapped onto the SAME time axis by DATE (it shares dates
  // with the forward score captures). Forward-only, so it sits on the recent
  // edge and grows; only points within the score date range render. Never
  // back-filled — an honest, possibly-short line rather than invented history.
  const span = lastDate - firstDate;
  const xOfDate = (dateStr: string): number => {
    const t = new Date(dateStr).getTime();
    const frac = span > 0 ? (t - firstDate) / span : 1;
    return PAD_LEFT + Math.max(0, Math.min(1, frac)) * chartW;
  };
  const repInRange = reputation.filter((r) => {
    const t = new Date(r.date).getTime();
    return Number.isFinite(t) && t >= firstDate && t <= lastDate;
  });
  const reputationPoints = repInRange.map((r) => `${xOfDate(r.date)},${yOf(r.reputationScore)}`).join(" ");
  let lastLabelTime = -Infinity;

  snapshots.forEach((s, i) => {
    const t = new Date(s.date).getTime();
    const isFirst = i === 0;
    const isLast = i === snapshots.length - 1;
    const isDue = t - lastLabelTime >= MS_30_DAYS;

    if (isFirst || isLast || isDue) {
      const d = new Date(s.date);
      const label = `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
      dateLabels.push({ x: xOf(i), label });
      lastLabelTime = t;
    }
  });

  // Suppress the last label if it's too close to the penultimate labelled point
  if (dateLabels.length >= 2) {
    const second = dateLabels[dateLabels.length - 2];
    const last = dateLabels[dateLabels.length - 1];
    if (last.x - second.x < 60) {
      dateLabels.splice(dateLabels.length - 2, 1); // drop second-to-last
    }
  }

  return (
    <div className="w-full">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Score history chart"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="overallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8c95c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e8c95c" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={PAD_LEFT}
            y1={yOf(v)}
            x2={PAD_LEFT + chartW}
            y2={yOf(v)}
            stroke="#e9e0c8"
            strokeWidth="0.8"
            strokeDasharray={v === 100 ? "none" : "4 3"}
          />
          <text
            x={PAD_LEFT - 4}
            y={yOf(v) + 4}
            textAnchor="end"
            fontSize="9"
            fill="#9ca3af"
          >
            {v}
          </text>
        </g>
      ))}

      {/* Area fill under overall score line */}
      <path d={areaPath} fill="url(#overallGrad)" />

      {/* Momentum dashed line */}
      <polyline
        points={momentumPoints}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeDasharray="5 3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Overall score solid line */}
      <polyline
        points={overallPoints}
        fill="none"
        stroke="#e8c95c"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Score dots */}
      {snapshots.map((s, i) => (
        <circle
          key={s.date}
          cx={xOf(i)}
          cy={yOf(s.overallScore)}
          r="3"
          fill="#e8c95c"
          stroke="#fff"
          strokeWidth="1.5"
        />
      ))}

      {/* Reputation line (forward-tracked composite) */}
      {repInRange.length >= 2 && (
        <polyline
          points={reputationPoints}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {repInRange.map((r) => (
        <circle key={`rep-${r.date}`} cx={xOfDate(r.date)} cy={yOf(r.reputationScore)} r="2.5" fill="#a78bfa" stroke="#fff" strokeWidth="1.2" />
      ))}

      {/* X-axis date labels */}
      {dateLabels.map((item) => (
        <text
          key={item.x}
          x={item.x}
          y={H - 6}
          textAnchor="middle"
          fontSize="9"
          fill="#9ca3af"
        >
          {item.label}
        </text>
      ))}

      {/* Legend */}
      <line x1={PAD_LEFT} y1={PAD_TOP - 4} x2={PAD_LEFT + 16} y2={PAD_TOP - 4} stroke="#e8c95c" strokeWidth="2" />
      <text x={PAD_LEFT + 20} y={PAD_TOP} fontSize="9" fill="#9ca3af">Overall</text>
      <line x1={PAD_LEFT + 70} y1={PAD_TOP - 4} x2={PAD_LEFT + 86} y2={PAD_TOP - 4} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={PAD_LEFT + 90} y={PAD_TOP} fontSize="9" fill="#9ca3af">Momentum</text>
      <line x1={PAD_LEFT + 150} y1={PAD_TOP - 4} x2={PAD_LEFT + 166} y2={PAD_TOP - 4} stroke="#a78bfa" strokeWidth="1.5" />
      <text x={PAD_LEFT + 170} y={PAD_TOP} fontSize="9" fill="#9ca3af">Reputation (composite)</text>
    </svg>
    {repInRange.length < 2 && (
      <p className="mt-2 text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">
        Reputation tracking begins with the next daily refresh — the line builds forward from there, never back-filled.
      </p>
    )}
    </div>
  );
}

// ── Within-layer ranking ──────────────────────────────────────────────────────
// Vendors are ranked ONLY among entities sharing their primary role, by the
// role-specific leadership score. There is deliberately no all-market rank:
// platforms, models, hardware and capital measure different things.

const ROLE_PLURAL: Record<Role, string> = {
  "Platform Vendor": "Platform Vendors",
  "Model Provider": "Model Providers",
  "Application Vendor": "Application Vendors",
  "Infrastructure Player": "Infrastructure Players",
  "Investor": "Investors",
  "Hardware Provider": "Hardware Providers",
  "Data & Services Provider": "Data & Services Providers",
  "Cloud / Hosting Provider": "Cloud / Hosting Providers",
  "Sovereign / Regional AI": "Sovereign / Regional AI players",
  "Regulator / Policy Actor": "Regulators / Policy Actors",
  "Open-Source Ecosystem": "Open-Source Ecosystem players",
  "Vertical Specialist": "Vertical Specialists",
};

// C13 — standing is computed WITHIN the standard-stack layer (not the raw role).
// A pure investor / sovereign / regulator has no vendor layer → it is a LENS, not
// ranked as a vendor (isVendorLayer:false); the UI shows the lens instead of a rank.
function layerRankFor(entity: Entity): { rank: number; peers: number; layerLabel: string; isVendorLayer: boolean } {
  const layer = primaryLayerForRoles(entity.primaryRole, entity.secondaryRoles);
  if (!layer) {
    const lens = lensesForRoles([entity.primaryRole, ...entity.secondaryRoles])[0];
    return { rank: 0, peers: 0, layerLabel: lens ? LENS_LABEL[lens] : "", isVendorLayer: false };
  }
  const peers = ENTITIES
    .filter((e) => layersForRoles([e.primaryRole, ...e.secondaryRoles]).includes(layer))
    .sort((a, b) => layerLeadership(b, layer) - layerLeadership(a, layer));
  const idx = peers.findIndex((e) => e.id === entity.id);
  return {
    rank: idx >= 0 ? idx + 1 : peers.length,
    peers: peers.length,
    layerLabel: LAYER_LABEL[layer],
    isVendorLayer: true,
  };
}

// ── Data fetching helpers ─────────────────────────────────────────────────────

/** Live count of analyst_verified evidence rows for this vendor — the honest
 * signal behind its scores. The static ENTITIES roster is always seed (0), so
 * the real depth must be read from the DB. 0 = seed estimate. */
async function fetchEvidenceDepth(entityId: string): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    return await getPrisma().evidenceRecord.count({
      where: { vendorId: entityId, reviewStatus: "analyst_verified" },
    });
  } catch {
    return 0;
  }
}

async function fetchSnapshots(entityId: string): Promise<SnapshotPoint[]> {
  if (!hasDatabase()) return [];
  try {
    const prisma = getPrisma();
    const rows = await prisma.vendorRankingSnapshot.findMany({
      where: { vendorId: entityId },
      orderBy: { snapshotDate: "asc" },
      select: {
        snapshotDate: true,
        overallScore: true,
        momentumScore: true,
        rank: true,
        trackedVendors: true,
      },
    });
    return rows.map((r) => ({
      date: r.snapshotDate instanceof Date ? r.snapshotDate.toISOString().slice(0, 10) : String(r.snapshotDate).slice(0, 10),
      overallScore: r.overallScore,
      momentumScore: r.momentumScore,
      rank: r.rank,
      trackedVendors: r.trackedVendors,
    }));
  } catch {
    return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VendorDeepDivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1. Look up entity by slug
  const entity = ENTITIES.find((e) => e.slug === slug);
  if (!entity) {
    notFound();
  }

  // Canonical intelligence-spine id (aliases mapped, e.g. alibaba-qwen → alibaba).
  // Used for the score/reputation reads AND the curated delivery-partnership read.
  const intelId = intelVendorId(entity);

  // Implementation partners are CURATED analyst reference data shown WITH their
  // provenance label (like the taxonomy) — independent of the hardcoded-score
  // gating below, so they render even while scores are held.
  const deliveryPartnerships = await getDeliveryPartnershipsForVendor(intelId).catch(() => []);
  const partnerIndustries = [...new Set(deliveryPartnerships.flatMap((p) => p.industries))].sort();
  const partnerRegions = [...new Set(deliveryPartnerships.flatMap((p) => p.regions))].sort();
  // Demand-side twin (piece 2): peers that have publicly DISCLOSED adopting this
  // vendor — curated cited reference data (lib/peer), same provenance class as
  // the delivery layer; renders independent of the score gating.
  const peerAdopters = disclosedAdoptersOf(intelId);
  // Developer-community sentiment — SCOPED: null for non-coding vendors, so the
  // panel only renders for the coding/developer models (hard "where applicable"
  // rule). Cited tri-source signal, coverage-gated.
  const devSentiment = aggregateDevSentiment(intelId);
  // Ask-AI chips shared by both profile paths. The dev-sentiment question only
  // appears for in-scope coding vendors with real signal — never implied for
  // enterprise/RAG/infra vendors where it doesn't apply.
  const vendorChatChips = [
    ...(devSentiment && devSentiment.state === "rated"
      ? ["What does the developer community say about this vendor?"]
      : []),
    "Where is the evidence thin for this vendor?",
    "Is the model-quality score an independent audit?",
  ];

  // Phase 3 Assessment scorecard — 12-domain 0–5 scores from REAL analyst_verified
  // evidence (deterministic, no LLM, never seed). Keyed on entity.id to match
  // EvidenceRecord.vendorId. When the vendor has any verified evidence this lifts
  // the "profile data unavailable" gate with the real scorecard.
  const scorecard = await getVendorScorecard(entity.id).catch(() => null);
  const hasEvidence = !!scorecard?.hasAnyEvidence;
  // Wave-3 Interrogate is the member-gated premium action; resolve identity only
  // when the flag is on so anonymous visitors keep the free Wave-2 experience.
  const interrogateMember = (INTERROGATE_ENABLED || PREP_KIT_ENABLED) ? await getMemberOrHeroDemo().catch(() => null) : null;
  // Model quality (Artificial Analysis Intelligence Index) — a real, cited
  // capability signal shown on the profile so a CIO can see it. It is WEIGHTED
  // in model-category rankings (e.g. frontier model APIs); here it is context.
  // null when the vendor has no Artificial-Analysis-tracked model (insufficient
  // — never a default; falls back to the legacy Arena-Elo pillar per vendor).
  const modelQuality = scorecard?.modelQuality?.state === "scored" ? scorecard.modelQuality : null;
  // The per-index "why" behind the model-quality number — the vendor's
  // flagship model's real Intelligence / Coding / Agentic indices.
  const mqBreakdown = modelQuality
    ? await getModelQualityBreakdown([entity.id]).then((m) => m.get(entity.id) ?? null).catch(() => null)
    : null;
  // Rendered on the profile whether or not the vendor has framework evidence — so
  // a vendor surfaced on the frontier category by its model quality never has that
  // cited signal hidden on its own page (consistency with the category surface).
  const modelQualityPanel = modelQuality ? (
    <div className="rounded-lg border border-[#d4af37]/40 bg-[#fbf6e4]/40 px-3 py-2 dark:border-[#d4af37]/30 dark:bg-[#1a1605]/20">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Model quality</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-[#a07f1f] dark:text-[#d4af37]">
          {modelQuality.score.toFixed(2)}<span className="text-xs text-[#7a8aa0]">/5</span>
        </span>
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {modelQuality.bestGrade} benchmark
        </span>
        {modelQuality.lowConfidence && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            limited coverage
          </span>
        )}
      </div>
      {mqBreakdown ? (
        <>
          <p className="mt-1 text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
            Driven by the flagship model&apos;s Artificial Analysis Intelligence Index — a weighted composite of 9
            evaluations, mostly independent ({modelQuality.bestGrade}), not a fully independent audit — capped at 4.0.
            Coding/Agentic indices are shown as cited context, not blended into the score.
          </p>
          <ul className="mt-2 space-y-1">
            {mqBreakdown.contributions.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 truncate text-[#3f5068] dark:text-[#a7bacd]" title={c.modelName}>
                  {c.label} <span className="text-[#9aa7b8]">· {c.weight > 0 ? "drives score" : "context"}</span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                  <span
                    className="block h-full rounded bg-[#b08d2f] dark:bg-[#d4af37]"
                    style={{ width: `${Math.round(c.normalized * 100)}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono tabular-nums text-[#7a8aa0]">
                  {c.rating.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-[#7a8aa0]">
            {mqBreakdown.contributions.length} of {MODEL_QUALITY_CATEGORY_COUNT} indices cited · {modelQuality.confidence}% confidence
            {modelQuality.citations[0] && (
              <>
                {" · "}
                <a
                  href={modelQuality.citations[0].sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400"
                >
                  Artificial Analysis source
                </a>
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
          Legacy human-preference Arena Elo (Artificial Analysis has no tracked model for this vendor yet) — a
          capability proxy, not a factuality audit (band-capped at 4.0).
          {modelQuality.citations[0] && (
            <>
              {" "}
              <a
                href={modelQuality.citations[0].sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400"
              >
                source
              </a>
            </>
          )}
        </p>
      )}
    </div>
  ) : null;

  // STRICT mode: the LEGACY full profile (hardcoded ENTITIES scores, momentum,
  // role breakdown, financials) stays held behind HARDCODED_SURFACES_WIRED — we
  // never present seed as measured. But the evidence-derived assessment scorecard
  // is real, so it renders here in place of the bare "profile data unavailable"
  // block whenever the vendor has verified evidence.
  if (!HARDCODED_SURFACES_WIRED) {
    // C7 fix (2026-07 audit): the Strategic-position fold previously lived only in
    // the flag-on legacy branch below — dead code on prod. Here it renders from
    // LIVE inputs only: the latest score-writer snapshot (overall + momentum) and
    // the mean confidence of the vendor's SCORED assessment domains. No snapshot
    // or no evidence ⇒ the panel is honestly absent, never seeded.
    const strictRoles: Role[] = [entity.primaryRole, ...entity.secondaryRoles];
    const strictSnapshots = hasEvidence ? await fetchSnapshots(intelId).catch(() => []) : [];
    const strictLast = strictSnapshots[strictSnapshots.length - 1];
    const strictScored = (scorecard?.domains ?? []).filter((d) => d.state === "scored");
    const strictConfidence = strictScored.length
      ? Math.round(strictScored.reduce((s, d) => s + (d.state === "scored" ? d.confidence : 0), 0) / strictScored.length)
      : 0;

    // The Pulse (AnalystGenius vendor-tab #1) — safe for strict mode: every
    // input is a live-DB read (category standings, ranking snapshots, news
    // filtered to sourceKind "real"), none of the held-back hardcoded/seed data.
    const strictCategoryStandings = await getVendorCategoryStandings(intelId).catch(() => []);
    const strictNews = (await listNewsItems().catch(() => []))
      .filter((n) => n.vendors.includes(entity.id) && n.sourceKind === "real")
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, 8);
    const pulseStanding = (() => {
      const live = strictCategoryStandings.find((s) => s.isLive && s.standing.rank != null);
      return live ? { rank: live.standing.rank as number, peers: live.rankedCount, categoryName: live.categoryName } : null;
    })();
    const pulseMomentum = (() => {
      if (strictSnapshots.length < 2) return null;
      const first = strictSnapshots[0];
      const last = strictSnapshots[strictSnapshots.length - 1];
      const days = Math.max(1, Math.round((Date.parse(last.date) - Date.parse(first.date)) / 86_400_000));
      return { overallDelta: last.overallScore - first.overallScore, days };
    })();

    // Verdict card inputs (Prompt 2). Same strictCategoryStandings/scorecard
    // reads above — no new query.
    const liveStanding = strictCategoryStandings.find((s) => s.isLive && s.standing.rank != null);
    const verdictStanding: VerdictStanding | null = liveStanding
      ? {
          categoryId: liveStanding.categoryId,
          categoryName: liveStanding.categoryName,
          rank: liveStanding.standing.rank as number,
          rankedCount: liveStanding.rankedCount,
        }
      : null;
    // summariseVerdict() is computeWeightedComposite under the framework DEFAULT
    // weights (the global 12-domain read) — the source of the strengths/weaknesses
    // ("strong on X, thin on Z"), which are per-domain score facts independent of
    // basis. But the HEADLINE composite/confidence/coverage must be the in-category
    // number when the vendor is ranked (verdictHeadline picks it), so the big number
    // and the "#N of M in <category>" rank beside it agree — and match the identical
    // assessmentComposite the category / compare / list / homepage surfaces render.
    // Only an evidenced-but-unranked vendor falls back to the global number.
    const verdictSummary = scorecard ? summariseVerdict(scorecard.domains) : null;
    const headline = verdictHeadline(liveStanding?.standing ?? null, verdictSummary);

    const availableTabs: VendorTabKey[] = [
      "assessment",
      "evidence",
      "market",
      "dependencies",
      ...(peerAdopters.length > 0 ? (["peers"] as const) : []),
      "financials",
    ];

    const liveGithub = hasLiveGitHubRepo(intelId) ? await fetchLiveGitHubSignalForVendor(intelId).catch(() => null) : null;
    const reviewHealth = reviewsConnector.health();

    return (
      <div className="min-h-screen bg-white dark:bg-[#071827]">
        <main className="mx-auto max-w-3xl px-5 py-8">
          <div className="mb-4">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#54647a] hover:text-[#13294b] dark:text-[#a7bacd] dark:hover:text-[#eef3f8]"
            >
              ← Back to rankings
            </Link>
          </div>

          {hasEvidence && scorecard && verdictSummary ? (
            <VendorPageShell
              vendorName={entity.name}
              vendorSlug={entity.slug}
              standing={verdictStanding}
              composite={headline.composite}
              confidence={headline.confidence}
              coverage={headline.coverage}
              momentum={strictLast?.momentumScore ?? null}
              whySentence={verdictWhySentence(verdictSummary)}
              availableTabs={availableTabs}
              verdictExtras={
                <PrepKitPanel
                  config={{ enabled: PREP_KIT_ENABLED, signedIn: !!interrogateMember }}
                  vendorId={entity.id}
                  vendorName={entity.name}
                />
              }
              tabs={{
                assessment: (
                  <Panel title="12-domain assessment">
                    {INTERACTIVE_ASSESSMENT_ENABLED ? (
                      <WeightedScorecard
                        scorecard={scorecard}
                        interrogate={{
                          enabled: INTERROGATE_ENABLED,
                          signedIn: !!interrogateMember,
                          scope: { kind: "vendor", vendorId: entity.id },
                        }}
                        vendorCategoryId={verdictStanding?.categoryId}
                      />
                    ) : (
                      <DomainScorecard scorecard={scorecard} />
                    )}
                    {modelQualityPanel && <div className="mt-4">{modelQualityPanel}</div>}
                  </Panel>
                ),
                evidence: (
                  <Panel title="Evidence trail">
                    <EvidenceTrail scorecard={scorecard} />
                  </Panel>
                ),
                market: (
                  <div className="space-y-6">
                    <Panel title="The Pulse">
                      <VendorPulsePanel
                        vendorName={entity.name}
                        news={strictNews.map((n) => ({
                          title: n.title,
                          whyItMatters: n.whyItMatters ?? undefined,
                          sourceName: n.sourceName,
                          sourceUrl: n.sourceUrl ?? undefined,
                          publishedAt: n.publishedAt,
                          impactScore: n.impactScore ?? 0,
                        }))}
                        standing={pulseStanding}
                        momentum={pulseMomentum}
                      />
                    </Panel>
                    {hasEvidence && strictLast && isRankableVendor(strictRoles) && (
                      <StrategicPositionPanel
                        badge={
                          /* Label kept (it IS a heuristic) as quiet inline text, not a boxed pill. */
                          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                            Heuristic — derived from live evidence-based scores (snapshot {strictLast.date}), not measured
                          </span>
                        }
                        inputs={{
                          overallScore: strictLast.overallScore,
                          confidenceScore: strictConfidence,
                          ownershipType: entity.ownership,
                          category: entity.primaryRole,
                        }}
                        momentum={strictLast.momentumScore}
                      />
                    )}
                    {devSentiment && (
                      <Panel title="Developer sentiment">
                        <DevSentimentPanel agg={devSentiment} />
                      </Panel>
                    )}
                    {/* Reputation — "Sources & independence" is genuinely live
                        (connector health + a fixed policy statement); scored
                        PILLARS stay held per the strict-mode rule (force-passed
                        hasData:false, never the real seed read). GitHub
                        stars/forks are the one live API read, scoped to this
                        vendor's repo, cached 1h. */}
                    <Panel title="Reputation">
                      <ReputationPanel
                        reputation={
                          {
                            developer: null,
                            employee: null,
                            customer: null,
                            combined: null,
                            asOf: null,
                            hasData: false,
                          } satisfies VendorReputation
                        }
                        vendorName={entity.name}
                        reviewSources={{
                          configured: reviewHealth.configured,
                          contributing: reviewHealth.status === "ok" && reviewHealth.lastFetchOk === true,
                        }}
                        liveGithub={liveGithub}
                      />
                    </Panel>
                  </div>
                ),
                dependencies: (
                  <div className="space-y-6">
                    <Panel title="Dependencies & encroachment">
                      <VendorDependencies vendorSlug={entity.slug} />
                    </Panel>
                    {deliveryPartnerships.length > 0 && (
                      <Panel title="Implementation partners">
                        <ImplementationPartnersPanel
                          vendorName={entity.name}
                          partnerships={deliveryPartnerships}
                          industries={partnerIndustries}
                          regions={partnerRegions}
                        />
                      </Panel>
                    )}
                  </div>
                ),
                peers:
                  peerAdopters.length > 0 ? (
                    <Panel title="Disclosed enterprise adopters">
                      <DisclosedAdoptersPanel vendorName={entity.name} adopters={peerAdopters} />
                    </Panel>
                  ) : undefined,
                financials: (
                  // Held honestly dark. Ownership/capital-signal fields on `entity`
                  // are hardcoded (lib/intelligence/entities.ts), so FinancialsPanel
                  // (which renders them as analyst-sourced context) stays out of
                  // the strict path — this states the absence plainly instead.
                  <Panel title="Financial Snapshot">
                    <p className="text-sm text-[#54647a] dark:text-[#a7bacd]">
                      No live-sourced financial profile for {entity.name} yet — ownership, capital-raise
                      and valuation signals require a verified filing or press citation before we show
                      them here. We report that absence rather than estimate a figure.
                    </p>
                  </Panel>
                ),
              }}
            />
          ) : (
            <section className="mb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[#13294b] dark:text-[#f6f9fc]">
                  {entity.name}
                </h1>
                <TrackButton item={`vendor:${entity.slug}`} label={entity.name} />
              </div>
              {modelQualityPanel && <div className="mb-4">{modelQualityPanel}</div>}
              <DataUnavailable
                title={`${entity.name} — profile data unavailable`}
                detail="Scores, momentum, role breakdown and financial signals appear only when backed by reviewed, source-backed evidence in our live data store. No reviewed evidence has been ingested for this vendor yet, so we hold the profile rather than show hardcoded figures as if measured."
              />
            </section>
          )}
          {/* Ask AI — grounded in this vendor's cited data (also on the dark
              path so coding profiles showing dev-sentiment carry the chat). */}
          <TabChat
            tab={{ kind: "vendor", id: entity.id }}
            label={entity.name}
            chips={vendorChatChips}
          />
        </main>
      </div>
    );
  }

  const reputation = getVendorReputation(intelId);

  // 2. Fetch snapshot history + reputation history + news + within-category
  //    composite standings + evidence depth in parallel.
  const [snapshots, reputationSeries, allNews, categoryStandings, evidenceDepth] = await Promise.all([
    fetchSnapshots(intelId),
    getReputationSnapshots(intelId),
    listNewsItems(),
    getVendorCategoryStandings(intelId).catch(() => []),
    fetchEvidenceDepth(entity.id),
  ]);

  // Filter news to this entity
  const vendorNews = allNews
    .filter((item) => item.vendors.includes(entity.id))
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, 8);

  // Last snapshot metadata
  const lastSnapshot = snapshots[snapshots.length - 1];

  // All roles (primary + secondary)
  const allRoles: Role[] = [entity.primaryRole, ...entity.secondaryRoles];

  // Within-layer standing — computed from the tracked roster at render time.
  const layerRank = layerRankFor(entity);

  return (
    <div className="min-h-screen bg-white dark:bg-[#071827]">
      <main className="mx-auto max-w-7xl px-5 py-8">

        {/* ── Header band ──────────────────────────────────────────────── */}
        <div className="mb-7 border-b border-[#e9e0c8] pb-6 dark:border-[#1d3a57]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#54647a] hover:text-[#13294b] dark:text-[#a7bacd] dark:hover:text-[#eef3f8]"
            >
              ← Back to rankings
            </Link>
            <TrackButton item={`vendor:${entity.slug}`} label={entity.name} />
          </div>

          <div className="mt-4 flex flex-wrap items-start gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[#13294b] dark:text-[#f6f9fc] md:text-4xl">
              {entity.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <OwnershipBadge ownershipType={entity.ownership} />
              <EvidenceGradeChip grade={entity.evidenceGrade} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {layersForRoles(allRoles).map((l) => (
              <TaxoChip key={l} label={LAYER_LABEL[l]} variant="layer" />
            ))}
            {tagsForRoles(allRoles).map((t) => (
              <TaxoChip key={t} label={TAG_LABEL[t]} variant="tag" />
            ))}
            {lensesForRoles(allRoles).map((l) => (
              <TaxoChip key={l} label={LENS_LABEL[l]} variant="lens" />
            ))}
          </div>
        </div>

        {/* ── Analyst insight — derived from this vendor's own scores ────── */}
        <AnalystInsight paragraph={entityInsight({
          name: entity.name,
          primaryRole: entity.primaryRole,
          leadership: roleLeadership(entity, entity.primaryRole),
          momentum: entity.momentum,
          readiness: entity.readiness,
          confidence: entity.confidence,
          risk: entity.risk,
          layerRank: layerRank.rank,
          layerSize: layerRank.peers,
          leadershipDelta: entity.deltas.leadership,
        })} />

        {/* ── Evidence-depth honesty banner ─────────────────────────────── */}
        {evidenceDepth < 10 && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${evidenceDepth <= 0
            ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            : "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"}`}>
            <strong>{evidenceDepth <= 0 ? "Seed estimate — no verified evidence." : `Limited evidence — ${evidenceDepth} analyst-verified row${evidenceDepth === 1 ? "" : "s"}.`}</strong>{" "}
            {evidenceDepth <= 0
              ? "The scores below are directional seed estimates with no analyst-verified evidence behind them. Treat as a starting hypothesis, not a measured assessment."
              : "The scores below rest on a thin evidence base — treat as preliminary until more sources are verified."}
          </div>
        )}

        {/* ── Score grid (6 tiles) ──────────────────────────────────────── */}
        <section className={`mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 ${evidenceDepth < 10 ? (evidenceDepth <= 0 ? "opacity-60" : "opacity-80") : ""}`}>
          <ScoreTile label="Final Score" value={entity.leadershipScore} delta={entity.deltas.leadership} />
          <ScoreTile label="Innovation"  value={entity.innovation} />
          <ScoreTile label="Readiness"   value={entity.readiness} />
          <ScoreTile label="Momentum"   value={entity.momentum}   delta={entity.deltas.reach} />
          <ScoreTile label="Ecosystem Reach" value={entity.ecosystemReach} delta={entity.deltas.reach} />
          <ScoreTile label="Evidence" value={evidenceDepth} />
        </section>

        {/* ── AI-market role breakdown (multi-role giants only) ─────────────── */}
        {entity.roleScores && Object.keys(entity.roleScores).length > 0 && (
          <section className="mb-6">
            <Panel title="AI-market role breakdown">
              <p className="mb-3 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
                This entity plays multiple AI roles with genuinely different strength — a single composite would mislead.
                Each lens is scored on its own AI-market merits. The category leaderboard ranks this vendor by the relevant
                role score, not the composite above.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.entries(entity.roleScores) as Array<[Role, NonNullable<typeof entity.roleScores>[Role]]>)
                  .filter(([, rs]) => rs)
                  .sort((a, b) => (b[1]!.leadership) - (a[1]!.leadership))
                  .map(([role, rs]) => {
                    const v = rs!.leadership;
                    const colour = v >= 80 ? "text-emerald-700 dark:text-emerald-300" : v >= 60 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300";
                    return (
                      <div key={role} className="rounded-lg border border-[#e9e0c8] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]/50">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{role}</span>
                          <span className={`font-mono text-lg font-bold tabular-nums ${colour}`}>{v}</span>
                        </div>
                        <div className="mt-1 flex gap-3 text-[10px] uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                          <span>Innov {rs!.innovation}</span>
                          <span>Ready {rs!.readiness}</span>
                          <span>Reach {rs!.reach}</span>
                          <span>{rs!.evidenceGrade}</span>
                        </div>
                        <p className="mt-2 text-[11px] leading-4 text-[#54647a] dark:text-[#a7bacd]">{rs!.rationale}</p>
                      </div>
                    );
                  })}
              </div>
            </Panel>
          </section>
        )}

        {/* ── Score history chart (with forward-tracked reputation line) ──── */}
        <section className="mb-6">
          <Panel title="Score history">
            <ScoreHistoryChart snapshots={snapshots} reputation={reputationSeries} />
          </Panel>
        </section>

        {/* ── Standing in category (the multi-pillar composite + why) ──────── */}
        {categoryStandings.length > 0 && (
          <section className="mb-6">
            <Panel title="Standing in category">
              <p className="mb-3 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
                Where this vendor places in each market category it competes in — by the weighted
                composite of all evidence-graded pillars, ranked within category. Expand a category to
                see exactly which criteria and weights drove the position.
              </p>
              <div className="space-y-4">
                {categoryStandings.map((s) => (
                  <div key={s.categoryId} className="rounded-lg border border-[#e9e0c8] p-3 dark:border-[#1d3a57]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/category/${s.categoryId}`}
                        className="text-sm font-semibold text-[#13294b] underline-offset-2 hover:underline dark:text-[#eef3f8]"
                      >
                        {s.categoryName}
                      </Link>
                      {s.standing.state === "ranked" ? (
                        <span className="font-mono text-sm tabular-nums text-[#13294b] dark:text-[#eef3f8]">
                          #{s.standing.rank} of {s.rankedCount}
                          <span className="ml-2 text-xs text-[#54647a] dark:text-[#a7bacd]">
                            composite {s.standing.assessmentComposite == null ? "—" : s.standing.assessmentComposite.toFixed(2)}/5 · {s.standing.compositeConfidence}% conf
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          Insufficient evidence to rank
                        </span>
                      )}
                    </div>
                    <PillarContributionTable vendor={s.standing} />
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {/* ── C7: Strategic position — folded here from the old /understand
               per-vendor "Strategic vendor intelligence" table so a vendor lives
               in ONE place. Reuses the canonical strategicScores() heuristic
               (single source of truth). These are ESTIMATED from seed pillar
               inputs, so the panel keeps the seed badge until live evidence
               replaces the inputs. Shown only for rankable vendors — a pure
               investor / sovereign / regulator lens has no vendor strategic
               position (it is not a product tier). ── */}
        {isRankableVendor(allRoles) && (
          <section className="mb-6">
            <Panel title="Strategic position">
              <p className="mb-2 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
                How defensible this vendor&apos;s position looks over 6–24 months — sustainability,
                plus the risks a CIO underwrites by adopting it. Derived from this vendor&apos;s own
                pillar scores, momentum and market signals via the shared strategic model.
              </p>
              <SeedDataBadge
                label="Estimated"
                provenance="seed"
                reason="Strategic scores are computed from seed pillar data (overall score, momentum, confidence, role). They refine as live evidence deepens."
              />
              {(() => {
                const s = strategicScores(
                  {
                    overallScore: entity.leadershipScore,
                    confidenceScore: entity.confidence,
                    ownershipType: entity.ownership,
                    category: entity.primaryRole,
                  },
                  entity.momentum,
                );
                const good = (v: number) => (v >= 70 ? "text-emerald-700 dark:text-emerald-300" : v >= 45 ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300");
                const risk = (v: number) => (v >= 60 ? "text-rose-700 dark:text-rose-300" : v >= 35 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");
                const cells = [
                  { label: "Sustainability", value: s.sustainability, tone: good(s.sustainability), note: "Advantage stays defensible over 6–24 months." },
                  { label: "Encroachment risk", value: s.encroachment, tone: risk(s.encroachment), note: "Risk a frontier model or hyperscaler absorbs the differentiation." },
                  { label: "Dependency risk", value: s.dependency, tone: risk(s.dependency), note: "Exposure to model, cloud, GPU or platform dependencies." },
                  { label: "Optionality", value: s.optionality, tone: good(s.optionality), note: "Whether adopting this raises or lowers future flexibility." },
                  { label: "Viability", value: s.viability, tone: good(s.viability), note: "Vendor health — funding, revenue maturity, delivery record." },
                ];
                return (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {cells.map((c) => (
                      <div key={c.label} className="rounded-lg border border-[#e9e0c8] bg-white p-3 dark:border-[#1d3a57] dark:bg-[#0c2238]/50">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{c.label}</div>
                        <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${c.tone}`}>{c.value}</div>
                        <p className="mt-1 text-[10px] leading-4 text-[#5b6b7f] dark:text-[#8fa5bb]">{c.note}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Panel>
          </section>
        )}

        {/* ── Reputation (current composite + per-pillar breakdown) ───────── */}
        <section className="mb-6">
          <ReputationPanel
            reputation={reputation}
            vendorName={entity.name}
            reviewSources={(() => {
              const h = reviewsConnector.health();
              return { configured: h.configured, contributing: h.status === "ok" && h.lastFetchOk === true };
            })()}
          />
        </section>

        {/* ── Implementation partners (IT-services / GSI delivery layer) ──── */}
        {deliveryPartnerships.length > 0 && (
          <section className="mb-6">
            <Panel title="Implementation partners">
              <ImplementationPartnersPanel
                vendorName={entity.name}
                partnerships={deliveryPartnerships}
                industries={partnerIndustries}
                regions={partnerRegions}
              />
            </Panel>
          </section>
        )}

        {/* ── Disclosed enterprise adopters (demand side — cited peer data) ── */}
        {peerAdopters.length > 0 && (
          <section className="mb-6">
            <Panel title="Disclosed enterprise adopters">
              <DisclosedAdoptersPanel vendorName={entity.name} adopters={peerAdopters} />
            </Panel>
          </section>
        )}

        {/* ── Developer sentiment (coding vendors ONLY — scoped, cited) ────── */}
        {devSentiment && (
          <section className="mb-6">
            <Panel title="Developer sentiment">
              <DevSentimentPanel agg={devSentiment} />
            </Panel>
          </section>
        )}

        {/* ── Financial profile (ownership + sourced capital signals) ─────── */}
        <section className="mb-6">
          <FinancialsPanel
            ownership={entity.ownership}
            capitalSignals={entity.investorRelationships}
            evidenceGrade={entity.evidenceGrade}
            dataCaveats={entity.dataCaveats}
            vendorName={entity.name}
          />
        </section>

        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_0.55fr]">
          {/* ── Within-layer standing card — vendors are only ranked against
                 peers in their own layer; no all-market composite rank. ───── */}
          <Panel title={layerRank.isVendorLayer ? "Standing within layer" : "Cross-cutting lens"}>
            <div className="flex flex-col gap-3">
              {layerRank.isVendorLayer ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold tabular-nums text-[#13294b] dark:text-[#f6f9fc]">
                      #{layerRank.rank}
                    </span>
                    <span className="text-sm text-[#54647a] dark:text-[#a7bacd]">
                      of {layerRank.peers} in the {layerRank.layerLabel} layer
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-[#5b6b7f] dark:text-[#8fa5bb]">
                    Ranked within the {layerRank.layerLabel} layer by leadership, against the roles that map to
                    it — within this layer only. Cross-layer composite rankings are not used; layers measure
                    different things.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-6 text-[#54647a] dark:text-[#a7bacd]">
                  {entity.name} is tracked under the{" "}
                  <strong className="text-[#6b4fd0] dark:text-[#b8a6ff]">{layerRank.layerLabel} lens</strong> — a
                  cross-cutting axis (capital / geography / policy), not a vendor product tier. It appears in the
                  dependency graph and as a lens, and is deliberately <strong>not ranked among vendors</strong>.
                </p>
              )}
              {lastSnapshot ? (
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">Latest score</span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {(lastSnapshot.overallScore ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">Momentum</span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {(lastSnapshot.momentumScore ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">Last snapshot</span>
                    <div className="mt-1 text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">
                      {lastSnapshot.date}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5b6b7f] dark:text-[#8fa5bb]">
                  {hasDatabase()
                    ? "No score snapshots recorded yet. Run the snapshot job from the admin panel."
                    : "— Database not connected. Score history unavailable."}
                </p>
              )}
            </div>
          </Panel>

          {/* ── Analyst interpretation ────────────────────────────────────── */}
          <Panel title="Analyst interpretation">
            <p className="text-sm leading-6 text-[#475a72] dark:text-[#c2d1e0]">
              {entity.cioInterpretation}
            </p>
          </Panel>
        </div>

        {/* ── Recent news ───────────────────────────────────────────────── */}
        <section className="mb-6">
          <Panel title="Recent intelligence">
            {vendorNews.length === 0 ? (
              <p className="text-sm text-[#5b6b7f] dark:text-[#8fa5bb]">No news tracked yet for this vendor.</p>
            ) : (
              <div className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
                {vendorNews.map((item) => (
                  <div key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#13294b] hover:underline dark:text-[#eef3f8]"
                          >
                            {item.title}
                          </a>
                        ) : (
                          <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{item.title}</span>
                        )}
                        <div className="mt-1 text-xs text-[#54647a] dark:text-[#a7bacd] leading-5">{item.summary}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <SentimentBadge sentiment={item.sentiment} />
                        <span className="rounded border border-[#e0d6ba] bg-[#faf6ec] px-1.5 py-0.5 text-[10px] font-medium text-[#54647a] dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#a7bacd]">
                          {item.sourceName}
                        </span>
                      </div>
                    </div>
                    {item.whyItMatters && (
                      <div className="mt-2 rounded-md bg-[#faf6ec] px-3 py-2 text-xs leading-5 text-[#475a72] dark:bg-[#143049]/60 dark:text-[#a7bacd]">
                        <span className="font-semibold text-[#13294b] dark:text-[#d8e2ec]">Why it matters: </span>
                        {item.whyItMatters}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[10px] text-[#9ca3af] dark:text-[#7d93aa]">
                        {new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {item.impactScore >= 7 && (
                        <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          High impact {item.impactScore}/10
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>

        {/* ── Dependencies & ecosystem footprint (C7: "who they depend on") —
               kept on the profile so a vendor's upstream reliances and what it
               owns live in ONE place, not on a separate Understand tab. ── */}
        <section className="mb-6">
          <Panel title="Dependencies & ecosystem footprint">
            <p className="mb-3 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
              What this vendor relies on and what it owns — models, hosting, hardware and capital.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Models owned
                </div>
                <ChipList items={entity.modelsOwned} emptyLabel="No first-party models" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Hosted third-party
                </div>
                <ChipList items={entity.hostedThirdParty} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Infrastructure exposure
                </div>
                <ChipList items={entity.infrastructureExposure} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Investor relationships
                </div>
                <ChipList items={entity.investorRelationships} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Hardware dependencies
                </div>
                <ChipList items={entity.hardwareDependencies} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                  Risk level
                </div>
                <span
                  className={`inline-flex rounded border border-current/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    entity.risk === "low"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : entity.risk === "high"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  }`}
                >
                  {entity.risk}
                </span>
              </div>
            </div>
          </Panel>
        </section>

        {/* ── Data quality footer ───────────────────────────────────────── */}
        <section className="mb-8">
          <div className="rounded-xl border border-[#e9e0c8] bg-[#fdfaf1] p-5 dark:border-[#1d3a57] dark:bg-[#0c2238]/30">
            <div className="flex flex-wrap items-center gap-3">
              <EvidenceGradeChip grade={entity.evidenceGrade} />
              <span className="text-xs font-medium text-[#13294b] dark:text-[#eef3f8]">
                {EVIDENCE_GRADE_DESCRIPTIONS[entity.evidenceGrade]}
              </span>
            </div>
            {entity.dataCaveats && (
              <p className="mt-3 text-xs leading-6 text-[#54647a] dark:text-[#a7bacd]">
                <span className="font-semibold text-[#13294b] dark:text-[#d8e2ec]">Data caveats: </span>
                {entity.dataCaveats}
              </p>
            )}
          </div>
        </section>

        {/* Piece 3 — Ask AI, grounded in THIS vendor's cited scorecard only. */}
        <TabChat
          tab={{ kind: "vendor", id: entity.id }}
          label={entity.name}
          chips={vendorChatChips}
        />
      </main>
    </div>
  );
}
