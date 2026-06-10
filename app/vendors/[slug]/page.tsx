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

import { ENTITIES, roleLeadership, type Entity, type Role } from "@/lib/intelligence/entities";
import { listNewsItems } from "@/lib/intelligence/repository";
import { getPrisma, hasDatabase } from "@/lib/prisma";
import { Panel } from "@/components/intelligence-ui";
import { OwnershipBadge } from "@/components/ownership-indicator";

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
  return { title: entity ? `${entity.name} · AI Vendor Profile` : "Vendor Profile" };
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
  "Regulator / Policy Actor": { bg: "bg-zinc-100 dark:bg-zinc-800",        text: "text-zinc-700 dark:text-zinc-300"        },
  "Open-Source Ecosystem":  { bg: "bg-indigo-50 dark:bg-indigo-950/40",    text: "text-indigo-900 dark:text-indigo-300"    },
  "Vertical Specialist":    { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",  text: "text-fuchsia-900 dark:text-fuchsia-300"  },
};

function RoleBadge({ role }: { role: Role }) {
  const tone = ROLE_TONE[role] ?? { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-300" };
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
    <div className="rounded-xl border border-[#e2e7dc] bg-white dark:border-zinc-800 dark:bg-zinc-900/50 p-5 flex flex-col gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{label}</div>
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
    neutral:  "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
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
    return <span className="text-xs text-[#697362] dark:text-zinc-500">{emptyLabel ?? "None recorded"}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded border border-[#d8ded0] bg-[#f7f8f5] px-2 py-0.5 text-xs text-[#4d574b] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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

function ScoreHistoryChart({ snapshots }: { snapshots: SnapshotPoint[] }) {
  if (snapshots.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[#d8ded0] bg-[#fbfcf8] dark:border-zinc-700 dark:bg-zinc-950/30">
        <p className="text-sm text-[#697362] dark:text-zinc-500">
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
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Score history chart"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="overallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0.02" />
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
            stroke="#e2e7dc"
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
        stroke="#6EE7B7"
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
          fill="#6EE7B7"
          stroke="#fff"
          strokeWidth="1.5"
        />
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
      <line x1={PAD_LEFT} y1={PAD_TOP - 4} x2={PAD_LEFT + 16} y2={PAD_TOP - 4} stroke="#6EE7B7" strokeWidth="2" />
      <text x={PAD_LEFT + 20} y={PAD_TOP} fontSize="9" fill="#9ca3af">Overall</text>
      <line x1={PAD_LEFT + 70} y1={PAD_TOP - 4} x2={PAD_LEFT + 86} y2={PAD_TOP - 4} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={PAD_LEFT + 90} y={PAD_TOP} fontSize="9" fill="#9ca3af">Momentum</text>
    </svg>
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

  // 2. Fetch snapshot history + news in parallel
  const [snapshots, allNews] = await Promise.all([
    fetchSnapshots(entity.id),
    listNewsItems(),
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
        <div className="mb-7 border-b border-[#e2e7dc] pb-6 dark:border-zinc-800">
          <Link
            href="/query-v2"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#596151] hover:text-[#18201b] dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to Query leaderboard
          </Link>

          <div className="mt-4 flex flex-wrap items-start gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[#18201b] dark:text-zinc-50 md:text-4xl">
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

        {/* ── Score grid (6 tiles) ──────────────────────────────────────── */}
        <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <ScoreTile label="Leadership" value={entity.leadershipScore} delta={entity.deltas.leadership} />
          <ScoreTile label="Innovation"  value={entity.innovation} />
          <ScoreTile label="Readiness"   value={entity.readiness} />
          <ScoreTile label="Momentum"   value={entity.momentum}   delta={entity.deltas.reach} />
          <ScoreTile label="Ecosystem Reach" value={entity.ecosystemReach} delta={entity.deltas.reach} />
          <ScoreTile label="Confidence" value={entity.confidence} />
        </section>

        {/* ── AI-market role breakdown (multi-role giants only) ─────────────── */}
        {entity.roleScores && Object.keys(entity.roleScores).length > 0 && (
          <section className="mb-6">
            <Panel title="AI-market role breakdown">
              <p className="mb-3 text-xs leading-5 text-[#596151] dark:text-zinc-400">
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
                      <div key={role} className="rounded-lg border border-[#e2e7dc] bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{role}</span>
                          <span className={`font-mono text-lg font-bold tabular-nums ${colour}`}>{v}</span>
                        </div>
                        <div className="mt-1 flex gap-3 text-[10px] uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                          <span>Innov {rs!.innovation}</span>
                          <span>Ready {rs!.readiness}</span>
                          <span>Reach {rs!.reach}</span>
                          <span>{rs!.evidenceGrade}</span>
                        </div>
                        <p className="mt-2 text-[11px] leading-4 text-[#596151] dark:text-zinc-400">{rs!.rationale}</p>
                      </div>
                    );
                  })}
              </div>
            </Panel>
          </section>
        )}

        {/* ── Score history chart ───────────────────────────────────────── */}
        <section className="mb-6">
          <Panel title="Score history">
            <ScoreHistoryChart snapshots={snapshots} />
          </Panel>
        </section>

        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_0.55fr]">
          {/* ── Within-layer standing card — vendors are only ranked against
                 peers in their own layer; no all-market composite rank. ───── */}
          <Panel title="Standing within layer">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tabular-nums text-[#18201b] dark:text-zinc-50">
                  #{layerRank.rank}
                </span>
                <span className="text-sm text-[#596151] dark:text-zinc-400">
                  of {layerRank.peers} {layerRank.layerLabel}
                </span>
              </div>
              <p className="text-xs leading-5 text-[#697362] dark:text-zinc-500">
                Ranked by {entity.primaryRole} leadership score, within this layer only.
                Cross-layer composite rankings are not used — layers measure different things.
              </p>
              {lastSnapshot ? (
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">Latest score</span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {lastSnapshot.overallScore.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">Momentum</span>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {lastSnapshot.momentumScore.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">Last snapshot</span>
                    <div className="mt-1 text-sm font-medium text-[#18201b] dark:text-zinc-100">
                      {lastSnapshot.date}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#697362] dark:text-zinc-500">
                  {hasDatabase()
                    ? "No score snapshots recorded yet. Run the snapshot job from the admin panel."
                    : "— Database not connected. Score history unavailable."}
                </p>
              )}
            </div>
          </Panel>

          {/* ── Analyst interpretation ────────────────────────────────────── */}
          <Panel title="Analyst interpretation">
            <p className="text-sm leading-6 text-[#4d574b] dark:text-zinc-300">
              {entity.cioInterpretation}
            </p>
          </Panel>
        </div>

        {/* ── Recent news ───────────────────────────────────────────────── */}
        <section className="mb-6">
          <Panel title="Recent intelligence">
            {vendorNews.length === 0 ? (
              <p className="text-sm text-[#697362] dark:text-zinc-500">No news tracked yet for this vendor.</p>
            ) : (
              <div className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
                {vendorNews.map((item) => (
                  <div key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#18201b] hover:underline dark:text-zinc-100"
                          >
                            {item.title}
                          </a>
                        ) : (
                          <span className="font-medium text-[#18201b] dark:text-zinc-100">{item.title}</span>
                        )}
                        <div className="mt-1 text-xs text-[#596151] dark:text-zinc-400 leading-5">{item.summary}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <SentimentBadge sentiment={item.sentiment} />
                        <span className="rounded border border-[#d8ded0] bg-[#f7f8f5] px-1.5 py-0.5 text-[10px] font-medium text-[#596151] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                          {item.sourceName}
                        </span>
                      </div>
                    </div>
                    {item.whyItMatters && (
                      <div className="mt-2 rounded-md bg-[#f7f8f5] px-3 py-2 text-xs leading-5 text-[#4d574b] dark:bg-zinc-800/60 dark:text-zinc-400">
                        <span className="font-semibold text-[#18201b] dark:text-zinc-200">Why it matters: </span>
                        {item.whyItMatters}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-[10px] text-[#9ca3af] dark:text-zinc-600">
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                  Models owned
                </div>
                <ChipList items={entity.modelsOwned} emptyLabel="No first-party models" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                  Hosted third-party
                </div>
                <ChipList items={entity.hostedThirdParty} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                  Infrastructure exposure
                </div>
                <ChipList items={entity.infrastructureExposure} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                  Investor relationships
                </div>
                <ChipList items={entity.investorRelationships} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
                  Hardware dependencies
                </div>
                <ChipList items={entity.hardwareDependencies} emptyLabel="None recorded" />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
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
          <div className="rounded-xl border border-[#e2e7dc] bg-[#fbfcf8] p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="flex flex-wrap items-center gap-3">
              <EvidenceGradeChip grade={entity.evidenceGrade} />
              <span className="text-xs font-medium text-[#18201b] dark:text-zinc-100">
                {EVIDENCE_GRADE_DESCRIPTIONS[entity.evidenceGrade]}
              </span>
            </div>
            {entity.dataCaveats && (
              <p className="mt-3 text-xs leading-6 text-[#596151] dark:text-zinc-400">
                <span className="font-semibold text-[#18201b] dark:text-zinc-200">Data caveats: </span>
                {entity.dataCaveats}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
