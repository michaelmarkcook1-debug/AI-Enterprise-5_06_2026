"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Metric, Panel, SeedDataBadge, EvidenceDepthBadge, lowEvidenceClass } from "@/components/intelligence-ui";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  type Role,
  type Entity,
  type InfraBand,
  type RoleScore,
  rolesFor,
  roleLeadership,
} from "@/lib/intelligence/entities";
import ExecutiveBrief from "@/components/query/ExecutiveBrief";
import WatchButton from "@/components/query/WatchButton";
import CollapsiblePanel from "@/components/collapsible-panel";
import AnalystInsight from "@/components/analyst-insight";
import { entityInsight } from "@/lib/insights/tab-insights";

type WinningLayer = { title: string; names: string[]; note: string };

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

// C13 — Investors / Sovereign / Regulator are LENSES, not vendor rankings, so
// they are NOT selectable ranking categories here (they live on the vendor
// profile as a lens and in the dependency graph). Only rankable layers + the
// cross-cutting "vertical" tag remain as filters.
type CategoryKey =
  | "all"
  | "platforms"
  | "models"
  | "applications"
  | "infrastructure"
  | "hardware"
  | "vertical";

// C13 — leaderboard sections follow the standard stack (Model → Platform →
// Application → Infra/Compute → Hardware) plus cross-cutting tags. Investors,
// Sovereign and Regulators are LENSES, not vendor rankings, so they are NOT
// leaderboard sections. Model + Platform lead the order (highest buyer interest).
const ALL_VIEW_SECTIONS: Array<{ title: string; role: Role; note: string }> = [
  { title: "Model Providers", role: "Model Provider", note: "Quality, cadence, deployment paths and model economics." },
  { title: "Platform Vendors", role: "Platform Vendor", note: "Distribution, cloud control and enterprise-governance depth." },
  { title: "Application Vendors", role: "Application Vendor", note: "Workflow conversion, domain fit and business-user adoption." },
  { title: "Infrastructure Players", role: "Infrastructure Player", note: "Hosting, scale, deployment and compute access." },
  { title: "Cloud / Hosting Providers", role: "Cloud / Hosting Provider" as Role, note: "Cloud and hosting capacity behind AI deployment." },
  { title: "Data & Services Providers", role: "Data & Services Provider" as Role, note: "Governed data platforms and AI services layers." },
  { title: "Hardware", role: "Hardware Provider", note: "Accelerators, networking, custom silicon and fabrication." },
  { title: "Vertical Specialists", role: "Vertical Specialist" as Role, note: "Domain-specific AI for legal, finance and regulated workflows." },
  { title: "Open-Source Ecosystem", role: "Open-Source Ecosystem" as Role, note: "Open-weight model and tooling ecosystems." },
];

// "all" is kept as an internal state key but its button is NOT rendered.
// Clicking any active category deselects it and returns to the grouped "all" view.
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
    key: "hardware",
    label: "Hardware",
    roles: ["Hardware Provider"],
    summary: "GPU, accelerator, networking, fabrication and semiconductor ecosystem players.",
    interpretation: "Hardware leadership is an upstream dependency signal. It matters for supply assurance, training economics and pricing power, not only direct buyer selection.",
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
  "Regulator / Policy Actor": { bg: "bg-[#ece3cb] dark:bg-[#143049]", text: "text-[#2e3f57] dark:text-[#c2d1e0]", fill: "#71717a" },
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

function activeRoleFor(entity: Entity, categoryRoles: Role[]): Role | null {
  if (!categoryRoles.length) return null;
  return rolesFor(entity).find((r) => categoryRoles.includes(r)) ?? null;
}

interface EffectiveScore {
  leadership: number;
  innovation: number;
  readiness: number;
  reach: number;
  confidence: number;
  roleScored: Role | null;
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

// Neutral outline chip — role colour lives in the scatter chart only, so the
// table reads as one calm surface instead of a dozen competing pastels.
function roleBadge(role: Role) {
  return (
    <span key={role} className="inline-flex items-center gap-1.5 rounded-sm border border-[#13294b]/15 px-1.5 py-0.5 text-[11px] font-medium text-[#3f5068] dark:border-white/15 dark:text-[#c2d1e0]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ROLE_TONE[role].fill }} />
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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

  const toggleSection = useCallback((role: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  const selectedOption = CATEGORY_OPTIONS.find((option) => option.key === category) ?? CATEGORY_OPTIONS[0];
  const categoryRoles = selectedOption.roles;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entities
      .filter((entity) => matchesCategory(entity, category))
      .filter((entity) => !q || entity.name.toLowerCase().includes(q) || entity.primaryRole.toLowerCase().includes(q))
      .sort((a, b) => effectiveScore(b, categoryRoles).leadership - effectiveScore(a, categoryRoles).leadership);
  }, [category, categoryRoles, entities, searchQuery]);

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
    // Clicking the active category deselects it → returns to grouped "all" view
    if (nextCategory === category) {
      setCategory("all");
      setSelectedId(entities[0]?.id ?? "");
      return;
    }
    const nextOption = CATEGORY_OPTIONS.find((o) => o.key === nextCategory);
    const nextRoles = nextOption?.roles ?? [];
    const nextFiltered = entities
      .filter((entity) => matchesCategory(entity, nextCategory))
      .sort((a, b) => effectiveScore(b, nextRoles).leadership - effectiveScore(a, nextRoles).leadership);
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

  const renderEntityRow = (entity: Entity, index: number, scopeRoles: Role[]) => {
    const active = entity.id === selectedEntity.id;
    const es = effectiveScore(entity, scopeRoles);
    // De-emphasise (never hide) the numeric score cells when the vendor's scores
    // aren't backed by verified evidence; the badge in the name cell names why.
    const lowEv = lowEvidenceClass(entity.evidenceDepth);
    return (
      <tr
        key={entity.id}
        onClick={() => setSelectedId(entity.id)}
        onMouseEnter={(e) => handleRowEnter(entity.id, e)}
        onMouseLeave={handleRowLeave}
        className={`cursor-pointer transition-colors ${active ? "bg-[#f7f0dc] shadow-[inset_2px_0_0_#d4af37] dark:bg-[#0e2740] dark:shadow-[inset_2px_0_0_#d4af37]" : "hover:bg-[#faf5e9] dark:hover:bg-[#0e2740]/60"}`}
      >
        <td className="py-2.5 pr-3 font-mono text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">
          <span className="inline-flex items-center gap-0.5">
            {active && (
              <span className="animate-pulse font-bold text-[#d4af37] text-sm leading-none">›</span>
            )}
            {index + 1}
          </span>
        </td>
        <td className="py-2.5 pr-3 font-semibold text-[#13294b] dark:text-[#eef3f8]">
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
          {entity.dataConfidence !== "verified" && (
            <div className="mt-1"><EvidenceDepthBadge depth={entity.evidenceDepth} /></div>
          )}
        </td>
        <td className="py-2.5 pr-3">{roleBadge(es.roleScored ?? entity.primaryRole)}</td>
        <td className={`py-2.5 pr-3 text-right ${lowEv}`}>
          <ScoreCell value={es.leadership} delta={es.roleScored ? undefined : entity.deltas.leadership} tier={scoreGrade(es.leadership)} />
        </td>
        <td className={`py-2.5 pr-3 text-right ${lowEv}`}>
          <ScoreCell value={es.innovation} tier={scoreGrade(es.innovation)} />
        </td>
        <td className={`py-2.5 pr-3 text-right ${lowEv}`}>
          <ScoreCell value={es.readiness} tier={scoreGrade(es.readiness)} />
        </td>
        <td className={`py-2.5 pr-3 text-right ${lowEv}`}>
          <ScoreCell value={entity.momentum} delta={entity.deltas.leadership} tier={scoreGrade(entity.momentum)} />
        </td>
        <td className={`py-2.5 pr-3 text-right ${lowEv}`}>
          <ScoreCell value={es.reach} delta={es.roleScored ? undefined : entity.deltas.reach} tier={scoreGrade(es.reach)} />
        </td>
        <td className={`py-2.5 pr-3 text-right font-mono text-xs text-[#475a72] dark:text-[#a7bacd] ${lowEv}`}>{entity.usageShare.toFixed(1)}%</td>
        <td className={`py-2.5 pr-3 text-xs font-semibold uppercase ${riskClass(entity.risk)}`}>{entity.risk}</td>
        <td className="py-2.5 text-right font-mono text-xs text-[#475a72] dark:text-[#a7bacd]">{entity.evidenceDepth > 0 ? `${entity.evidenceDepth}✓` : "0"}</td>
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
          {/* "all" key is intentionally excluded — grouped view is the default state */}
          {CATEGORY_OPTIONS.filter((option) => option.key !== "all").map((option) => {
            const active = option.key === category;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => chooseCategory(option.key)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[#13294b] bg-[#13294b] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0a1f38]"
                    : "border-[#ddd3b6] bg-[#fdfaf1] text-[#475a72] hover:bg-[#f3ead2] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#c2d1e0] dark:hover:bg-[#143049]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {category !== "all" && (
            <button
              type="button"
              onClick={() => chooseCategory("all")}
              className="rounded-md border border-dashed border-[#ddd3b6] px-3 py-2 text-xs text-[#5b6b7f] hover:bg-[#f3ead2] dark:border-[#2a4a6b] dark:text-[#8fa5bb] dark:hover:bg-[#143049]"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">Category summary</div>
            <div className="mt-2 text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{selectedOption.label}</div>
            <p className="mt-2 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{selectedOption.summary}</p>
          </div>
          <div className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">CIO interpretation</div>
            <p className="mt-2 text-sm leading-6 text-[#2c3b52] dark:text-[#c2d1e0]">{selectedOption.interpretation}</p>
          </div>
        </div>
      </Panel>

      {category === "infrastructure" && (
        <section id="infra-bands" className="mt-6">
          <Panel title="Infrastructure by layer">
            <p className="mb-4 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
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
                  <div key={band.key} className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
                    <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{band.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#5d6b80] dark:text-[#8fa5bb]">{band.note}</p>
                    <div className="mt-3 space-y-1.5">
                      {members.length ? members.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedId(e.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left text-xs transition-colors ${
                            e.id === selectedEntity.id
                              ? "border-[#13294b] bg-[#f3ead2] dark:border-white dark:bg-[#0c2238]"
                              : "border-[#e6dcc3] hover:bg-[#f3ead2] dark:border-[#1d3a57] dark:hover:bg-[#0c2238]"
                          }`}
                        >
                          <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{e.name}</span>
                          {e.infraBandSecondary && (
                            <span className="rounded bg-[#ece3cb] px-1.5 py-0.5 text-[10px] text-[#475a72] dark:bg-[#143049] dark:text-[#a7bacd]">
                              +{INFRA_BAND_LABEL[e.infraBandSecondary]}
                            </span>
                          )}
                        </button>
                      )) : <span className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">No tracked entity in this layer.</span>}
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
                <div className="mt-4 rounded-md border border-dashed border-[#ddd3b6] bg-transparent p-3 dark:border-[#2a4a6b]">
                  <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">Other / cross-layer exposure</h3>
                  <p className="mt-1 text-xs leading-5 text-[#5d6b80] dark:text-[#8fa5bb]">
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
                            ? "border-[#13294b] bg-[#f3ead2] dark:border-white dark:bg-[#0c2238]"
                            : "border-[#e6dcc3] hover:bg-[#f3ead2] dark:border-[#1d3a57] dark:hover:bg-[#0c2238]"
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

      {/* ── Leaderboard — full width, no side panel ──────────────────────────── */}
      <section id="leaderboard" className="mt-6">
        <Panel title="Category-aware leaderboard">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[#5b6b7f] dark:text-[#8fa5bb]">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="6.5" cy="6.5" r="5" /><path d="M11 11l3 3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or role…"
                className="w-full rounded-md border border-[#ddd3b6] bg-[#fdfaf1] py-1.5 pl-8 pr-3 text-xs text-[#13294b] placeholder:text-[#5b6b7f] focus:outline-none focus:ring-1 focus:ring-[#13294b] dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#eef3f8] dark:placeholder:text-[#4c5d75] dark:focus:ring-[#d4af37]"
              />
            </div>
            <span className="whitespace-nowrap text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">
              {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
              {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}
              {" "}· hover for score history
            </span>
          </div>
          {category === "all" && (
            <p className="mb-4 border-l-2 border-[#d4af37] pl-3 text-xs leading-5 text-[#3f5068] dark:text-[#a7bacd]">
              <span className="font-semibold">Grouped by layer.</span> Vendors are ranked only within their own layer — platforms against platforms, models against models. Each section shows the top 2 by default — click <span className="font-semibold">Show all</span> to expand any layer.
            </p>
          )}
          {categoryRoles.length > 0 && (
            <p className="mb-4 border-l-2 border-[#d4af37] pl-3 text-xs leading-5 text-[#3f5068] dark:text-[#a7bacd]">
              <span className="font-semibold">AI-scoped to the {selectedOption.label} lens.</span> Multi-role giants are ranked by their score <em>in this role</em>, not their global composite. Rows tagged <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">role-scoped</span> are showing a role-specific number.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#ece4d0] text-[11px] uppercase tracking-wide text-[#5b6b7f] dark:border-[#1d3a57] dark:text-[#8fa5bb]">
                <tr>
                  <th className="py-2 pr-3" title="Rank within the current layer or category lens only">#</th>
                  <th className="py-2 pr-3">Entity</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3 text-right" title="Final score — the composite this ranking sorts on (market position + readiness + innovation; includes the Arena-ELO model-quality pillar). The columns to the right are its sub-components.">Final Score</th>
                  <th className="py-2 pr-3 text-right" title="R&D velocity, product launch cadence, differentiation vs peers">Innovation</th>
                  <th className="py-2 pr-3 text-right" title="Enterprise readiness: compliance, SLAs, integrations, governance posture">Readiness</th>
                  <th className="py-2 pr-3 text-right" title="Trailing momentum across news, product and partnership signals">Momentum</th>
                  <th className="py-2 pr-3 text-right" title="Ecosystem reach — integrations, partnerships, platform embeddedness">Reach</th>
                  <th className="py-2 pr-3 text-right" title="Directional share of named enterprise AI usage">Usage%</th>
                  <th className="py-2 pr-3" title="Operational risk profile (concentration, lock-in, counterparty)">Risk</th>
                  <th className="py-2 text-right" title="Count of analyst-verified evidence rows behind this vendor's scores. 0 = seed estimate (no verified evidence).">Evidence</th>
                  <th className="py-2 pl-1">Watch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efe9d9] dark:divide-[#1d3a57]">
                {category === "all"
                  ? groupedSections.map(({ def, members }) => {
                      const isExpanded = expandedSections.has(def.role);
                      const hasMore = members.length > 2;
                      const displayMembers = isExpanded ? members : members.slice(0, 2);
                      return (
                        <Fragment key={def.role}>
                          <tr>
                            <td colSpan={12} className="border-y border-[#d4af37]/25 bg-[#0a1f38] px-3 py-2.5 dark:bg-[#040f1c]">
                              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#e8c95c]">{def.title}</span>
                              <span className="ml-3 hidden text-[11px] text-[#8fa5bb] md:inline">{def.note}</span>
                            </td>
                          </tr>
                          {displayMembers.map((entity, index) => renderEntityRow(entity, index, [def.role]))}
                          {hasMore && (
                            <tr className="border-none">
                              <td colSpan={12} className="py-1.5 px-3 bg-[#f8faf6] dark:bg-[#0c2238]/40">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(def.role)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#54647a] hover:text-[#13294b] dark:text-[#a7bacd] dark:hover:text-[#eef3f8] transition-colors"
                                >
                                  {isExpanded ? (
                                    <>
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" className="rotate-180">
                                        <path d="M1 3l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Collapse
                                    </>
                                  ) : (
                                    <>
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path d="M1 3l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                      Show all {members.length} — {members.length - 2} more
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
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
      </section>

      {/* ── Entity detail — below the ranking table ──────────────────────────── */}
      <section id="entity-detail" className="mt-5">
        <Panel title="Entity detail">
          {/* Pulsing selection indicator */}
          <div className="mb-5 flex items-center gap-2 border-l-2 border-[#d4af37] py-0.5 pl-3">
            <span className="animate-pulse text-[#d4af37] text-base leading-none">▶</span>
            <span className="text-xs font-semibold text-[#6b5a23] dark:text-[#e8c95c]">{selectedEntity.name}</span>
            <span className="text-xs text-[#6b5a23]/60 dark:text-[#e8c95c]/60">— click any row above to change selection</span>
          </div>
          {/* Per-vendor analyst insight — derived from the same scores the row shows */}
          {(() => {
            const layerPeers = entities
              .filter((e) => e.primaryRole === selectedEntity.primaryRole)
              .sort((a, b) => roleLeadership(b, selectedEntity.primaryRole) - roleLeadership(a, selectedEntity.primaryRole));
            const rank = Math.max(1, layerPeers.findIndex((e) => e.id === selectedEntity.id) + 1);
            return (
              <AnalystInsight paragraph={entityInsight({
                name: selectedEntity.name,
                primaryRole: selectedEntity.primaryRole,
                leadership: roleLeadership(selectedEntity, selectedEntity.primaryRole),
                momentum: selectedEntity.momentum,
                readiness: selectedEntity.readiness,
                confidence: selectedEntity.confidence,
                risk: selectedEntity.risk,
                layerRank: rank,
                layerSize: layerPeers.length,
                leadershipDelta: selectedEntity.deltas.leadership,
              })} />
            );
          })()}
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-[#13294b] dark:text-[#eef3f8]">{selectedEntity.name}</h3>
                <OwnershipBadge ownershipType={selectedEntity.ownership} compact />
                <span className="rounded border border-[#e0d6ba] px-1.5 py-0.5 text-xs text-[#4a5a70] dark:border-[#2a4a6b] dark:text-[#a7bacd]">{selectedEntity.evidenceGrade}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {roleBadge(selectedEntity.primaryRole)}
                {selectedEntity.secondaryRoles.map(roleBadge)}
              </div>
            </div>
            <p className="text-sm leading-6 text-[#2c3b52] dark:text-[#c2d1e0]">{selectedEntity.cioInterpretation}</p>
            {selectedEntity.roleScores && <RoleScoreBreakdown entity={selectedEntity} />}
            <DetailList title="Models/products owned" items={selectedEntity.modelsOwned} empty="No material first-party model disclosed in this view." />
            <DetailList title="Hosted third-party models" items={selectedEntity.hostedThirdParty} />
            <DetailList title="Infrastructure exposure" items={selectedEntity.infrastructureExposure} />
            <DetailList title="Investor relationships" items={selectedEntity.investorRelationships} />
            <DetailList title="Hardware dependencies" items={selectedEntity.hardwareDependencies} />
            <div className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 text-xs leading-5 text-[#54647a] dark:border-[#1d3a57] dark:bg-[#081c30]/40 dark:text-[#a7bacd]">
              <span className="font-semibold text-[#13294b] dark:text-[#eef3f8]">Data caveat: </span>
              {selectedEntity.dataCaveats}
            </div>
          </div>
        </Panel>
      </section>

      {/* ── Usage share — ALWAYS within-layer. One panel; the former
            "Category share estimate" duplicate was deleted (12 Jun 2026). ── */}
      <section id="usage-share" className="mt-6">
        <CollapsiblePanel
          title="Share of named enterprise AI usage"
          summary={category === "all" ? "grouped by layer — vendors only compared with peers" : `top of the ${selectedOption.label} lens`}
          defaultOpen
        >
          <p className="mb-4 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
            Directional, evidence-labelled estimate — not audited global market share.
            Shares are normalised <span className="font-semibold">within each layer</span>, so a platform vendor is never measured against a model provider.
          </p>
          {category === "all" ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {groupedSections.slice(0, 6).map(({ def, members }) => {
                const layerTotal = members.reduce((sum, e) => sum + e.usageShare, 0) || 1;
                const layerMax = Math.max(...members.map((e) => e.usageShare), 1);
                return (
                  <div key={def.role} className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a07f1f] dark:text-[#d4af37]">{def.title}</h3>
                    <div className="mt-3 space-y-2.5">
                      {members.slice(0, 4).map((entity) => (
                        <div key={entity.id}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-[#13294b] dark:text-[#eef3f8]">{entity.name}</span>
                            <span className="font-mono text-[#475a72] dark:text-[#a7bacd]">{((entity.usageShare / layerTotal) * 100).toFixed(1)}% of layer</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#ece3cb] dark:bg-[#143049]">
                            <div className="h-full rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" style={{ width: `${Math.max(3, (entity.usageShare / layerMax) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {normalizedShare.slice(0, 10).map(({ entity, share }) => (
                <div key={entity.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium"><VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} /></span>
                    <span className="font-mono">{share.toFixed(1)}% of {selectedOption.label.toLowerCase()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#ece3cb] dark:bg-[#143049]">
                    <div className="h-full rounded-full bg-[#b08d2f] dark:bg-[#d4af37]" style={{ width: `${Math.max(3, (entity.usageShare / maxShare) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsiblePanel>
      </section>

      {/* ── Role map — one layer at a time, never cross-category ── */}
      <section id="role-map" className="mt-5">
        <CollapsiblePanel
          title="Readiness × innovation map"
          summary="one layer at a time — pick the layer inside"
          defaultOpen={false}
        >
          <p className="mb-4 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
            X-axis is innovation / market momentum; Y-axis is enterprise readiness / execution; bubble size is ecosystem reach.
            The map shows <span className="font-semibold">one layer at a time</span> — positioning is only meaningful between vendors playing the same role.
          </p>
          <RoleScatter entities={filtered} selectedId={selectedEntity.id} onSelect={setSelectedId} lockedRoles={categoryRoles} />
        </CollapsiblePanel>
      </section>

      <section id="movers" className="mt-5">
        <CollapsiblePanel
          title="Market movers by signal type"
          summary={`${movers.leadership.length + movers.reach.length + movers.adoption.length} positive signals this period`}
          defaultOpen={false}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MoverColumn title="Rising by leadership score" entities={movers.leadership} pick={(entity) => entity.deltas.leadership} />
            <MoverColumn title="Rising by ecosystem reach" entities={movers.reach} pick={(entity) => entity.deltas.reach} />
            <MoverColumn title="Rising by adoption" entities={movers.adoption} pick={(entity) => entity.deltas.adoption} />
            <MoverColumn title="Rising by infrastructure exposure" entities={movers.infrastructure} pick={(entity) => entity.deltas.infrastructure} />
            <MoverColumn title="Falling / risk increasing" entities={movers.risk} pick={(entity) => entity.deltas.risk} tone="risk" />
          </div>
        </CollapsiblePanel>
      </section>

      <section id="models" className="mt-5">
        <CollapsiblePanel
          title="Commercial models by vendor"
          summary={`${MODEL_GROUPS.length} ownership groups`}
          defaultOpen={false}
        >
          <p className="mb-4 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
            Source-backed model availability should be grouped by ownership and hosting route. Hosted third-party models keep the original owner and should not be reattributed to the platform that hosts them.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {MODEL_GROUPS.map((group) => (
              <div key={group.title} className="rounded-md border border-[#e9e0c8] bg-[#fdfaf1] p-3 dark:border-[#1d3a57] dark:bg-[#081c30]/40">
                <h3 className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{group.title}</h3>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
                  {group.items.map((item) => <li key={item}>- {item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CollapsiblePanel>
      </section>
    </div>
  );
}

function DetailList({ title, items, empty = "None disclosed in this view." }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length > 0 ? items.map((item) => (
          <span key={item} className="rounded border border-[#e6dcc3] px-2 py-1 text-xs text-[#2c3b52] dark:border-[#1d3a57] dark:text-[#c2d1e0]">{item}</span>
        )) : <span className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{empty}</span>}
      </div>
    </div>
  );
}

function RoleScoreBreakdown({ entity }: { entity: Entity }) {
  const rows = Object.entries(entity.roleScores ?? {}) as Array<[Role, RoleScore]>;
  if (!rows.length) return null;
  rows.sort((a, b) => b[1].leadership - a[1].leadership);
  const tierColour = (v: number) =>
    v >= 80 ? "text-emerald-700 dark:text-emerald-300" :
    v >= 60 ? "text-amber-700 dark:text-amber-300" :
    "text-rose-700 dark:text-rose-300";
  return (
    <div className="rounded-md border border-[#e3d9c0] bg-[#faf6ec] p-4 dark:border-[#1d3a57] dark:bg-[#081c30]">
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
              <span className="text-xs font-semibold text-[#13294b] dark:text-[#eef3f8]">{role}</span>
              <span className={`font-mono text-sm font-bold tabular-nums ${tierColour(rs.leadership)}`}>{rs.leadership}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-[#54647a] dark:text-[#a7bacd]">{rs.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoverColumn({ title, entities, pick, tone = "gain" }: { title: string; entities: Entity[]; pick: (entity: Entity) => number; tone?: "gain" | "risk" }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{title}</h3>
      <div className="mt-3 space-y-3">
        {entities.length ? entities.map((entity) => (
          <div key={entity.id} className="border-l border-[#dcd2b5] pl-3 dark:border-[#1d3a57]">
            <div className="text-sm font-medium text-[#13294b] dark:text-[#eef3f8]">{entity.name}</div>
            <div className={`mt-1 font-mono text-xs ${tone === "risk" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {signed(pick(entity))}
            </div>
          </div>
        )) : <div className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">No material signal.</div>}
      </div>
    </div>
  );
}

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

  const CARD_W = 300;
  const CARD_H = 180;
  const MARGIN = 12;

  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1400;
  const cardTop = Math.min(Math.max(MARGIN, anchorY - CARD_H / 2), viewportH - CARD_H - MARGIN);
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
      className="fixed z-50 rounded-lg border border-[#ddd3b6] bg-white shadow-xl dark:border-[#2a4a6b] dark:bg-[#0d1f2d] pointer-events-auto"
    >
      <div className="border-b border-[#ece4d0] px-4 py-2.5 dark:border-[#1d3a57]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#13294b] dark:text-[#eef3f8]">{entity.name}</span>
          <span className="rounded border border-[#e0d6ba] px-1.5 py-0.5 text-[10px] text-[#4a5a70] dark:border-[#2a4a6b] dark:text-[#a7bacd]">{entity.evidenceGrade}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">{entity.primaryRole}</div>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-[#ece4d0] bg-[#ece4d0] dark:border-[#1d3a57] dark:bg-[#143049]">
        {[
          { label: "Final Score", value: entity.leadershipScore },
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
            <span className="text-[9px] uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
          Score history
        </div>
        {loading && (
          <div className="flex h-10 items-center justify-center text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">
            Loading history…
          </div>
        )}
        {!loading && snapshots !== null && snapshots.length < 2 && (
          <div className="flex h-10 items-center justify-center text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">
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
        {[minScore + scoreRange / 2].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={yScale(tick)} y2={yScale(tick)}
              stroke="#e9e0c8" strokeDasharray="3 4" strokeWidth="0.8"
              className="dark:stroke-[#1d3a57]"
            />
            <text x={PAD.left - 3} y={yScale(tick) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <text x={PAD.left - 3} y={yScale(maxScore) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(maxScore)}</text>
        <text x={PAD.left - 3} y={yScale(minScore) + 3.5} textAnchor="end" fontSize="8" fill="#94a3b8">{Math.round(minScore)}</text>
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
        <polyline
          points={points}
          fill="none"
          stroke={trendColour}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xScale(0)} cy={yScale(first.overallScore)} r="2.5" fill={trendColour} opacity="0.6" />
        <circle cx={xScale(snapshots.length - 1)} cy={yScale(last.overallScore)} r="3" fill={trendColour} />
        <text x={xScale(0)} y={H - 2} textAnchor="start" fontSize="8" fill="#94a3b8">{first.date.slice(5)}</text>
        <text x={xScale(snapshots.length - 1)} y={H - 2} textAnchor="end" fontSize="8" fill="#94a3b8">{last.date.slice(5)}</text>
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="text-[#5b6b7f] dark:text-[#8fa5bb]">{snapshots.length} snapshots</span>
        <span className={trend > 0 ? "text-emerald-700 dark:text-emerald-400" : trend < 0 ? "text-rose-700 dark:text-rose-400" : "text-[#4c5d75]"}>
          {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"} {Math.abs(trend).toFixed(1)} pts since {first.date.slice(0, 7)}
        </span>
      </div>
    </div>
  );
}

function RoleScatter({
  entities,
  selectedId,
  onSelect,
  lockedRoles,
}: {
  entities: Entity[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Roles from the active category lens. Empty = grouped "all" view → an in-panel layer picker appears. */
  lockedRoles: Role[];
}) {
  const width = 860;
  const height = 460;
  const pad = 56;
  const x = (value: number) => pad + ((value - 45) / 50) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - 45) / 50) * (height - pad * 2);

  // Layers present in the current entity set, in canonical order.
  const presentRoles = useMemo(() => {
    const present = new Set(entities.map((e) => e.primaryRole));
    const ordered: Role[] = [
      "Model Provider", "Platform Vendor", "Application Vendor", "Infrastructure Player",
      "Hardware Provider", "Data & Services Provider", "Cloud / Hosting Provider",
      "Vertical Specialist", "Sovereign / Regional AI", "Investor", "Open-Source Ecosystem",
      "Regulator / Policy Actor",
    ];
    return ordered.filter((r) => present.has(r));
  }, [entities]);

  const [pickedRole, setPickedRole] = useState<Role | null>(null);
  // Resolve the single layer to draw: a category lens wins; otherwise the picker (default = first present layer).
  const activeRole: Role | null = lockedRoles.length > 0 ? null : (pickedRole && presentRoles.includes(pickedRole) ? pickedRole : presentRoles[0] ?? null);
  const scoped = lockedRoles.length > 0
    ? entities.filter((e) => lockedRoles.includes(e.primaryRole) || rolesFor(e).some((r) => lockedRoles.includes(r)))
    : entities.filter((e) => e.primaryRole === activeRole);

  // Label only what's readable: every bubble when the layer is small,
  // otherwise the selected vendor plus the widest-reach names.
  const labelled = useMemo(() => {
    if (scoped.length <= 14) return new Set(scoped.map((e) => e.id));
    const ids = new Set(
      [...scoped].sort((a, b) => b.ecosystemReach - a.ecosystemReach).slice(0, 12).map((e) => e.id),
    );
    ids.add(selectedId);
    return ids;
  }, [scoped, selectedId]);

  return (
    <div className="overflow-x-auto">
      {lockedRoles.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {presentRoles.map((role) => {
            const active = role === activeRole;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setPickedRole(role)}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-[#13294b] bg-[#13294b] text-white dark:border-[#d4af37] dark:bg-[#d4af37] dark:text-[#0a1f38]"
                    : "border-[#ddd3b6] bg-[#fdfaf1] text-[#475a72] hover:bg-[#f3ead2] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#c2d1e0] dark:hover:bg-[#143049]"
                }`}
              >
                <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: ROLE_TONE[role].fill }} />
                {role}
                <span className="ml-1.5 font-mono font-normal opacity-60">{entities.filter((e) => e.primaryRole === role).length}</span>
              </button>
            );
          })}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]" role="img" aria-label="Readiness by innovation map — one layer at a time">
        <rect x="0" y="0" width={width} height={height} rx="12" fill="currentColor" className="text-[#fdfaf1] dark:text-[#0c2238]" />
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#8fa0b5" strokeWidth="1" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#8fa0b5" strokeWidth="1" />
        {[55, 65, 75, 85].map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} x2={x(tick)} y1={pad} y2={height - pad} stroke="currentColor" strokeDasharray="4 6" className="text-[#e6dcc3] dark:text-[#2a4a6b]" />
            <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeDasharray="4 6" className="text-[#e6dcc3] dark:text-[#2a4a6b]" />
            <text x={x(tick)} y={height - 22} textAnchor="middle" className="fill-[#5b6b7f] text-[11px] dark:fill-[#8fa5bb]">{tick}</text>
            <text x={26} y={y(tick) + 4} className="fill-[#5b6b7f] text-[11px] dark:fill-[#8fa5bb]">{tick}</text>
          </g>
        ))}
        <text x={width / 2} y={height - 8} textAnchor="middle" className="fill-[#475a72] text-[12px] font-semibold dark:fill-[#a7bacd]">Innovation / market momentum</text>
        <text transform={`translate(14 ${height / 2}) rotate(-90)`} textAnchor="middle" className="fill-[#475a72] text-[12px] font-semibold dark:fill-[#a7bacd]">Enterprise readiness / execution</text>
        {scoped.map((entity) => {
          const cx = x(entity.innovation);
          const cy = y(entity.readiness);
          const r = Math.max(8, Math.min(22, entity.ecosystemReach / 4.4));
          const tone = ROLE_TONE[entity.primaryRole];
          const selected = entity.id === selectedId;
          const stroke = entity.ownership === "public" ? "#059669" : entity.ownership === "subsidiary" ? "#0284c7" : "#7c3aed";
          return (
            <g key={entity.id} className="cursor-pointer" onClick={() => onSelect(entity.id)}>
              <line x1={cx - entity.movement.dx * 5} y1={cy + entity.movement.dy * 5} x2={cx} y2={cy} stroke={tone.fill} strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.75" />
              <circle cx={cx} cy={cy} r={r} fill={tone.fill} fillOpacity={selected ? 0.95 : 0.72} stroke={selected ? "#d4af37" : stroke} strokeWidth={selected ? 3 : 2} />
              {labelled.has(entity.id) && (
                <text x={cx + r + 5} y={cy + 4} className="fill-[#13294b] text-[11px] font-semibold dark:fill-[#eef3f8]">{entity.name}</text>
              )}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L6,3 z" fill="#64748b" />
          </marker>
        </defs>
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5b6b7f] dark:text-[#8fa5bb]">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 border-[#059669] align-middle" /> public</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 border-[#7c3aed] align-middle" /> private</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 border-[#0284c7] align-middle" /> subsidiary</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border-2 border-[#d4af37] align-middle" /> selected</span>
        {scoped.length > 14 && <span className="italic">labels shown for the {labelled.size} widest-reach vendors to stay readable</span>}
      </div>
    </div>
  );
}
