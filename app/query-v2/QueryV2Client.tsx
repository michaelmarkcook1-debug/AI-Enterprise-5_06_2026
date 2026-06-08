"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Metric, Panel, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipBadge, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  type Role,
  type Entity,
  type InfraBand,
  rolesFor,
} from "@/lib/intelligence/entities";
import ExecutiveBrief from "@/components/query/ExecutiveBrief";

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

export default function QueryV2Client({ entities, winningByLayer }: { entities: Entity[]; winningByLayer: WinningLayer[] }) {
  const [category, setCategory] = useState<CategoryKey>("all");
  const [selectedId, setSelectedId] = useState(entities[0]?.id ?? "");

  const selectedOption = CATEGORY_OPTIONS.find((option) => option.key === category) ?? CATEGORY_OPTIONS[0];
  const filtered = useMemo(
    () => entities.filter((entity) => matchesCategory(entity, category)).sort((a, b) => b.leadershipScore - a.leadershipScore),
    [category, entities],
  );
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
            <div className="overflow-x-auto">
              <table className="min-w-[980px] text-left text-sm">
                <thead className="border-b border-[#e7ebe2] text-[11px] uppercase tracking-wide text-[#697362] dark:border-zinc-800 dark:text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Rank</th>
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Primary role</th>
                    <th className="py-2 pr-3">Secondary roles</th>
                    <th className="py-2 pr-3 text-right">Leadership</th>
                    <th className="py-2 pr-3 text-right">Momentum</th>
                    <th className="py-2 pr-3 text-right">Reach</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea] dark:divide-zinc-800">
                  {filtered.map((entity, index) => {
                    const active = entity.id === selectedEntity.id;
                    return (
                      <tr
                        key={entity.id}
                        onClick={() => setSelectedId(entity.id)}
                        className={`cursor-pointer transition-colors ${active ? "bg-[#eef2e8] dark:bg-zinc-900" : "hover:bg-[#f5f7f2] dark:hover:bg-zinc-900/70"}`}
                      >
                        <td className="py-3 pr-3 font-mono text-[#697362] dark:text-zinc-500">{index + 1}</td>
                        <td className="py-3 pr-3 font-semibold text-[#18201b] dark:text-zinc-100">
                          <VendorNameWithOwnership name={entity.name} ownershipType={entity.ownership} />
                        </td>
                        <td className="py-3 pr-3">{roleBadge(entity.primaryRole)}</td>
                        <td className="py-3 pr-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1">
                            {entity.secondaryRoles.slice(0, 4).map(roleBadge)}
                            {entity.secondaryRoles.length > 4 && <span className="text-xs text-[#697362] dark:text-zinc-500">+{entity.secondaryRoles.length - 4}</span>}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.leadershipScore}</td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.momentum}</td>
                        <td className="py-3 pr-3 text-right font-mono">{entity.ecosystemReach}</td>
                        <td className={`py-3 pr-3 text-xs font-semibold uppercase ${riskClass(entity.risk)}`}>{entity.risk}</td>
                        <td className="py-3 text-right font-mono">{entity.confidence}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

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
