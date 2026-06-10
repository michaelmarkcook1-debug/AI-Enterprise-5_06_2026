"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Metric, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  type Role,
  type Entity,
  type InfraBand,
  type RoleScore,
  rolesFor,
  roleLeadership,
  LAYER_DEFS,
} from "@/lib/intelligence/entities";
import ExecutiveBrief from "@/components/query/ExecutiveBrief";
import WatchButton from "@/components/query/WatchButton";

type WinningLayer = { title: string; names: string[]; note: string };

// Infrastructure sub-bands (Silicon / Cloud Compute / Neocloud / Data Platforms).
// Each band represents a DIFFERENT risk type, which is why Infrastructure is the
// one category that earns sub-structure where the others stay flat.
const INFRA_BANDS: Array<{ key: InfraBand; label: string; note: string }> = [
  { key: "silicon", label: "Silicon", note: "Chips, accelerators, networking and fabrication. Risk type: supply concentration." },
  { key: "cloud_compute", label: "Cloud Compute", note: "Hyperscaler and sovereign cloud capacity. Risk type: lock-in and pricing power." },
  { key: "neocloud", label: "Neocloud", note: "AI-specialist GPU/inference clouds. Risk type: counterparty and viability." },
  { key: "data_platform", label: "Data Platforms", note: "Governed data + AI layer compute runs on. Risk type: data gravity and governance." },
];

const INFRA_BAND_LABEL: Record<InfraBand, string> = {
  silicon: "Silicon",
  cloud_compute: "Cloud",
  neocloud: "Neocloud",
  inference: "Inference",
  data_platform: "Data",
};

type CategoryKey =
  | "all"
  | "platforms"
  | "models"
  | "applications"
  | "infrastructure"
  | "investors"
  | "hardware"
  | "sovereign"
  | "vertical";

// ── "All" view sections — one section per layer, every entity appears ONCE
// under its PRIMARY role. There is deliberately NO flat all-market ranking:
// the layers measure different things (platforms vs models vs hardware vs
// capital), so a single cross-layer ordering would mislead. LAYER_DEFS covers
// the canonical layers; the catch-all defs below guarantee every primaryRole
// in the roster lands in exactly one section.
const ALL_VIEW_SECTIONS: Array<{ title: string; role: Role; note: string }> = [
  ...LAYER_DEFS.map(({ title, role, note }) => ({ title, role, note })),
  { title: "Data & Services Providers", role: "Data & Services Provider", note: "Governed data platforms and AI services layers." },
  { title: "Cloud / Hosting Providers", role: "Cloud / Hosting Provider", note: "Cloud and hosting capacity behind AI deployment." },
  { title: "Vertical Specialists", role: "Vertical Specialist", note: "Domain-specific AI for legal, finance and regulated workflows." },
  { title: "Open-Source Ecosystem", role: "Open-Source Ecosystem", note: "Open-weight model and tooling ecosystems." },
  { title: "Regulators / Policy Actors", role: "Regulator / Policy Actor", note: "Policy and regulatory actors shaping enterprise AI adoption." },
];

const CATEGORY_OPTIONS: Array<{ key: CategoryKey; label: string; roles: Role[]; summary: string; interpretation: string }> = [
  {
    key: "all",
    label: "All",
    roles: [],
    summary: "Full enterprise AI entity universe across platform, model, application, infrastructure, hardware and capital layers.",
    interpretation: "Use this view when the board needs a market map rather than a procurement shortlist. The top names control different layers, so direct score comparisons need role context.",
  },
  {
    key: "platforms",
    label: "Platforms",
    roles: ["Platform Vendor"],
    summary: "Control planes, enterprise distribution, cloud AI services and workflow surfaces.",
    interpretation: "Platform leadership is about distribution, identity, data access, governance and procurement leverage. It is not the same thing as model ownership.",
  },
  {
    key: "models",
    label: "Models",
    roles: ["Model Provider"],
    summary: "Frontier, open-weight, sovereign and domain model suppliers.",
    interpretation: "Model-provider strength should be read through quality, cost, deployment access, safety posture and ecosystem reach.",
  },
  {
    key: "applications",
    label: "Applications",
    roles: ["Application Vendor"],
    summary: "Packaged assistants, workflow agents and vertical AI applications.",
    interpretation: "Application vendors can convert AI into outcomes quickly, but buyers should test workflow depth, auditability and lock-in against the system of record.",
  },
  {
    key: "infrastructure",
    label: "Infrastructure",
    roles: ["Infrastructure Player", "Cloud / Hosting Provider", "Data & Services Provider"],
    summary: "Cloud, data, compute, deployment and operating infrastructure behind enterprise AI.",
    interpretation: "Infrastructure exposure is a resilience and dependency question: who hosts, who scales, who owns the data plane and who benefits from compute intensity.",
  },
  {
    key: "investors",
    label: "Investors",
    roles: ["Investor"],
    summary: "Strategic capital, ecosystem stakes and distribution-linked investment relationships.",
    interpretation: "Investor-linked entities shape access, cloud commitments and model distribution. Separate capital influence from product fitness.",
  },
  {
    key: "hardware",
    label: "Hardware",
    roles: ["Hardware Provider"],
    summary: "GPU, accelerator, networking, fabrication and semiconductor ecosystem players.",
    interpretation: "Hardware leadership is an upstream dependency signal. It matters for supply assurance, training economics and pricing power, not only direct buyer selection.",
  },
  {
    key: "sovereign",
    label: "Sovereign AI",
    roles: ["Sovereign / Regional AI"],
    summary: "Regional model and deployment alternatives that change jurisdiction, data residency and industrial-policy choices.",
    interpretation: "Sovereign AI is a risk-control and bargaining-leverage lens. It should be filtered by jurisdiction, data transfer policy and procurement eligibility.",
  },
  {
    key: "vertical",
    label: "Vertical Specialists",
    roles: ["Vertical Specialist"],
    summary: "Domain-specific AI providers for legal, finance, regulated workflows and enterprise knowledge work.",
    interpretation: "Vertical specialists can beat horizontal platforms inside narrow workflows. The key diligence question is whether the domain depth offsets maturity and scale risk.",
  },
];

const ROLE_TONE: Record<Role, { bg: string; text: string; fill: string }> = {
  "Platform Vendor": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-800 dark:text-emerald-300", fill: "#10b981" },
  "Model Provider": { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-800 dark:text-sky-300", fill: "#38bdf8" },
  "Application Vendor": { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-800 dark:text-violet-300", fill: "#8b5cf6" },
  "Infrastructure Player": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-900 dark:text-amber-300", fill: "#f59e0b" },
  Investor: { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-900 dark:text-lime-300", fill: "#84cc16" },
  "Hardware Provider": { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-900 dark:text-orange-300", fill: "#f97316" },
  "Data & Services Provider": { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-900 dark:text-cyan-300", fill: "#06b6d4" },
  "Cloud / Hosting Provider": { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-900 dark:text-teal-300", fill: "#14b8a6" },
  "Sovereign / Regional AI": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-900 dark:text-rose-300", fill: "#f43f5e" },
  "Regulator / Policy Actor": { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-300", fill: "#71717a" },
  "Open-Source Ecosystem": { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-900 dark:text-indigo-300", fill: "#6366f1" },
  "Vertical Specialist": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-900 dark:text-fuchsia-300", fill: "#d946ef" },
};

const MODEL_GROUPS = [
  { title: "First-party models", items: ["OpenAI: GPT, o-series, image/audio models", "Anthropic: Claude Opus, Sonnet, Haiku", "Google: Gemini, Imagen, Veo", "Mistral: Large, Medium, Small, Codestral, Magistral", "Cohere: Command, Embed, Rerank", "IBM: Granite", "DeepSeek: R1, V3", "Alibaba: Qwen", "Moonshot: Kimi", "Zhipu: GLM"] },
  { title: "Hosted third-party models", items: ["Microsoft: hosted OpenAI, Mistral and Llama through Azure", "AWS: Claude, Llama, Mistral and other Bedrock models", "Google: Claude through Vertex AI", "Oracle: Cohere and Llama through OCI"] },
  { title: "Open-weight models", items: ["Meta: Llama", "Mistral: open-weight families", "DeepSeek: open releases", "Alibaba: Qwen open-weight variants"] },
  { title: "Underlying product models", items: ["Microsoft Copilot: OpenAI + Microsoft small models", "Harvey: multi-provider legal AI stack", "Glean: multi-provider enterprise search stack", "ServiceNow: Now LLM + provider orchestration"] },
  { title: "Unknown / unverified", items: ["Vertical applications with multi-provider routing", "Private model routing where vendor disclosures are incomplete", "Product-level model mix that changes by customer contract"] },
];

function matchesCategory(entity: Entity, key: CategoryKey) {
  const option = CATEGORY_OPTIONS.find((item) => item.key === key);
  if (!option || option.roles.length === 0) return true;
  const roles = rolesFor(entity);
  return option.roles.some((role) => roles.includes(role));
}

// ── AI-market per-role scoring ─────────────────────────────────────────────
// When a category lens is active, a multi-role giant should rank by its score
// IN THAT ROLE, not by its global composite. Resolve the relevant role for the
// active category (primary role wins ties) and look up its roleScore profile.
function activeRoleFor(entity: Entity, categoryRoles: Role[]): Role | null {
  if (!categoryRoles.length) return null; // "All" view → composite
  return rolesFor(entity).find((r) => categoryRoles.includes(r)) ?? null;
}

interface EffectiveScore {
  leadership: number;
  innovation: number;
  readiness: number;
  reach: number;
  confidence: number;
  roleScored: Role | null; // non-null when a role-specific profile was used
}

function effectiveScore(entity: Entity, categoryRoles: Role[]): EffectiveScore {
  const role = activeRoleFor(entity, categoryRoles);
  const rs: RoleScore | undefined = role ? entity.roleScores?.[role] : undefined;
  if (rs) {
    return {
      leadership: rs.leadership,
      innovation: rs.innovation,
      readiness: rs.readiness,
      reach: rs.reach,
      confidence: rs.confidence,
      roleScored: role,
    };
  }
  return {
    leadership: entity.leadershipScore,
    innovation: entity.innovation,
    readiness: entity.readiness,
    reach: entity.ecosystemReach,
    confidence: entity.confidence,
    roleScored: null,
  };
}

function roleBadge(role: Role) {
  const tone = ROLE_TONE[role];
  return (
    <span key={role} className={`inline-flex rounded border border-current/20 px-1.5 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
      {role}
    </span>
  );
}

function riskClass(risk: Entity["risk"]) {
  if (risk === "low") return "text-emerald-700 dark:text-emerald-300";
  if (risk === "high") return "text-rose-700 dark:text-rose-300";
  return "text-amber-700 dark:text-amber-300";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

// ── Snapshot cache (never re-fetches the same vendor) ─────────────────────
interface SnapshotPoint {
  date: string;
  overallScore: number;
  momentumScore: number;
  rank: number;
  trackedVendors: number;
}

const snapshotCache = new Map<string, SnapshotPoint[]>();

export default function QueryV2Client({ entities, winningByLayer }: { entities: Entity[]; winningByLayer: WinningLayer[] }) {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [selectedId, setSelectedId] = useState(entities[0]?.id ?? "");
  const [hoverState, setHoverState] = useState<{ id: string; y: number; x: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowEnter = useCallback((id: string, e: React.MouseEvent<HTMLTableRowElement>) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTimeout.current = setTimeout(() => {
      setHoverState({ id, y: rect.top + rect.height / 2, x: rect.right });
    }, 120);
  }, []);

  const handleRowLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverState(null), 180);
  }, []);

  const handleCardEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, []);

  const handleCardLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoverState(null), 180);
  }, []);

  const selectedOption = CATEGORY_OPTIONS.find((option) => option.key === category) ?? CATEGORY_OPTIONS[0];
  const categoryRoles = selectedOption.roles;
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entities
      .filter((entity) => matchesCategory(entity, category))
      .filter((entity) => !q || entity.name.toLowerCase().includes(q) || entity.primaryRole.toLowerCase().includes(q))
      // Rank by the AI-market score IN THE ACTIVE ROLE, so e.g. the Models lens
      // ranks Microsoft by its first-party model score (56), not its 91 composite.
      .sort((a, b) => effectiveScore(b, categoryRoles).leadership - effectiveScore(a, categoryRoles).leadership);
  }, [category, categoryRoles, entities, searchQuery]);
  // "All" view: group by primaryRole layer; each entity appears once, ranked
  // by its role-specific leadership WITHIN the section only. Empty sections
  // (including search-filtered-empty) are hidden.
  const groupedSections = useMemo(() => {
    if (category !== "all") return [];
    return ALL_VIEW_SECTIONS
      .map((def) => ({
        def,
        members: filtered
          .filter((entity) => entity.primaryRole === def.role)
          .sort((a, b) => roleLeadership(b, def.role) - roleLeadership(a, def.role)),
      }))
      .filter((section) => section.members.length > 0);
  }, [category, filtered]);
  const selectedEntity = filtered.find((entity) => entity.id === selectedId) ?? filtered[0] ?? entities[0];
  const maxShare = Math.max(...filtered.map((entity) => entity.usageShare), 1);
  const normalizedShare = filtered.map((entity) => ({
    entity,
    share: (entity.usageShare / filtered.reduce((sum, item) => sum + item.usageShare, 0)) * 100,
  }));

  function chooseCategory(nextCategory: CategoryKey) {
    const nextFiltered = entities
      .filter((entity) => matchesCategory(entity, nextCategory))
      .sort((a, b) => b.leadershipScore - a.leadershipScore);
    setCategory(nextCategory);
    setSelectedId(nextFiltered[0]?.id ?? entities[0]?.id ?? "");
  }

  const kpis = [
    { label: "Total tracked entities", value: entities.length, note: "role-classified universe" },
    { label: "Platform vendors", value: entities.filter((entity) => rolesFor(entity).includes("Platform Vendor")).length, note: "control-plane layer" },
    { label: "Model providers", value: entities.filter((entity) => rolesFor(entity).includes("Model Provider")).length, note: "frontier + specialist" },
    { label: "Application vendors", value: entities.filter((entity) => rolesFor(entity).includes("Application Vendor")).length, note: "workflow products" },
    { label: "Infra / hardware", value: entities.filter((entity) => rolesFor(entity).some((role) => role === "Infrastructure Player" || role === "Hardware Provider")).length, note: "dependency layer" },
    { label: "Investor-linked", value: entities.filter((entity) => rolesFor(entity).includes("Investor") || entity.investorRelationships.length > 0).length, note: "capital influence" },
    { label: "Evidence confidence", value: `${average(entities.map((entity) => entity.confidence)).toFixed(0)}%`, note: "directional model" },
  ];

  // Shared leaderboard row renderer. `scopeRoles` is the role context the row
  // is scored in: the active category roles for a lens view, or the single
  // section layer role in the grouped "All" view. The index is the rank WITHIN
  // that scope only — never an all-market position.
  const renderEntityRow = (entity: Entity, index: number, scopeRoles: Role[]) => {
    const active = entity.id === selectedEntity.id;
    const es = effectiveScore(entity, scopeRoles);
    return (
      <tr
        key={entity.id}
        onClick={() => setSelectedId(entity.id)}
        onMouseEnter={(e) => handleRowEnter(entity.id, e)}
        onMouseLeave={handleRowLeave}
        className={`cursor-pointer transition-colors ${active ? "bg-[#eef2e8] dark:bg-zinc-900" : "hover:bg-[#f5f7f2] dark:hover:bg-zinc-900/70"}`}
      >
        <td className="py-2.5 pr-3 font-mono text-xs text-[#697362] dark:text-zinc-500">{index + 1}</td>
        <td className="py-2.5 pr-3 font-semibold text-[#18201b] dark:text-zinc-100">
          <Link href={`/vendors/${entity.slug}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
            <VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} />
          </Link>
          {es.roleScored && (
            <span
              title={`AI-scoped score for the ${es.roleScored} role (differs from this vendor's composite). ${entity.roleScores?.[es.roleScored]?.rationale ?? ""}`}
              className="ml-1.5 inline-flex items-center rounded bg-sky-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
            >
              role-scoped
            </span>
          )}
        </td>
        <td className="py-2.5 pr-3">{roleBadge(es.roleScored ?? entity.primaryRole)}</td>
        <td className="py-2.5 pr-3 text-right">
          <ScoreCell value={es.leadership} delta={es.roleScored ? undefined : entity.deltas.leadership} tier={scoreGrade(es.leadership)} />
        </td>
        <td className="py-2.5 pr-3 text-right">
          <ScoreCell value={es.innovation} tier={scoreGrade(es.innovation)} />
        </td>
        <td className="py-2.5 pr-3 text-right">
          <ScoreCell value={es.readiness} tier={scoreGrade(es.readiness)} />
        </td>
        <td className="py-2.5 pr-3 text-right">
          <ScoreCell value={entity.momentum} delta={entity.deltas.leadership} tier={scoreGrade(entity.momentum)} />
        </td>
        <td className="py-2.5 pr-3 text-right">
          <ScoreCell value={es.reach} delta={es.roleScored ? undefined : entity.deltas.reach} tier={scoreGrade(es.reach)} />
        </td>
        <td className="py-2.5 pr-3 text-right font-mono text-xs text-[#4d574b] dark:text-zinc-400">{entity.usageShare.toFixed(1)}%</td>
        <td className={`py-2.5 pr-3 text-xs font-semibold uppercase ${riskClass(entity.risk)}`}>{entity.risk}</td>
        <td className="py-2.5 text-right font-mono text-xs text-[#4d574b] dark:text-zinc-400">{es.confidence}%</td>
        <td className="py-2.5 pl-1"><WatchButton vendorId={entity.id} vendorName={entity.name} /></td>
      </tr>
    );
  };

  const movers = {
    leadership: filtered.filter((entity) => entity.deltas.leadership > 0).sort((a, b) => b.deltas.leadership - a.deltas.leadership).slice(0, 4),
    reach: filtered.filter((entity) => entity.deltas.reach > 0).sort((a, b) => b.deltas.reach - a.deltas.reach).slice(0, 4),
    adoption: filtered.filter((entity) => entity.deltas.adoption > 0).sort((a, b) => b.deltas.adoption - a.deltas.adoption).slice(0, 4),
    infrastructure: filtered.filter((entity) => entity.deltas.infrastructure > 0).sort((a, b) => b.deltas.infrastructure - a.deltas.infrastructure).slice(0, 4),
    risk: filtered.filter((entity) => entity.deltas.risk > 0).sort((a, b) => b.deltas.risk - a.deltas.risk).slice(0, 4),
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-lg border border-[#dfe4da] bg-white p-3 dark:border-zinc-800 dark:bg-[#071827]">
          <Link href="/query" className="block rounded-md px-3 py-2 text-sm font-semibold text-[#18201b] hover:bg-[#eef2e8] dark:text-zinc-100 dark:hover:bg-zinc-900">
            Query classic
          </Link>
          {["Role overview", "Leaderboard", "Layer winners", "Usage share", "Atlas", "Movers", "Models"].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="mt-1 block rounded-md px-3 py-2 text-xs font-medium text-[#596151] hover:bg-[#eef2e8] dark:text-zinc-400 dark:hover:bg-zinc-900">
              {item}
            </a>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        <ExecutiveBrief entities={entities} winningByLayer={winningByLayer} />

        <section id="role-overview" className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {kpis.map((kpi) => <Metric key={kpi.label} {...kpi} />)}
        </section>

        <Panel
          title="Entity role selector"
          action={<SeedDataBadge label="Directional estimate" provenance="seed" reason="Category roles and market signals are evidence-labelled directional intelligence for route /query-v2." />}
        >
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const active = option.key === category;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseCategory(option.key)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[#192319] bg-[#192319] text-white dark:border-white dark:bg-white dark:text-[#071827]"
                      : "border-[#d7ddd1] bg-[#fbfcf8] text-[#4d574b] hover:bg-[#eef2e8] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">Category summary</div>
              <div className="mt-2 text-sm font-semibold text-[#18201b] dark:text-zinc-100">{selectedOption.label}</div>
              <p className="mt-2 text-xs leading-5 text-[#596151] dark:text-zinc-400">{selectedOption.summary}</p>
            </div>
            <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">CIO interpretation</div>
              <p className="mt-2 text-sm leading-6 text-[#2f392f] dark:text-zinc-300">{selectedOption.interpretation}</p>
            </div>
          </div>
        </Panel>

        {category === "infrastructure" && (
          <section id="infra-bands" className="mt-6">
            <Panel title="Infrastructure by layer">
              <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
                Infrastructure is not one shelf — each layer carries a different risk type.
                Silicon is supply-concentration risk, cloud compute is lock-in and pricing-power risk,
                neoclouds are counterparty / viability risk, and data platforms are data-gravity and
                governance risk. Entities may carry a secondary band where they straddle layers
                (e.g. AWS is cloud compute with its own Trainium/Inferentia silicon).
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {INFRA_BANDS.map((band) => {
                  const members = filtered
                    .filter((e) => e.infraBand === band.key)
                    .sort((a, b) => b.leadershipScore - a.leadershipScore);
                  return (
                    <div key={band.key} className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{band.label}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-500">{band.note}</p>
                      <div className="mt-3 space-y-1.5">
                        {members.length ? members.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedId(e.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left text-xs transition-colors ${
                              e.id === selectedEntity.id
                                ? "border-[#192319] bg-[#eef2e8] dark:border-white dark:bg-zinc-900"
                                : "border-[#dfe4da] hover:bg-[#eef2e8] dark:border-zinc-800 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <span className="font-medium text-[#18201b] dark:text-zinc-100">{e.name}</span>
                            {e.infraBandSecondary && (
                              <span className="rounded bg-[#e8ede2] px-1.5 py-0.5 text-[10px] text-[#4d574b] dark:bg-zinc-800 dark:text-zinc-400">
                                +{INFRA_BAND_LABEL[e.infraBandSecondary]}
                              </span>
                            )}
                          </button>
                        )) : <span className="text-xs text-[#697362] dark:text-zinc-500">No tracked entity in this layer.</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const banded = new Set(INFRA_BANDS.map((b) => b.key));
                const other = filtered.filter((e) => !e.infraBand || !banded.has(e.infraBand));
                if (!other.length) return null;
                return (
                  <div className="mt-4 rounded-md border border-dashed border-[#d7ddd1] bg-transparent p-3 dark:border-zinc-700">
                    <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">Other / cross-layer exposure</h3>
                    <p className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-500">
                      Tracked here for their infrastructure exposure but not owned to a single layer — typically
                      data, application or model players whose infra role is incidental rather than primary.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {other.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedId(e.id)}
                          className={`rounded border px-2 py-1 text-xs transition-colors ${
                            e.id === selectedEntity.id
                              ? "border-[#192319] bg-[#eef2e8] dark:border-white dark:bg-zinc-900"
                              : "border-[#dfe4da] hover:bg-[#eef2e8] dark:border-zinc-800 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Panel>
          </section>
        )}

        <section id="leaderboard" className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Category-aware leaderboard">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[#697362] dark:text-zinc-500">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="6.5" cy="6.5" r="5" /><path d="M11 11l3 3" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name or role…"
                  className="w-full rounded-md border border-[#d7ddd1] bg-[#fbfcf8] py-1.5 pl-8 pr-3 text-xs text-[#18201b] placeholder:text-[#697362] focus:outline-none focus:ring-1 focus:ring-[#192319] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-400"
                />
              </div>
              <span className="whitespace-nowrap text-[11px] text-[#697362] dark:text-zinc-500">
                {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
                {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}
                {" "}· hover for score history
              </span>
            </div>
            {category === "all" && (
              <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-[11px] leading-4 text-emerald-900/80 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200/70">
                <span className="font-semibold">Grouped by layer.</span> Vendors are ranked only within their own layer — platforms against platforms, models against models. No cross-layer composite ranking is shown: the layers measure different things, so a single all-market ordering would mislead.
              </p>
            )}
            {categoryRoles.length > 0 && (
              <p className="mb-3 rounded-md border border-sky-200 bg-sky-50/60 px-3 py-1.5 text-[11px] leading-4 text-sky-900/80 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200/70">
                <span className="font-semibold">AI-scoped to the {selectedOption.label} lens.</span> Multi-role giants are ranked by their score <em>in this role</em>, not their global composite — so e.g. Microsoft appears here on its first-party model strength, not its platform score. Rows tagged <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">role-scoped</span> are showing a role-specific number.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] text-left text-sm">
                <thead className="border-b border-[#e7ebe2] text-[11px] uppercase tracking-wide text-[#697362] dark:border-zinc-800 dark:text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3" title="Rank within the current layer or category lens only — not an all-market position">#</th>
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3 text-right" title="Leadership score in the active role context — distribution, product, ecosystem, execution">Leadership</th>
                    <th className="py-2 pr-3 text-right" title="R&D velocity, product launch cadence, differentiation vs peers">Innovation</th>
                    <th className="py-2 pr-3 text-right" title="Enterprise readiness: compliance, SLAs, integrations, governance posture">Readiness</th>
                    <th className="py-2 pr-3 text-right" title="Trailing momentum across news, product and partnership signals">Momentum</th>
                    <th className="py-2 pr-3 text-right" title="Ecosystem reach — integrations, partnerships, platform embeddedness">Reach</th>
                    <th className="py-2 pr-3 text-right" title="Directional share of named enterprise AI usage">Usage%</th>
                    <th className="py-2 pr-3" title="Operational risk profile (concentration, lock-in, counterparty)">Risk</th>
                    <th className="py-2 text-right" title="Analyst confidence in the evidence base">Conf%</th>
                    <th className="py-2 pl-1">Watch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
                  {category === "all"
                    ? groupedSections.map(({ def, members }) => (
                        <Fragment key={def.role}>
                          <tr>
                            <td colSpan={12} className="bg-[#071827] px-3 py-2.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#6EE7B7]">{def.title}</span>
                              <span className="ml-3 text-[11px] text-zinc-400">{def.note} Ranked within this layer only.</span>
                            </td>
                          </tr>
                          {members.map((entity, index) => renderEntityRow(entity, index, [def.role]))}
                        </Fragment>
                      ))
                    : filtered.map((entity, index) => renderEntityRow(entity, index, categoryRoles))}
                </tbody>
              </table>
            </div>
          </Panel>
          {/* Hover card — rendered outside the table so it's never clipped */}
          {hoverState && (
            <VendorScoreHoverCard
              vendorId={hoverState.id}
              entity={filtered.find((e) => e.id === hoverState.id) ?? null}
              anchorY={hoverState.y}
              anchorX={hoverState.x}
              onMouseEnter={handleCardEnter}
              onMouseLeave={handleCardLeave}
            />
          )}

          <Panel title="Entity detail">
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-[#18201b] dark:text-zinc-100">{selectedEntity.name}</h3>
                  <OwnershipBadge ownershipType={selectedEntity.ownership} compact />
                  <span className="rounded border border-[#d8ded0] px-1.5 py-0.5 text-xs text-[#495344] dark:border-zinc-700 dark:text-zinc-400">{selectedEntity.evidenceGrade}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {roleBadge(selectedEntity.primaryRole)}
                  {selectedEntity.secondaryRoles.map(roleBadge)}
                </div>
              </div>
              <p className="text-sm leading-6 text-[#2f392f] dark:text-zinc-300">{selectedEntity.cioInterpretation}</p>
              {selectedEntity.roleScores && <RoleScoreBreakdown entity={selectedEntity} />}
              <DetailList title="Models/products owned" items={selectedEntity.modelsOwned} empty="No material first-party model disclosed in this view." />
              <DetailList title="Hosted third-party models" items={selectedEntity.hostedThirdParty} />
              <DetailList title="Infrastructure exposure" items={selectedEntity.infrastructureExposure} />
              <DetailList title="Investor relationships" items={selectedEntity.investorRelationships} />
              <DetailList title="Hardware dependencies" items={selectedEntity.hardwareDependencies} />
              <div className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <span className="font-semibold text-[#18201b] dark:text-zinc-100">Data caveat: </span>
                {selectedEntity.dataCaveats}
              </div>
            </div>
          </Panel>
        </section>

        <section id="layer-winners" className="mt-6">
          <Panel title="Who is winning by layer">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {winningByLayer.map((layer) => (
                <div key={layer.title} className="border-l border-[#d6dccf] pl-4 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{layer.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#66705f] dark:text-zinc-500">{layer.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {layer.names.map((name) => (
                      <span key={name} className="rounded border border-[#dfe4da] px-2 py-1 text-xs dark:border-zinc-800">{name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section id="usage-share" className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Panel title="Share of named enterprise AI usage">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              Directional, evidence-labelled estimate. Not audited global market share.
              The bars below re-weight the original usage-share idea to the selected role category.
            </p>
            <div className="space-y-3">
              {filtered.slice(0, 10).map((entity) => (
                <div key={entity.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium"><VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} /></span>
                    <span className="font-mono">{entity.usageShare.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e8ede2] dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-[#2f5d50] dark:bg-emerald-400" style={{ width: `${Math.max(3, (entity.usageShare / maxShare) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Category share estimate">
            <div className="space-y-3">
              {normalizedShare.slice(0, 8).map(({ entity, share }) => (
                <div key={entity.id} className="flex items-center justify-between gap-3 border-b border-[#edf0ea] pb-2 text-sm last:border-0 dark:border-zinc-800">
                  <div>
                    <div className="font-medium text-[#18201b] dark:text-zinc-100">{entity.name}</div>
                    <div className="mt-1 text-xs text-[#697362] dark:text-zinc-500">{entity.primaryRole}</div>
                  </div>
                  <div className="font-mono text-lg font-semibold">{share.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section id="atlas" className="mt-6">
          <Panel title="Enhance x Innovate role map">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              X-axis is innovation / market momentum. Y-axis is enterprise readiness / execution.
              Bubble size is ecosystem reach; colour is primary category; outline is public/private/subsidiary; arrow shows movement since prior snapshot.
            </p>
            <RoleScatter entities={filtered} selectedId={selectedEntity.id} onSelect={setSelectedId} />
          </Panel>
        </section>

        <section id="movers" className="mt-6">
          <Panel title="Market movers by signal type">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MoverColumn title="Rising by leadership score" entities={movers.leadership} pick={(entity) => entity.deltas.leadership} />
              <MoverColumn title="Rising by ecosystem reach" entities={movers.reach} pick={(entity) => entity.deltas.reach} />
              <MoverColumn title="Rising by adoption" entities={movers.adoption} pick={(entity) => entity.deltas.adoption} />
              <MoverColumn title="Rising by infrastructure exposure" entities={movers.infrastructure} pick={(entity) => entity.deltas.infrastructure} />
              <MoverColumn title="Falling / risk increasing" entities={movers.risk} pick={(entity) => entity.deltas.risk} tone="risk" />
            </div>
          </Panel>
        </section>

        <section id="models" className="mt-6">
          <Panel title="Commercial models by vendor">
            <p className="mb-4 text-xs leading-5 text-[#5f685a] dark:text-zinc-400">
              Source-backed model availability should be grouped by ownership and hosting route. Hosted third-party models keep the original owner and should not be reattributed to the platform that hosts them.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {MODEL_GROUPS.map((group) => (
                <div key={group.title} className="rounded-md border border-[#e2e7dc] bg-[#fbfcf8] p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h3 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{group.title}</h3>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-[#596151] dark:text-zinc-400">
                    {group.items.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function DetailList({ title, items, empty = "None disclosed in this view." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((item) => (
          <span key={item} className="rounded border border-[#dfe4da] px-2 py-1 text-xs text-[#2f392f] dark:border-zinc-800 dark:text-zinc-300">{item}</span>
        )) : <span className="text-xs text-[#697362] dark:text-zinc-500">{empty}</span>}
      </div>
    </div>
  );
}

// AI-market role-score breakdown — shows WHY one composite misleads for a
// multi-role giant. Sorted by role leadership, highest first.
function RoleScoreBreakdown({ entity }: { entity: Entity }) {
  const rows = Object.entries(entity.roleScores ?? {}) as Array<[Role, RoleScore]>;
  if (!rows.length) return null;
  rows.sort((a, b) => b[1].leadership - a[1].leadership);
  const tierColour = (v: number) =>
    v >= 80 ? "text-emerald-700 dark:text-emerald-300" :
    v >= 60 ? "text-amber-700 dark:text-amber-300" :
    "text-rose-700 dark:text-rose-300";
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">AI-market role breakdown</span>
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">why one score misleads</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-sky-900/70 dark:text-sky-200/60">
        This entity plays multiple AI roles with genuinely different strength. Each lens below is scored on its own merits — the leaderboard ranks by the relevant role when you filter to a category.
      </p>
      <div className="mt-2.5 space-y-2">
        {rows.map(([role, rs]) => (
          <div key={role} className="border-l-2 border-sky-300 pl-2.5 dark:border-sky-800">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-[#18201b] dark:text-zinc-100">{role}</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${tierColour(rs.leadership)}`}>{rs.leadership}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-[#596151] dark:text-zinc-400">{rs.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoverColumn({ title, entities, pick, tone = "gain" }: { title: string; entities: Entity[]; pick: (entity: Entity) => number; tone?: "gain" | "risk" }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{title}</h3>
      <div className="mt-3 space-y-3">
        {entities.length ? entities.map((entity) => (
          <div key={entity.id} className="border-l border-[#d6dccf] pl-3 dark:border-zinc-800">
            <div className="text-sm font-medium text-[#18201b] dark:text-zinc-100">{entity.name}</div>
            <div className={`mt-1 font-mono text-xs ${tone === "risk" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {signed(pick(entity))}
            </div>
          </div>
        )) : <div className="text-xs text-[#697362] dark:text-zinc-500">No material signal.</div>}
      </div>
    </div>
  );
}

// ── Score helpers ──────────────────────────────────────────────────────────

/** Map a 0-100 score to a tier class for colour-coding. */
function scoreGrade(value: number): "top" | "mid" | "low" {
  if (value >= 80) return "top";
  if (value >= 60) return "mid";
  return "low";
}

function ScoreCell({ value, delta, tier }: { value: number; delta?: number; tier: "top" | "mid" | "low" }) {
  const colour =
    tier === "top" ? "text-emerald-700 dark:text-emerald-300" :
    tier === "mid" ? "text-amber-700 dark:text-amber-300" :
    "text-rose-700 dark:text-rose-300";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${colour}`}>
      {value}
      {delta !== undefined && delta !== 0 && (
        <span className={`text-[10px] ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  );
}

// ── Vendor Score Hover Card ────────────────────────────────────────────────

interface VendorScoreHoverCardProps {
  vendorId: string;
  entity: Entity | null;
  anchorY: number;
  anchorX: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function VendorScoreHoverCard({ vendorId, entity, anchorY, anchorX, onMouseEnter, onMouseLeave }: VendorScoreHoverCardProps) {
  const [snapshots, setSnapshots] = useState<SnapshotPoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Return cached result immediately if available
    const cached = snapshotCache.get(vendorId);
    if (cached) { setSnapshots(cached); return; }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/vendors/${vendorId}/snapshots`)
      .then((r) => r.json())
      .then((d: { snapshots?: SnapshotPoint[] }) => {
        if (cancelled) return;
        const pts = d.snapshots ?? [];
        snapshotCache.set(vendorId, pts);
        setSnapshots(pts);
      })
      .catch(() => { if (!cancelled) setSnapshots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vendorId]);

  // Card dimensions
  const CARD_W = 300;
  const CARD_H = 180;
  const MARGIN = 12;

  // Clamp to viewport
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1400;
  const cardTop = Math.min(Math.max(MARGIN, anchorY - CARD_H / 2), viewportH - CARD_H - MARGIN);
  // Prefer right of the anchor; fall back to left if too close to edge
  const cardLeft = anchorX + 12 + CARD_W > viewportW - MARGIN
    ? anchorX - CARD_W - 12
    : anchorX + 12;

  if (!entity) return null;

  return (
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      className="fixed z-50 rounded-lg border border-[#d7ddd1] bg-white shadow-xl dark:border-zinc-700 dark:bg-[#0d1f2d] pointer-events-auto"
    >
      {/* Header */}
      <div className="border-b border-[#e7ebe2] px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{entity.name}</span>
          <span className="rounded border border-[#d8ded0] px-1.5 py-0.5 text-[10px] text-[#495344] dark:border-zinc-700 dark:text-zinc-400">{entity.evidenceGrade}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#697362] dark:text-zinc-500">{entity.primaryRole}</div>
      </div>

      {/* Score mini-grid */}
      <div className="grid grid-cols-3 gap-px border-b border-[#e7ebe2] bg-[#e7ebe2] dark:border-zinc-800 dark:bg-zinc-800">
        {[
          { label: "Leadership", value: entity.leadershipScore },
          { label: "Innovation", value: entity.innovation },
          { label: "Readiness", value: entity.readiness },
          { label: "Momentum", value: entity.momentum },
          { label: "Reach", value: entity.ecosystemReach },
          { label: "Confidence", value: entity.confidence },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center bg-white py-2 dark:bg-[#0d1f2d]">
            <span className={`text-base font-bold tabular-nums ${scoreGrade(value) === "top" ? "text-emerald-700 dark:text-emerald-300" : scoreGrade(value) === "mid" ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"}`}>
              {value}
            </span>
            <span className="text-[9px] uppercase tracking-wide text-[#697362] dark:text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Sparkline area */}
      <div className="px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
          Score history
        </div>
        {loading && (
          <div className="flex h-10 items-center justify-center text-[11px] text-[#697362] dark:text-zinc-500">
            Loading history…
          </div>
        )}
        {!loading && snapshots !== null && snapshots.length < 2 && (
          <div className="flex h-10 items-center justify-center text-[11px] text-[#697362] dark:text-zinc-500">
            {snapshots.length === 0 ? "No snapshot history yet — runs after next pipeline." : "Only 1 snapshot captured so far."}
          </div>
        )}
        {!loading && snapshots && snapshots.length >= 2 && (
          <ScoreSparkline snapshots={snapshots} />
        )}
      </div>
    </div>
  );
}

// ── Score sparkline (SVG, no library) ─────────────────────────────────────

function ScoreSparkline({ snapshots }: { snapshots: SnapshotPoint[] }) {
  const W = 268;
  const H = 52;
  const PAD = { top: 6, right: 4, bottom: 16, left: 26 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const scores = snapshots.map((s) => s.overallScore);
  const minScore = Math.max(0, Math.min(...scores) - 5);
  const maxScore = Math.min(100, Math.max(...scores) + 5);
  const scoreRange = maxScore - minScore || 1;

  const xScale = (i: number) => PAD.left + (i / (snapshots.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - ((v - minScore) / scoreRange) * innerH;

  const points = snapshots.map((s, i) => `${xScale(i)},${yScale(s.overallScore)}`).join(" ");

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const trend = last.overallScore - first.overallScore;
  const trendColour = trend > 0 ? "#10b981" : trend < 0 ? "#f43f5e" : "#94a3b8";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Gridline at mid-point */}
        {[minScore + scoreRange / 2].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={yScale(tick)} y2={yScale(tick)}
              stroke="#e2e7dc" strokeDasharray="3 4" strokeWidth="0.8"
              className="dark:stroke-zinc-800"
            />
            <text x={PAD.left - 3} y={yScale(tick) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        {/* Y-axis labels */}
        <text x={PAD.left - 3} y={yScale(maxScore) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(maxScore)}</text>
        <text x={PAD.left - 3} y={yScale(minScore) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(minScore)}</text>

        {/* Area fill */}
        <defs>
          <linearGradient id={`sparkGrad-${snapshots[0].date}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColour} stopOpacity="0.25" />
            <stop offset="100%" stopColor={trendColour} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={`${xScale(0)},${PAD.top + innerH} ${points} ${xScale(snapshots.length - 1)},${PAD.top + innerH}`}
          fill={`url(#sparkGrad-${snapshots[0].date})`}
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={trendColour}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* First/last dots */}
        <circle cx={xScale(0)} cy={yScale(first.overallScore)} r="2.5" fill={trendColour} opacity="0.6" />
        <circle cx={xScale(snapshots.length - 1)} cy={yScale(last.overallScore)} r="3" fill={trendColour} />

        {/* Date labels */}
        <text x={xScale(0)} y={H - 2} textAnchor="start" fontSize="8" fill="#94a3b8">{first.date.slice(5)}</text>
        <text x={xScale(snapshots.length - 1)} y={H - 2} textAnchor="end" fontSize="8" fill="#94a3b8">{last.date.slice(5)}</text>
      </svg>

      {/* Trend summary */}
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-[#697362] dark:text-zinc-500">{snapshots.length} snapshots</span>
        <span className={trend > 0 ? "text-emerald-700 dark:text-emerald-400" : trend < 0 ? "text-rose-700 dark:text-rose-400" : "text-zinc-500"}>
          {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"} {Math.abs(trend).toFixed(1)} pts since {first.date.slice(0, 7)}
        </span>
      </div>
    </div>
  );
}

function RoleScatter({ entities, selectedId, onSelect }: { entities: Entity[]; selectedId: string; onSelect: (id: string) => void }) {
  const width = 860;
  const height = 460;
  const pad = 56;
  const x = (value: number) => pad + ((value - 45) / 50) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - 45) / 50) * (height - pad * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]" role="img" aria-label="Enhance by innovate enterprise AI role map">
        <rect x="0" y="0" width={width} height={height} rx="12" fill="currentColor" className="text-[#fbfcf8] dark:text-zinc-950" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#a6b0a0" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#a6b0a0" strokeWidth="1" />
        {[55, 65, 75, 85].map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={pad} y2={height - pad} stroke="#dfe4da" strokeDasharray="4 6" />
            <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke="#dfe4da" strokeDasharray="4 6" />
            <text x={x(tick)} y={height - 22} textAnchor="middle" className="fill-[#697362] text-[11px]">{tick}</text>
            <text x={26} y={y(tick) + 4} className="fill-[#697362] text-[11px]">{tick}</text>
          </g>
        ))}
        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-[#4d574b] text-[12px] font-semibold">Innovation / market momentum</text>
        <text transform={`translate(14 ${height / 2}) rotate(-90)`} textAnchor="middle" className="fill-[#4d574b] text-[12px] font-semibold">Enterprise readiness / execution</text>
        {entities.map((entity) => {
          const cx = x(entity.innovation);
          const cy = y(entity.readiness);
          const r = Math.max(8, Math.min(22, entity.ecosystemReach / 4.4));
          const tone = ROLE_TONE[entity.primaryRole];
          const selected = entity.id === selectedId;
          const stroke = entity.ownership === "public" ? "#059669" : entity.ownership === "subsidiary" ? "#0284c7" : "#7c3aed";
          return (
            <g key={entity.id} className="cursor-pointer" onClick={() => onSelect(entity.id)}>
              <line x1={cx - entity.movement.dx * 5} y1={cy + entity.movement.dy * 5} x2={cx} y2={cy} stroke={tone.fill} strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.75" />
              <circle cx={cx} cy={cy} r={r} fill={tone.fill} fillOpacity={selected ? 0.95 : 0.72} stroke={selected ? "#111827" : stroke} strokeWidth={selected ? 3 : 2} />
              <text x={cx + r + 5} y={cy + 4} className="fill-[#18201b] text-[11px] font-semibold dark:fill-zinc-100">{entity.name}</text>
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
          </marker>
        </defs>
      </svg>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {Array.from(new Set(entities.map((entity) => entity.primaryRole))).map((role) => (
          <span key={role} className={`rounded border border-current/20 px-2 py-1 ${ROLE_TONE[role].bg} ${ROLE_TONE[role].text}`}>{role}</span>
        ))}
      </div>
    </div>
  );
}
