"use client";

import { useMemo, useState, useCallback } from "react";
import type { Entity, Role } from "@/lib/intelligence/entities";
import { rolesFor, roleLeadership } from "@/lib/intelligence/entities";

interface MarketDevelopment {
  date: string;
  headline: string;
  entities: string[];
  analystTake: string;
  impact: "positive" | "negative" | "neutral" | "watch";
  source?: string;
}

interface Props {
  entities: Entity[];
  winningByLayer: { title: string; names: string[]; note: string }[];
  developments?: MarketDevelopment[];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function riskDistribution(entities: Entity[]) {
  const high = entities.filter((e) => e.risk === "high").length;
  const medium = entities.filter((e) => e.risk === "medium").length;
  const low = entities.filter((e) => e.risk === "low").length;
  return { high, medium, low };
}

function seedDevelopments(entities: Entity[]): MarketDevelopment[] {
  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));
  const totalUsageShare = entities.reduce((s, e) => s + e.usageShare, 0);
  const shareOf = (e: Entity) => totalUsageShare > 0 ? ((e.usageShare / totalUsageShare) * 100).toFixed(1) : "n/a";

  // Layer rosters ranked by the role-specific leadership score — vendors are
  // only compared within their layer (no cross-layer composite ranking).
  const byRoleLeadership = (role: Role) => (a: Entity, b: Entity) => roleLeadership(b, role) - roleLeadership(a, role);
  const modelProviders = entities.filter((e) => rolesFor(e).includes("Model Provider")).sort(byRoleLeadership("Model Provider"));
  const platformVendors = entities.filter((e) => rolesFor(e).includes("Platform Vendor")).sort(byRoleLeadership("Platform Vendor"));
  const hardwareProviders = entities.filter((e) => rolesFor(e).includes("Hardware Provider")).sort(byRoleLeadership("Hardware Provider"));
  const infraPlayers = entities.filter((e) => rolesFor(e).includes("Infrastructure Player")).sort(byRoleLeadership("Infrastructure Player"));

  const layerRankOf = (name: string, layer: Entity[]) => {
    const idx = layer.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
    return idx >= 0 ? idx + 1 : null;
  };

  const nvidia = byName.get("nvidia");
  const msft = byName.get("microsoft");
  const openai = byName.get("openai");
  const google = byName.get("google");
  const anthropic = byName.get("anthropic");
  const meta = byName.get("meta");
  const coreweave = byName.get("coreweave");
  const apple = byName.get("apple");

  const devs: MarketDevelopment[] = [
    {
      date: "2026-05-28",
      headline: "NVIDIA Q1 FY27: Record $81.6B revenue (+85% YoY), data-centre revenue hits $75.2B with Blackwell 300 ramp",
      entities: ["NVIDIA"],
      analystTake: nvidia
        ? `NVIDIA ranks #${layerRankOf("nvidia", hardwareProviders)} of ${hardwareProviders.length} hardware providers (leadership ${nvidia.leadershipScore}, momentum ${nvidia.momentum}). Data-centre compute revenue of $60.4B and networking revenue of $14.8B (+199% YoY) confirm structural dominance. Usage share sits at ${shareOf(nvidia)}% of the tracked universe. Hyperscale is ~50% of DC revenue, with the other 50% diversifying into AI clouds, enterprise, and sovereign customers — widening the moat. Ecosystem reach of ${nvidia.ecosystemReach} underscores CUDA lock-in. ${nvidia.risk}-risk at ${nvidia.confidence}% confidence reflects concentration dependency. CIOs should assume extended GPU lead-times and factor NVIDIA allocation into every infrastructure RFP.`
        : "NVIDIA posts record results driven by data-centre AI demand.",
      impact: "positive",
      source: "NVIDIA Q1 FY27 Earnings / CNBC",
    },
    {
      date: "2026-05-28",
      headline: "Microsoft Build 2026: Copilot Studio gets computer-using agents (GA), A2A protocol, and 6x MAU growth to 20M+ users",
      entities: ["Microsoft"],
      analystTake: msft
        ? `Microsoft holds #${layerRankOf("microsoft", platformVendors)} among ${platformVendors.length} platform vendors (leadership ${msft.leadershipScore}) — reinforced by ${shareOf(msft)}% usage share and ecosystem reach of ${msft.ecosystemReach}. Build 2026 signals production maturity: computer-using agents are now GA, agent-to-agent (A2A) communication enables cross-system orchestration, and the new orchestrator cuts token consumption 50% while improving evaluation 20%. The 6x MAU surge to 20M+ Copilot users confirms enterprise rollout is accelerating. New M365 Business SKUs with Copilot built-in (launching July 1) will push adoption into SMB. Innovation at ${msft.innovation}, readiness at ${msft.readiness}. CIOs on M365 face a narrowing window before switching costs become prohibitive.`
        : "Microsoft deepens enterprise AI integration with agentic capabilities.",
      impact: "positive",
      source: "Microsoft Build 2026 / VentureBeat",
    },
    {
      date: "2026-06-05",
      headline: "OpenAI launches Codex enterprise plugins, ChatGPT Lockdown Mode, and GPT-Rosalind for life sciences; workspace agents extended",
      entities: ["OpenAI"],
      analystTake: openai
        ? `OpenAI is #${layerRankOf("openai", modelProviders)} of ${modelProviders.length} model providers (leadership ${openai.leadershipScore}, momentum ${openai.momentum}). The six new Codex business plugins (sales, analytics, creative, design, equity research, investment banking) signal aggressive vertical enterprise expansion — moving beyond horizontal AI into workflow-specific tooling. Lockdown Mode for prompt-injection protection addresses a key enterprise security concern. Usage share at ${shareOf(openai)}% with innovation at ${openai.innovation}. The workspace-agents free-tier extension to July 6 suggests adoption is below target. ${openai.risk}-risk with ${openai.confidence}% confidence. CIOs should evaluate Codex plugins for specific workflows but avoid single-vendor lock-in across the agentic stack.`
        : "OpenAI expands enterprise tooling with vertical plugins and security features.",
      impact: "watch",
      source: "OpenAI Newsroom / Build Fast with AI",
    },
    {
      date: "2026-06-02",
      headline: "Google I/O 2026: Gemini 3.5 Flash launched, Ultra price cut to $200/mo, Gemini Omni for multimodal generation, 900M MAU",
      entities: ["Google"],
      analystTake: google
        ? `Google ranks #${layerRankOf("google", platformVendors)} among ${platformVendors.length} platform vendors and #${layerRankOf("google", modelProviders)} among ${modelProviders.length} model providers — uniquely competitive across both layers. Gemini 3.5 Flash with aggressive pricing signals a volume play; the Enterprise Agent Platform (evolution of Vertex AI) now provides access to 200+ models including third-party. 900M monthly users (up from 400M in May 2025) is consumer-driven but creates enterprise pipeline. Gemini Spark as a 24/7 personal AI agent for Workspace customers competes directly with Microsoft Copilot. Leadership ${google.leadershipScore}, ecosystem reach ${google.ecosystemReach}, usage share ${shareOf(google)}%. ${google.confidence}% confidence — strong observability.`
        : "Google accelerates enterprise AI with cheaper Gemini models and agentic platform.",
      impact: "positive",
      source: "Google I/O 2026 / Google Cloud Blog",
    },
    {
      date: "2026-06-01",
      headline: "Anthropic files for IPO; Bristol Myers Squibb deploys Claude Enterprise across global operations; SAP integration announced",
      entities: ["Anthropic"],
      analystTake: anthropic
        ? `Anthropic sits at #${layerRankOf("anthropic", modelProviders)} of ${modelProviders.length} model providers (leadership ${anthropic.leadershipScore}, momentum ${anthropic.momentum}). Three converging signals: the IPO filing positions Anthropic as a potential trillion-dollar debut; the BMS deal makes Claude the shared intelligence platform across pharma R&D, manufacturing, and commercial functions; the SAP integration puts Claude into S/4HANA, SuccessFactors, and Ariba workflows. Innovation at ${anthropic.innovation}, ecosystem reach ${anthropic.ecosystemReach} — the SAP and BMS deals should materially improve this. Usage share at ${shareOf(anthropic)}%. Managed Agents with enterprise-boundary MCP servers address the governance gap. CIOs in regulated industries should now include Anthropic in every RFP.`
        : "Anthropic files for IPO while landing major enterprise platform deals.",
      impact: "positive",
      source: "Washington Post / BMS / SAP News",
    },
    {
      date: "2026-04-08",
      headline: "Meta launches Llama 4 Scout and Maverick (multimodal MoE architecture); developing proprietary Avocado and Mango models",
      entities: ["Meta"],
      analystTake: meta
        ? `Meta is #${layerRankOf("meta", modelProviders)} among ${modelProviders.length} model providers (leadership ${meta.leadershipScore}). Llama 4 Scout and Maverick introduce mixture-of-experts architecture with native multimodality — available on Hugging Face and deployed across WhatsApp, Messenger, and Instagram. The parallel development of proprietary models (Avocado for LLM, Mango for multimedia) signals a strategic hedge: open-weight for ecosystem control, proprietary for premium capability. Usage share (${shareOf(meta)}%) understates actual deployment — Llama derivatives run across hyperscalers without attribution. Ecosystem reach ${meta.ecosystemReach}, innovation ${meta.innovation}. ${meta.risk}-risk at ${meta.confidence}% confidence. CIOs should benchmark Llama 4 MoE for cost-sensitive inference but monitor the open-vs-proprietary trajectory.`
        : "Meta's Llama 4 introduces multimodal MoE while developing proprietary alternatives.",
      impact: "neutral",
      source: "Meta AI Blog / SiliconANGLE",
    },
    {
      date: "2026-06-02",
      headline: "CoreWeave Q1 2026: Revenue $2.08B (+112% YoY), backlog surges to $99.4B including $21B Meta commitment; stock down 51% from peak",
      entities: ["CoreWeave"],
      analystTake: coreweave
        ? `CoreWeave ranks #${layerRankOf("coreweave", infraPlayers)} among ${infraPlayers.length} infrastructure players (leadership ${coreweave.leadershipScore}). The $99.4B backlog headline is impressive but masks structural risk: $50.8B in liabilities against volatile revenue, 51% stock decline from peak, and heavy customer concentration (the $21B Meta commitment is a double-edged sword). ${coreweave.risk}-risk at ${coreweave.confidence}% confidence — one of the thinnest evidence profiles in the infrastructure layer. Usage share ${shareOf(coreweave)}%, ecosystem reach ${coreweave.ecosystemReach}. Full-year guidance of $12-13B implies aggressive growth assumptions. CIOs should treat CoreWeave as supplementary GPU capacity with strong contractual protections, not a primary infrastructure partner.`
        : "CoreWeave revenue doubles but debt load and customer concentration raise sustainability questions.",
      impact: "negative",
      source: "Yahoo Finance / 24/7 Wall St",
    },
    {
      date: "2026-06-08",
      headline: "WWDC 2026: Apple relaunches Siri with Gemini backbone, standalone AI app to rival ChatGPT; paid Siri subscription planned",
      entities: ["Apple"],
      analystTake: apple
        ? `Apple (leadership ${apple.leadershipScore}, momentum ${apple.momentum}) sits mid-table within its layer, but WWDC 2026 signals a strategic reset. The Gemini-powered Siri relaunch with cross-app task execution and a standalone AI app positions Apple as a distribution channel for Google's models — a dependency that cuts both ways. Readiness ${apple.readiness}, ecosystem reach ${apple.ecosystemReach} — deep device-fleet penetration that no cloud provider matches. The paid Siri subscription signals Apple is treating AI as a services-revenue driver, not just a feature. Usage share ${shareOf(apple)}% in the AI universe is modest but understates the 2B+ device install base. Innovation ${apple.innovation}, ${apple.confidence}% confidence. For CIOs, the on-device processing promise remains the key enterprise differentiator — but the Gemini dependency adds a new counterparty risk to evaluate.`
        : "Apple's WWDC 2026 reveals Gemini-powered Siri relaunch and standalone AI app.",
      impact: "watch",
      source: "Bloomberg / TechCrunch / Yahoo Finance",
    },
  ];

  return devs.filter((d) => d.entities.some((name) => byName.has(name.toLowerCase())));
}

const IMPACT_COLORS: Record<MarketDevelopment["impact"], { bg: string; text: string; label: string }> = {
  positive: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", label: "Positive Signal" },
  negative: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", label: "Risk Signal" },
  neutral: { bg: "bg-[#f6f1e3] dark:bg-[#0d1f17]/30", text: "text-[#3f5068] dark:text-[#a7bacd]", label: "Market Shift" },
  watch: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", label: "Watch" },
};

function generateBrief(entities: Entity[], winningByLayer: { title: string; names: string[] }[]) {
  const total = entities.length;
  const avgConfidence = Math.round(average(entities.map((e) => e.confidence)));
  const avgLeadership = Math.round(average(entities.map((e) => e.leadershipScore)));
  const avgMomentum = Math.round(average(entities.map((e) => e.momentum)));
  const risk = riskDistribution(entities);

  // Leaders BY LAYER (top 1-2 per layer) — replaces the old flat composite
  // top-5: there is no honest single ranking across platforms / models /
  // hardware / investors, so leadership is only reported within a layer.
  const leadersByLayer = winningByLayer.map((l) => ({ title: l.title, names: l.names.slice(0, 2) }));
  const fastestMovers = entities
    .filter((e) => e.deltas.leadership > 0)
    .sort((a, b) => b.deltas.leadership - a.deltas.leadership)
    .slice(0, 3);
  const risingAdoption = entities
    .filter((e) => e.deltas.adoption > 0)
    .sort((a, b) => b.deltas.adoption - a.deltas.adoption)
    .slice(0, 3);
  const highRiskEntities = entities
    .filter((e) => e.risk === "high")
    .sort((a, b) => b.leadershipScore - a.leadershipScore)
    .slice(0, 3);

  const roleCounts = new Map<Role, number>();
  for (const e of entities) {
    for (const r of rolesFor(e)) {
      roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
    }
  }
  const topRoles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([role, count]) => ({ role, count }));

  const platformWinners = winningByLayer.find((l) => l.title === "Platform Vendors")?.names.slice(0, 3) ?? [];
  const modelWinners = winningByLayer.find((l) => l.title === "Model Providers")?.names.slice(0, 3) ?? [];

  return {
    total,
    avgConfidence,
    avgLeadership,
    avgMomentum,
    risk,
    leadersByLayer,
    fastestMovers,
    risingAdoption,
    highRiskEntities,
    topRoles,
    platformWinners,
    modelWinners,
  };
}

const AG_LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="12" fill="#081410"/>
  <circle cx="32" cy="32" r="7" fill="#e8c95c"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#e8c95c" stroke-width="3"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#F5C451" stroke-width="3" transform="rotate(60 32 32)"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#F6F0E7" stroke-width="3" transform="rotate(120 32 32)"/>
  <circle cx="50" cy="25" r="3.5" fill="#F5C451"/>
</svg>`;

const CEO_BIO =
  "Michael Cook is CEO of AnalystGenius. With over a decade of experience spanning " +
  "analyst research, advisory, and go-to-market strategy across the IT and BPO services " +
  "landscape, Michael has held senior positions at NelsonHall, HfS Research, Cognizant's " +
  "Center for the Future of Work, IDC, and Capgemini. He has advised the world's leading " +
  "service providers on vendor positioning, enterprise AI adoption, and workforce " +
  "transformation — and brings deep cross-market expertise to every AnalystGenius engagement.";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function timestamp() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

async function fetchHeadshotBase64(): Promise<string> {
  try {
    const res = await fetch("/brand/michael-cook-ceo.jpg", {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!res.ok) return "";
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function renderExportHtml(brief: ReturnType<typeof generateBrief>, headshotDataUri: string, developments: MarketDevelopment[]): string {
  const headshot = headshotDataUri
    ? `<img src="${headshotDataUri}" alt="Michael Cook" class="headshot" />`
    : `<div class="headshot-placeholder">MC</div>`;

  const layerLeaderRows = brief.leadersByLayer.map((l) =>
    `<tr><td><strong>${esc(l.title)}</strong></td><td>${l.names.map(esc).join(", ") || "—"}</td></tr>`
  ).join("");

  const moversList = brief.fastestMovers.map((e) =>
    `<li><strong>${esc(e.name)}</strong> — leadership +${e.deltas.leadership}</li>`
  ).join("") || "<li>No material movement detected.</li>";

  const adoptionList = brief.risingAdoption.map((e) =>
    `<li><strong>${esc(e.name)}</strong> — adoption +${e.deltas.adoption}</li>`
  ).join("") || "<li>No material adoption signal.</li>";

  const riskList = brief.highRiskEntities.map((e) =>
    `<li><strong>${esc(e.name)}</strong> (Score: ${e.leadershipScore}, Confidence: ${e.confidence}%) — ${esc(e.cioInterpretation.slice(0, 120))}…</li>`
  ).join("") || "<li>No high-risk entities in current universe.</li>";

  const roleBreakdown = brief.topRoles.map((r) =>
    `<tr><td>${esc(r.role)}</td><td>${r.count}</td></tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Executive Brief — Enterprise AI Market Intelligence — AnalystGenius</title>
<style>
  :root { color-scheme: light; }
  @page { margin: 20mm 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 13px/1.6 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #123d2c; max-width: 860px; margin: 0 auto; padding: 32px 28px; }
  .ag-header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #081410; padding-bottom: 14px; margin-bottom: 6px; }
  .ag-header .logo { flex-shrink: 0; }
  .ag-header .brand { flex: 1; }
  .ag-header .brand-name { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #081410; }
  .ag-header .brand-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #5b6b7f; margin-top: 1px; }
  .ag-header .confidentiality { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #fff; background: #081410; padding: 4px 12px; border-radius: 4px; font-weight: 600; }
  .doc-title { font-size: 22px; font-weight: 700; color: #081410; margin: 18px 0 2px; letter-spacing: -0.01em; }
  .doc-meta { font-size: 11px; color: #5b6b7f; margin-bottom: 24px; }
  h2 { font-size: 15px; font-weight: 700; color: #081410; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #eae2cc; }
  h3 { font-size: 13px; font-weight: 700; color: #2d3a2b; margin: 16px 0 6px; }
  p { margin: 6px 0; }
  ul { padding-left: 20px; margin: 6px 0; }
  li { margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0 16px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6b7f; padding: 6px 8px; border-bottom: 2px solid #081410; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #efe9d9; vertical-align: top; }
  .score-row { display: flex; gap: 16px; margin: 12px 0 20px; }
  .score-card { flex: 1; border: 1px solid #e6dcc3; border-radius: 10px; padding: 14px 16px; text-align: center; }
  .score-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #5b6b7f; font-weight: 600; }
  .score-card .value { font-size: 32px; font-weight: 700; color: #081410; margin: 4px 0 2px; }
  .score-card .sub { font-size: 10px; color: #5b6b7f; }
  .severity-high { color: #e11d48; font-weight: 600; }
  .severity-medium { color: #d97706; font-weight: 600; }
  .severity-low { color: #059669; font-weight: 600; }
  .narrative { background: #f8faf6; border: 1px solid #eae2cc; border-radius: 8px; padding: 16px; margin: 16px 0; line-height: 1.7; }
  .dev-card { border: 1px solid #eae2cc; border-radius: 8px; padding: 14px 16px; margin: 10px 0; page-break-inside: avoid; }
  .dev-card.positive { border-left: 4px solid #059669; background: #f0fdf4; }
  .dev-card.negative { border-left: 4px solid #e11d48; background: #fff1f2; }
  .dev-card.neutral { border-left: 4px solid #6b7280; background: #f9fafb; }
  .dev-card.watch { border-left: 4px solid #d97706; background: #fffbeb; }
  .dev-meta { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6b7f; margin-bottom: 4px; }
  .dev-headline { font-size: 12px; font-weight: 700; color: #081410; margin-bottom: 6px; }
  .dev-take { font-size: 11px; line-height: 1.6; color: #2d3a2b; }
  .dev-entities { margin-top: 6px; }
  .dev-entities span { display: inline-block; font-size: 9px; font-weight: 600; background: #081410; color: #fff; border-radius: 3px; padding: 2px 8px; margin-right: 4px; }
  .signoff { margin-top: 40px; padding-top: 24px; border-top: 3px solid #081410; display: flex; gap: 18px; align-items: flex-start; }
  .headshot { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #e6dcc3; }
  .headshot-placeholder { width: 80px; height: 80px; border-radius: 50%; background: #081410; color: #e8c95c; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex-shrink: 0; }
  .signoff-text { flex: 1; }
  .signoff-name { font-size: 14px; font-weight: 700; color: #081410; }
  .signoff-title { font-size: 11px; color: #5b6b7f; margin: 2px 0 8px; }
  .signoff-bio { font-size: 11px; color: #475a72; line-height: 1.5; }
  .ag-footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #eae2cc; display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #a1a8a0; }
  @media print { body { padding: 0; } .ag-header, .signoff, .ag-footer { break-inside: avoid; } h2 { break-after: avoid; } table { break-inside: avoid; } }
</style>
</head>
<body>

<header class="ag-header">
  <div class="logo">${AG_LOGO_SVG}</div>
  <div class="brand">
    <div class="brand-name">AnalystGenius</div>
    <div class="brand-sub">AI Enterprise — CIO Decision Intelligence Platform</div>
  </div>
  <div class="confidentiality">CIO / Strategy</div>
</header>

<div class="doc-title">Executive Brief — Enterprise AI Market Intelligence</div>
<div class="doc-meta">Generated ${timestamp()} &nbsp;·&nbsp; AnalystGenius Proprietary Methodology &nbsp;·&nbsp; ${brief.total} entities tracked</div>

<div class="score-row">
  <div class="score-card"><div class="label">Entities Tracked</div><div class="value">${brief.total}</div><div class="sub">role-classified universe</div></div>
  <div class="score-card"><div class="label">Avg Final Score</div><div class="value">${brief.avgLeadership}</div><div class="sub">out of 100</div></div>
  <div class="score-card"><div class="label">Avg Momentum</div><div class="value">${brief.avgMomentum}</div><div class="sub">out of 100</div></div>
  <div class="score-card"><div class="label">Avg Confidence</div><div class="value">${brief.avgConfidence}%</div><div class="sub">evidence quality</div></div>
</div>

<h2>Market Narrative</h2>
<div class="narrative">
  <p>AnalystGenius tracks <strong>${brief.total} entities</strong> across the enterprise AI landscape, classified by role — platform, model, application, infrastructure, hardware, investor, and sovereign layers. The average final score is <strong>${brief.avgLeadership}/100</strong> with market momentum at <strong>${brief.avgMomentum}/100</strong>.</p>
  <p style="margin-top:10px"><strong>Platform leadership</strong> is concentrated among ${brief.platformWinners.length > 0 ? brief.platformWinners.map(esc).join(", ") : "a narrow set of vendors"}, where distribution, identity, and governance create durable advantages. <strong>Model provision</strong> is led by ${brief.modelWinners.length > 0 ? brief.modelWinners.map(esc).join(", ") : "frontier providers"}, though open-weight alternatives continue to erode proprietary premiums.</p>
  <p style="margin-top:10px">The risk profile shows <strong>${brief.risk.high} high-risk</strong>, ${brief.risk.medium} medium-risk, and ${brief.risk.low} low-risk entities. High-risk flags typically reflect limited enterprise evidence, concentration exposure, or thin governance disclosure.</p>
  <p style="margin-top:10px">Evidence confidence averages <strong>${brief.avgConfidence}%</strong> — characteristic of a directional intelligence model. Scores are evidence-graded E0–E5; estimated data is clearly labelled throughout.</p>
</div>

${developments.length > 0 ? `
<h2>Analyst Commentary — Recent Market Developments</h2>
<p style="font-size:11px; color:#5b6b7f; margin-bottom:12px">Contextual analyst interpretation of events impacting the tracked entity universe. Each development is assessed for CIO relevance and linked to affected entities.</p>
${developments.map((d) => `
<div class="dev-card ${d.impact}">
  <div class="dev-meta">${esc(d.date)}${d.source ? ` &nbsp;·&nbsp; ${esc(d.source)}` : ""} &nbsp;·&nbsp; ${d.impact === "positive" ? "POSITIVE SIGNAL" : d.impact === "negative" ? "RISK SIGNAL" : d.impact === "watch" ? "WATCH" : "MARKET SHIFT"}</div>
  <div class="dev-headline">${esc(d.headline)}</div>
  <div class="dev-take">${esc(d.analystTake)}</div>
  <div class="dev-entities">${d.entities.map((n) => `<span>${esc(n)}</span>`).join("")}</div>
</div>`).join("")}
` : ""}

<h2>Leaders by Layer</h2>
<p style="font-size:11px; color:#5b6b7f; margin-bottom:8px">Vendors are ranked within their layer only. AnalystGenius does not publish a cross-layer composite ranking — platforms, models, hardware and capital measure different things.</p>
<table>
  <thead><tr><th>Layer</th><th>Leading Entities</th></tr></thead>
  <tbody>${layerLeaderRows}</tbody>
</table>

<h2>Market Movers</h2>
<h3>Rising by Final Score</h3>
<ul>${moversList}</ul>
<h3>Rising by Adoption</h3>
<ul>${adoptionList}</ul>

<h2>Risk Watch</h2>
<p>Entities flagged high-risk due to evidence gaps, concentration exposure, or governance concerns:</p>
<ul>${riskList}</ul>

<h2>Universe Composition</h2>
<table>
  <thead><tr><th>Role</th><th>Entity Count</th></tr></thead>
  <tbody>${roleBreakdown}</tbody>
</table>

<section class="signoff">
  ${headshot}
  <div class="signoff-text">
    <div class="signoff-name">Michael Cook</div>
    <div class="signoff-title">CEO — AnalystGenius</div>
    <div class="signoff-bio">${esc(CEO_BIO)}</div>
  </div>
</section>

<footer class="ag-footer">
  <div style="max-width:600px;line-height:1.4">
    Generated by AI Enterprise — AnalystGenius proprietary methodology. Evidence-graded and confidence-labelled.
    Estimated data is clearly marked. This document is not financial, legal, or procurement advice.
    &copy; ${new Date().getFullYear()} AnalystGenius. All rights reserved.
  </div>
</footer>

</body>
</html>`;
}

export default function ExecutiveBrief({ entities, winningByLayer, developments }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const brief = useMemo(() => generateBrief(entities, winningByLayer), [entities, winningByLayer]);
  const devs = useMemo(() => developments ?? seedDevelopments(entities), [developments, entities]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const headshotDataUri = await fetchHeadshotBase64();
      const html = renderExportHtml(brief, headshotDataUri, devs);
      const blob = new Blob([html], { type: "text/html; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AG-Executive-Brief-${new Date().toISOString().slice(0, 10)}.html`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      const fallbackTimer = setTimeout(() => { window.open(url, "_blank"); }, 500);
      const cancelFallback = () => { clearTimeout(fallbackTimer); window.removeEventListener("blur", cancelFallback); };
      window.addEventListener("blur", cancelFallback);
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        window.removeEventListener("blur", cancelFallback);
      }, 3000);
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  }, [brief]);

  return (
    <section className="mb-6">
      <div className="rounded-xl border border-[#e6dcc3] bg-white dark:border-[#223a2e] dark:bg-[#081410]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#a07f1f] dark:text-[#d4af37]">Executive Brief</div>
            <div className="mt-1 text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">
              {brief.total} entities tracked · Avg final score {brief.avgLeadership} · Confidence {brief.avgConfidence}% · {brief.risk.high} high-risk · {devs.length} developments
            </div>
          </div>
          <span className="ml-2 text-xs text-[#5b6b7f]">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="border-t border-[#efe9d9] px-5 py-4 dark:border-[#223a2e]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#e9e0c8] bg-[#fdfaf1] p-4 dark:border-[#223a2e] dark:bg-[#081c30]/40">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">Market Snapshot</div>
                <p className="mt-2 text-sm leading-6 text-[#2c3b52] dark:text-[#c2d1e0]">
                  AnalystGenius tracks <strong>{brief.total} entities</strong> across the enterprise AI landscape.
                  Average final score is <strong>{brief.avgLeadership}/100</strong> with momentum
                  at <strong>{brief.avgMomentum}</strong>.
                  Platform leadership is concentrated among {brief.platformWinners.join(", ") || "a narrow set"}.
                  Model provision is led by {brief.modelWinners.join(", ") || "frontier providers"}.
                </p>
              </div>
              <div className="rounded-lg border border-[#e9e0c8] bg-[#fdfaf1] p-4 dark:border-[#223a2e] dark:bg-[#081c30]/40">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">Risk & Confidence</div>
                <p className="mt-2 text-sm leading-6 text-[#2c3b52] dark:text-[#c2d1e0]">
                  <strong>{brief.risk.high}</strong> high-risk, <strong>{brief.risk.medium}</strong> medium,
                  and <strong>{brief.risk.low}</strong> low-risk entities.
                  Average evidence confidence is <strong>{brief.avgConfidence}%</strong> — directional, evidence-labelled intelligence.
                  High-risk flags reflect limited enterprise evidence, concentration exposure, or governance gaps.
                </p>
              </div>
            </div>

            {devs.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">Analyst Commentary — Recent Developments</div>
                <div className="mt-2 space-y-3">
                  {devs.slice(0, 5).map((d, i) => {
                    const style = IMPACT_COLORS[d.impact];
                    return (
                      <div key={i} className={`rounded-lg border border-[#e9e0c8] p-4 dark:border-[#223a2e] ${style.bg}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${style.text}`}>{style.label}</span>
                              <span className="text-[9px] text-[#5b6b7f]">{d.date}</span>
                              {d.source && <span className="text-[9px] text-[#a1a8a0]">· {d.source}</span>}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-[#123d2c] dark:text-[#eef3f8]">{d.headline}</div>
                            <p className="mt-2 text-xs leading-5 text-[#475a72] dark:text-[#a7bacd]">{d.analystTake}</p>
                            <div className="mt-2 flex gap-1.5">
                              {d.entities.map((name) => (
                                <span key={name} className="rounded-full bg-[#081410]/10 px-2 py-0.5 text-[9px] font-semibold text-[#081410] dark:bg-[#1c3d5c] dark:text-[#d8e2ec]">{name}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {devs.length > 5 && (
                  <div className="mt-2 text-xs text-[#5b6b7f]">+ {devs.length - 5} more developments in export</div>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">Leaders by Layer</div>
                <div className="mt-2 space-y-1.5">
                  {brief.leadersByLayer.map((l) => (
                    <div key={l.title} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="shrink-0 text-[#5b6b7f] dark:text-[#8fa5bb]">{l.title}</span>
                      <span className="text-right font-medium text-[#123d2c] dark:text-[#eef3f8]">{l.names.join(", ") || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">Rising — Final Score</div>
                <div className="mt-2 space-y-1.5">
                  {brief.fastestMovers.length > 0 ? brief.fastestMovers.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#123d2c] dark:text-[#eef3f8]">{e.name}</span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">+{e.deltas.leadership}</span>
                    </div>
                  )) : <span className="text-xs text-[#5b6b7f]">No material movement.</span>}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5b6b7f]">High Risk Watch</div>
                <div className="mt-2 space-y-1.5">
                  {brief.highRiskEntities.length > 0 ? brief.highRiskEntities.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#123d2c] dark:text-[#eef3f8]">{e.name}</span>
                      <span className="font-mono text-rose-700 dark:text-rose-300">{e.confidence}%</span>
                    </div>
                  )) : <span className="text-xs text-[#5b6b7f]">No high-risk entities.</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="rounded-full border border-[#d6c9a8] bg-white px-4 py-2 text-xs font-semibold text-[#123d2c] hover:bg-[#f3ead2] disabled:opacity-50 dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8] dark:hover:bg-[#143049]"
              >
                {exporting ? "Exporting…" : "Export Executive Brief"}
              </button>
              <span className="text-xs text-[#5b6b7f]">AG-branded HTML · print to PDF</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
