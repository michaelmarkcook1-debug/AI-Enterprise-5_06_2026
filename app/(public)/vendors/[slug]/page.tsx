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

import { ENTITIES, roleLeadership, type Entity, type Role } from "@/lib/intelligence/entities";
import { listNewsItems } from "@/lib/intelligence/repository";
import { HARDCODED_SURFACES_WIRED, INTERACTIVE_ASSESSMENT_ENABLED } from "@/lib/availability";
import DataUnavailable from "@/components/DataUnavailable";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import { Panel } from "@/components/intelligence-ui";
import AnalystInsight from "@/components/analyst-insight";
import { entityInsight } from "@/lib/insights/tab-insights";
import { OwnershipBadge } from "@/components/ownership-indicator";
import ReputationPanel from "@/components/vendor/ReputationPanel";
import FinancialsPanel from "@/components/vendor/FinancialsPanel";
import TrackButton from "@/components/member/TrackButton";
import { getVendorReputation } from "@/lib/reputation/vendor-reputation";
import { getReputationSnapshots, type ReputationSnapshotPoint } from "@/lib/reputation/reputation-snapshots";
import { intelVendorId } from "@/lib/intelligence/vendor-id";
import { getVendorCategoryStandings } from "@/lib/ranking/category-composite";
import PillarContributionTable from "@/components/ranking/PillarContributionTable";
import { getDeliveryPartnershipsForVendor } from "@/lib/delivery/repository";
import ImplementationPartnersPanel from "@/components/vendor/ImplementationPartnersPanel";
import { getVendorScorecard, getModelQualityBreakdown } from "@/lib/assessment/domain-scores";
import { MODEL_QUALITY_CATEGORIES } from "@/lib/system/model-quality-blend";
import DomainScorecard from "@/components/assessment/DomainScorecard";
import WeightedScorecard from "@/components/assessment/WeightedScorecard";

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

function layerRankFor(entity: Entity): { rank: number; peers: number; layerLabel: string } {
  const role = entity.primaryRole;
  const peers = ENTITIES
    .filter((e) => e.primaryRole === role)
    .sort((a, b) => roleLeadership(b, role) - roleLeadership(a, role));
  const idx = peers.findIndex((e) => e.id === entity.id);
  return {
    rank: idx >= 0 ? idx + 1 : peers.length,
    peers: peers.length,
    layerLabel: ROLE_PLURAL[role] ?? `${role}s`,
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

  // Phase 3 Assessment scorecard — 12-domain 0–5 scores from REAL analyst_verified
  // evidence (deterministic, no LLM, never seed). Keyed on entity.id to match
  // EvidenceRecord.vendorId. When the vendor has any verified evidence this lifts
  // the "profile data unavailable" gate with the real scorecard.
  const scorecard = await getVendorScorecard(entity.id).catch(() => null);
  const hasEvidence = !!scorecard?.hasAnyEvidence;
  // Model quality (Arena Elo) — a real, cited capability signal shown on the
  // profile so a CIO can see it. It is WEIGHTED in model-category rankings (e.g.
  // frontier model APIs); here it is context. null when the vendor has no
  // Arena-ranked model (insufficient — never a default).
  const modelQuality = scorecard?.modelQuality?.state === "scored" ? scorecard.modelQuality : null;
  // The per-category "why" behind the blended model-quality number (the real
  // LMArena coding / reasoning / overall / vision / instruction-following Elos).
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
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {modelQuality.bestGrade} benchmark
        </span>
        {modelQuality.lowConfidence && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            limited coverage
          </span>
        )}
      </div>
      {mqBreakdown ? (
        <>
          <p className="mt-1 text-[11px] leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
            Weighted blend of LMArena capability leaderboards, each normalised within its own arena. A capability proxy
            from community-preference benchmarks ({modelQuality.bestGrade}), not an independent audit — capped at 4.0.
          </p>
          <ul className="mt-2 space-y-1">
            {mqBreakdown.contributions.map((c) => (
              <li key={c.category} className="flex items-center gap-2 text-[11px]">
                <span className="w-40 shrink-0 truncate text-[#3f5068] dark:text-[#a7bacd]" title={c.modelName}>
                  {c.label} <span className="text-[#9aa7b8]">· {Math.round(c.weight * 100)}%</span>
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                  <span
                    className="block h-full rounded bg-[#b08d2f] dark:bg-[#d4af37]"
                    style={{ width: `${Math.round(c.normalized * 100)}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right font-mono tabular-nums text-[#7a8aa0]">
                  {Math.round(c.rating)} Elo
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-[#7a8aa0]">
            {mqBreakdown.contributions.length} of {MODEL_QUALITY_CATEGORIES.length} categories · {modelQuality.confidence}% confidence
            {modelQuality.citations[0] && (
              <>
                {" · "}
                <a
                  href={modelQuality.citations[0].sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline underline-offset-2 hover:no-underline dark:text-sky-400"
                >
                  LMArena source
                </a>
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11px] leading-5 text-[#5e6b7e] dark:text-[#a7bacd]">
          Human-preference Arena Elo — a capability proxy, not a factuality audit (band-capped at 4.0).
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
    return (
      <div className="min-h-screen bg-white dark:bg-[#071827]">
        <main className="mx-auto max-w-3xl px-5 py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/vendors"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#54647a] hover:text-[#13294b] dark:text-[#a7bacd] dark:hover:text-[#eef3f8]"
            >
              ← Back to rankings
            </Link>
            <TrackButton item={`vendor:${entity.slug}`} label={entity.name} />
          </div>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight text-[#13294b] dark:text-[#f6f9fc]">
            {entity.name}
          </h1>
          {hasEvidence && scorecard ? (
            <section className="mb-6">
              <Panel title="Enterprise assessment — evidence scorecard">
                {INTERACTIVE_ASSESSMENT_ENABLED ? (
                  <WeightedScorecard scorecard={scorecard} />
                ) : (
                  <DomainScorecard scorecard={scorecard} />
                )}
                {modelQualityPanel && <div className="mt-4">{modelQualityPanel}</div>}
              </Panel>
            </section>
          ) : (
            <section className="mb-6">
              {modelQualityPanel && <div className="mb-4">{modelQualityPanel}</div>}
              <DataUnavailable
                title={`${entity.name} — profile data unavailable`}
                detail="Scores, momentum, role breakdown and financial signals appear only when backed by reviewed, source-backed evidence in our live data store. No reviewed evidence has been ingested for this vendor yet, so we hold the profile rather than show hardcoded figures as if measured."
              />
            </section>
          )}
          {deliveryPartnerships.length > 0 && (
            <section className="mt-6">
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

          <div className="mt-3 flex flex-wrap gap-2">
            {allRoles.map((role) => (
              <RoleBadge key={role} role={role} />
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
                            composite {(s.standing.composite ?? 0).toFixed(0)} · {s.standing.compositeConfidence}% conf
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

        {/* ── Reputation (current composite + per-pillar breakdown) ───────── */}
        <section className="mb-6">
          <ReputationPanel reputation={reputation} vendorName={entity.name} />
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
          <Panel title="Standing within layer">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tabular-nums text-[#13294b] dark:text-[#f6f9fc]">
                  #{layerRank.rank}
                </span>
                <span className="text-sm text-[#54647a] dark:text-[#a7bacd]">
                  of {layerRank.peers} {layerRank.layerLabel}
                </span>
              </div>
              <p className="text-xs leading-5 text-[#5b6b7f] dark:text-[#8fa5bb]">
                Ranked by {entity.primaryRole} leadership score, within this layer only.
                Cross-layer composite rankings are not used — layers measure different things.
              </p>
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

        {/* ── Data breadcrumb ───────────────────────────────────────────── */}
        <section className="mb-6">
          <Panel title="Entity data breadcrumb">
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
      </main>
    </div>
  );
}
