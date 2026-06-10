"use client";

import { useCallback, useState } from "react";
import type {
  BoardAssumption,
  BusinessCase,
  CompetitorProfile,
  EnterpriseRisk,
  KPI,
} from "@/lib/decision-intelligence/types";

interface VendorSummary {
  name: string;
  role: string;
  score: number;
  confidence: number;
  topPillars: string[];
  risks: string[];
}

interface MitigationControl {
  control: string;
  description: string;
  status: string;
}

/** Assessment context the shortlist was generated under (from Assess → URL params). */
export interface DecisionScope {
  industries: string[];
  useCases: string[];
  region: string;
  dataSensitivity: string;
  costSensitivity: string;
}

/** Three-pillar reputation snapshot for a shortlisted vendor. */
export interface ReputationRow {
  vendor: string;
  customer: number | null;
  developer: number | null;
  employee: number | null;
  uptimePct: number | null;
}

/** Modelled peer-adoption share for a shortlisted vendor within the decision scope. */
export interface UptakeRow {
  vendor: string;
  sharePct: number;
  confidence: string;
}

/** Vendor-published token list price for a shortlisted vendor's model. */
export interface PricingRow {
  vendorName: string;
  modelName: string;
  inputPerM: number | null;
  outputPerM: number | null;
}

export interface BoardPackExporterProps {
  boardDefenceScore: number;
  cioConfidenceScore: number;
  recommendation: string;
  businessCase: BusinessCase;
  vendors: VendorSummary[];
  competitors: CompetitorProfile[];
  risks: EnterpriseRisk[];
  mitigations: MitigationControl[];
  assumptions: BoardAssumption[];
  kpis: KPI[];
  /** Assessment context — packs must state the scope they defend. */
  scope: DecisionScope;
  /** Reputation snapshot, shortlist-aligned. Empty when no shortlist. */
  reputation: ReputationRow[];
  /** Modelled peer adoption within scope, shortlist-aligned. */
  uptake: UptakeRow[];
  /** Human-readable description of the uptake slice (e.g. "Financial services · Europe & UK"). */
  uptakeScopeLabel: string;
  /** Vendor-published token list prices for the shortlist. */
  pricing: PricingRow[];
  /** Market snapshot used by the no-shortlist Executive Summary. */
  marketOverview?: MarketOverview;
}

/** Compact market snapshot for the shortlist-free Executive Summary. */
export interface MarketOverview {
  totalVendors: number;
  totalCategories: number;
  topVendors: { name: string; category: string; score: number; confidence: number; ownershipType?: string }[];
  /** Top vendors grouped per category — leadership is category-specific by design. */
  categoryLeaders: { category: string; vendors: { name: string; score: number }[] }[];
  /** Vendors with the strongest momentum signals. */
  momentumLeaders: { name: string; momentumScore: number }[];
}

/** The five takeaways a business leader should leave with — each derived
 *  from the data passed in, never invented. Shared by HTML and PPTX. */
export function deriveMarketTakeaways(m: MarketOverview | undefined, reputation: ReputationRow[]): { title: string; body: string }[] {
  if (!m) return [];
  const takeaways: { title: string; body: string }[] = [];

  const namedLeaders = m.categoryLeaders.slice(0, 3)
    .filter((c) => c.vendors.length > 0)
    .map((c) => `${c.vendors[0].name} (${c.category})`).join(", ");
  takeaways.push({
    title: "Leadership is category-specific — there is no single \u201cbest AI vendor\u201d",
    body: `${m.totalVendors} vendors tracked across ${m.totalCategories} categories. Current category leaders: ${namedLeaders || "—"}. AnalystGenius scores within categories by design; cross-category composite ranks are not used.`,
  });

  const contested = m.categoryLeaders
    .filter((c) => c.vendors.length >= 2)
    .map((c) => ({ c, gap: c.vendors[0].score - c.vendors[1].score }))
    .sort((a, b) => a.gap - b.gap)[0];
  if (contested) {
    takeaways.push({
      title: `Tightest race: ${contested.c.category}`,
      body: `${contested.c.vendors[0].name} leads ${contested.c.vendors[1].name} by ${contested.gap} point${contested.gap === 1 ? "" : "s"} — close enough that procurement leverage and momentum, not capability, should drive selection here.`,
    });
  }

  if (m.momentumLeaders.length > 0) {
    const ml = m.momentumLeaders.slice(0, 3).map((v) => `${v.name} (${v.momentumScore.toFixed(0)})`).join(", ");
    takeaways.push({
      title: "Momentum favours the challengers",
      body: `Strongest momentum signals: ${ml}. Momentum (deals, releases, hiring, funding) is a leading indicator — today's scores understate vendors on this list.`,
    });
  }

  const withUptime = reputation.filter((r) => r.uptimePct !== null).sort((a, b) => (b.uptimePct ?? 0) - (a.uptimePct ?? 0));
  const devLeader = [...reputation].sort((a, b) => (b.developer ?? 0) - (a.developer ?? 0))[0];
  if (withUptime.length > 0 || devLeader) {
    const parts: string[] = [];
    if (withUptime[0]) parts.push(`${withUptime[0].vendor} publishes the strongest 12-month uptime (${withUptime[0].uptimePct}%)`);
    if (devLeader) parts.push(`${devLeader.vendor} leads developer trust (${devLeader.developer}/100)`);
    takeaways.push({
      title: "Reliability and developer trust diverge from headline scores",
      body: `${parts.join("; ")}. Use published uptime to anchor SLA negotiation; developer sentiment predicts integration friction.`,
    });
  }

  takeaways.push({
    title: "Evidence quality varies — read the confidence column, not just the score",
    body: "Every AnalystGenius score carries a confidence rating reflecting evidence strength. A high score on thin evidence deserves a pilot, not a commitment. Estimated and modelled data is explicitly labelled throughout.",
  });

  return takeaways.slice(0, 5);
}

export type ExportType = "Executive Summary" | "Board Pack" | "Procurement Pack" | "Risk Review";

export const CEO_BIO =
  "Michael Cook is CEO of AnalystGenius. With over a decade of experience spanning " +
  "analyst research, advisory, and go-to-market strategy across the IT and BPO services " +
  "landscape, Michael has held senior positions at NelsonHall, HfS Research, Cognizant's " +
  "Center for the Future of Work, IDC, and Capgemini. He has advised the world's leading " +
  "service providers on vendor positioning, enterprise AI adoption, and workforce " +
  "transformation — and brings deep cross-market expertise to every AnalystGenius engagement.";

const AG_LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="12" fill="#071827"/>
  <circle cx="32" cy="32" r="7" fill="#6EE7B7"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#6EE7B7" stroke-width="3"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#F5C451" stroke-width="3" transform="rotate(60 32 32)"/>
  <ellipse cx="32" cy="32" rx="22" ry="9" stroke="#F6F0E7" stroke-width="3" transform="rotate(120 32 32)"/>
  <circle cx="50" cy="25" r="3.5" fill="#F5C451"/>
</svg>`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function timestamp() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

/** "vendor_resilience" → "Vendor resilience" — board documents don't speak snake_case. */
function humanisePillar(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
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

export const CONFIDENTIALITY: Record<ExportType, string> = {
  "Executive Summary": "Board / C-Suite Only",
  "Board Pack": "Board / C-Suite Only",
  "Procurement Pack": "Procurement / Vendor Management",
  "Risk Review": "Risk Committee / CISO",
};

export const SUBTITLES: Record<ExportType, string> = {
  "Executive Summary": "AI Investment — Executive Summary",
  "Board Pack": "AI Investment — Board Defence Pack",
  "Procurement Pack": "AI Vendor Selection — Procurement Pack",
  "Risk Review": "AI Investment — Risk Review",
};

function htmlShell(title: string, type: ExportType, body: string, headshotDataUri: string, shortlistLabel: string): string {
  const confidentiality = CONFIDENTIALITY[type];
  const headshot = headshotDataUri
    ? `<img src="${headshotDataUri}" alt="Michael Cook" class="headshot" />`
    : `<div class="headshot-placeholder">MC</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)} — AnalystGenius</title>
<style>
  :root { color-scheme: light; }
  @page { margin: 20mm 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font: 13px/1.6 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #18201b; max-width: 860px; margin: 0 auto; padding: 32px 28px;
  }

  /* ── Header ── */
  .ag-header {
    display: flex; align-items: center; gap: 14px;
    border-bottom: 3px solid #071827; padding-bottom: 14px; margin-bottom: 6px;
  }
  .ag-header .logo { flex-shrink: 0; }
  .ag-header .brand { flex: 1; }
  .ag-header .brand-name { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #071827; }
  .ag-header .brand-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #697362; margin-top: 1px; }
  .ag-header .confidentiality {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
    color: #fff; background: #071827; padding: 4px 12px; border-radius: 4px; font-weight: 600;
  }

  .doc-title { font-size: 22px; font-weight: 700; color: #071827; margin: 18px 0 2px; letter-spacing: -0.01em; }
  .doc-meta { font-size: 11px; color: #697362; margin-bottom: 24px; }

  /* ── Content ── */
  h2 { font-size: 15px; font-weight: 700; color: #071827; margin: 28px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #e4e8df; letter-spacing: -0.01em; }
  h3 { font-size: 13px; font-weight: 700; color: #2d3a2b; margin: 16px 0 6px; }
  p { margin: 6px 0; }
  ul { padding-left: 20px; margin: 6px 0; }
  li { margin: 3px 0; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 10px 0 16px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #697362; padding: 6px 8px; border-bottom: 2px solid #071827; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #edf0ea; vertical-align: top; }
  tr:last-child td { border-bottom: none; }

  .score-row { display: flex; gap: 16px; margin: 12px 0 20px; }
  .score-card {
    flex: 1; border: 1px solid #dfe4da; border-radius: 10px; padding: 14px 16px; text-align: center;
  }
  .score-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #697362; font-weight: 600; }
  .score-card .value { font-size: 32px; font-weight: 700; color: #071827; margin: 4px 0 2px; font-variant-numeric: tabular-nums; }
  .score-card .sub { font-size: 10px; color: #697362; }
  .score-card.green { border-color: #6EE7B7; background: #f0fdf8; }
  .score-card.green .value { color: #065f46; }
  .score-card.blue { border-color: #93c5fd; background: #eff6ff; }
  .score-card.blue .value { color: #1e40af; }

  .severity-critical { color: #dc2626; font-weight: 700; }
  .severity-high { color: #e11d48; font-weight: 600; }
  .severity-medium { color: #d97706; font-weight: 600; }
  .severity-low { color: #059669; }

  .status-stable { color: #059669; font-weight: 600; }
  .status-watch { color: #d97706; font-weight: 600; }
  .status-atrisk { color: #dc2626; font-weight: 600; }

  .assumption-card { border: 1px solid #edf0ea; border-radius: 8px; padding: 12px 14px; margin: 8px 0; }
  .assumption-card .title-row { display: flex; justify-content: space-between; align-items: center; }
  .assumption-card .title { font-weight: 700; font-size: 13px; }
  .assumption-card .detail { font-size: 12px; color: #4d574b; margin-top: 4px; }

  /* ── Sign-off ── */
  .signoff {
    margin-top: 40px; padding-top: 24px; border-top: 3px solid #071827;
    display: flex; gap: 18px; align-items: flex-start;
  }
  .headshot { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #dfe4da; }
  .headshot-placeholder {
    width: 80px; height: 80px; border-radius: 50%; background: #071827; color: #6EE7B7;
    display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex-shrink: 0;
  }
  .signoff-text { flex: 1; }
  .signoff-name { font-size: 14px; font-weight: 700; color: #071827; }
  .signoff-title { font-size: 11px; color: #697362; margin: 2px 0 8px; }
  .signoff-bio { font-size: 11px; color: #4d574b; line-height: 1.5; }

  /* ── Footer ── */
  .ag-footer {
    margin-top: 32px; padding-top: 14px; border-top: 1px solid #e4e8df;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 9px; color: #a1a8a0;
  }
  .ag-footer .disclaimer { max-width: 600px; line-height: 1.4; }

  @media print {
    body { padding: 0; }
    .ag-header, .signoff, .ag-footer { break-inside: avoid; }
    .closing { break-inside: avoid; }
    h2 { break-after: avoid; }
    table { break-inside: avoid; }
  }
</style>
</head>
<body>

<header class="ag-header">
  <div class="logo">${AG_LOGO_SVG}</div>
  <div class="brand">
    <div class="brand-name">AnalystGenius</div>
    <div class="brand-sub">AI Enterprise — CIO Decision Intelligence Platform</div>
  </div>
  <div class="confidentiality">${esc(confidentiality)}</div>
</header>

<div class="doc-title">${esc(title)}</div>
<div class="doc-meta">Generated ${timestamp()} &nbsp;·&nbsp; ${shortlistLabel ? `Shortlist: ${esc(shortlistLabel)} &nbsp;·&nbsp; ` : ""}AnalystGenius Proprietary Methodology</div>

${body}

<div class="closing">
<section class="signoff">
  ${headshot}
  <div class="signoff-text">
    <div class="signoff-name">Michael Cook</div>
    <div class="signoff-title">CEO — AnalystGenius</div>
    <div class="signoff-bio">${esc(CEO_BIO)}</div>
  </div>
</section>

<footer class="ag-footer">
  <div class="disclaimer">
    Generated by AI Enterprise — AnalystGenius proprietary methodology. Evidence-graded and confidence-labelled.
    Estimated data is clearly marked. This document is not financial, legal, or procurement advice.
    &copy; ${new Date().getFullYear()} AnalystGenius. All rights reserved.
  </div>
  <div>${AG_LOGO_SVG.replace('width="40" height="40"', 'width="24" height="24"')}</div>
</footer>
</div>

</body>
</html>`;
}

function severityClass(s: string): string {
  if (s === "Critical") return "severity-critical";
  if (s === "High") return "severity-high";
  if (s === "Medium") return "severity-medium";
  return "severity-low";
}

// ── Shared, shortlist-aligned sections ───────────────────────────────

/** Every pack opens by stating exactly what decision it defends. */
function sectionScope(p: BoardPackExporterProps): string {
  const s = p.scope;
  const row = (label: string, value: string) =>
    value ? `<tr><td style="width:180px;color:#697362;font-size:11px;text-transform:uppercase;letter-spacing:0.04em">${esc(label)}</td><td><strong>${esc(value)}</strong></td></tr>` : "";
  return `
<h2>Decision Scope</h2>
<p style="font-size:11px;color:#697362">This document defends the shortlist produced by the AnalystGenius assessment under the context below. If the context changes, re-run the assessment.</p>
<table>
  <tbody>
    ${row("Shortlisted vendors", p.vendors.map((v) => v.name).join(", "))}
    ${row("Industries", s.industries.join(", "))}
    ${row("Use cases", s.useCases.join(", "))}
    ${row("Region", s.region)}
    ${row("Data sensitivity", s.dataSensitivity)}
    ${row("Cost sensitivity", s.costSensitivity)}
  </tbody>
</table>`;
}

function sectionReputation(p: BoardPackExporterProps): string {
  if (p.reputation.length === 0) return "";
  const fmt = (n: number | null) => (n === null ? "—" : String(n));
  const rows = p.reputation.map((r) =>
    `<tr><td><strong>${esc(r.vendor)}</strong></td><td>${fmt(r.customer)}</td><td>${fmt(r.developer)}</td><td>${fmt(r.employee)}</td><td>${r.uptimePct === null ? "—" : `${r.uptimePct}%`}</td></tr>`,
  ).join("");
  return `
<h2>Reputation Snapshot — Shortlist</h2>
<p style="font-size:11px;color:#697362">Three-pillar reputation (0–100): customer (review platforms), developer (GitHub / forums / API reliability), employee (workplace signals). 12-month service uptime where published.</p>
<table>
  <thead><tr><th>Vendor</th><th>Customer</th><th>Developer</th><th>Employee</th><th>Uptime (12mo)</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function sectionUptake(p: BoardPackExporterProps): string {
  if (p.uptake.length === 0) return "";
  const rows = p.uptake.map((u) =>
    `<tr><td><strong>${esc(u.vendor)}</strong></td><td style="font-variant-numeric:tabular-nums">${u.sharePct.toFixed(1)}%</td><td>${esc(u.confidence)}</td></tr>`,
  ).join("");
  return `
<h2>Market Penetration — Peer Adoption (Modelled)</h2>
<p style="font-size:11px;color:#697362">Share of named-vendor usage within <strong>${esc(p.uptakeScopeLabel)}</strong>, from the AnalystGenius May 2026 segment-share model (585 cells). <strong>Modelled estimates, not audited market share</strong> — treat as directional peer-adoption context.</p>
<table>
  <thead><tr><th>Vendor</th><th>Share of named usage</th><th>Confidence</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function sectionPricing(p: BoardPackExporterProps): string {
  if (p.pricing.length === 0) return "";
  const fmt = (n: number | null) => (n === null ? "Unverified" : `$${n.toFixed(2)}`);
  const rows = p.pricing.map((r) =>
    `<tr><td><strong>${esc(r.vendorName)}</strong></td><td>${esc(r.modelName)}</td><td style="font-variant-numeric:tabular-nums">${fmt(r.inputPerM)}</td><td style="font-variant-numeric:tabular-nums">${fmt(r.outputPerM)}</td></tr>`,
  ).join("");
  return `
<h2>Token Pricing — Vendor-Published List Prices</h2>
<p style="font-size:11px;color:#697362">USD per 1M tokens, vendor-published list prices at generation date. Negotiated and committed-use pricing will differ — validate during procurement.</p>
<table>
  <thead><tr><th>Vendor</th><th>Model</th><th>Input / 1M</th><th>Output / 1M</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

/** Honest data-basis block — the footer promises "estimated data is clearly marked"; this is where it's marked. */
function sectionProvenance(p: BoardPackExporterProps): string {
  return `
<h2>Data Basis &amp; Provenance</h2>
<table>
  <thead><tr><th>Section</th><th>Basis</th></tr></thead>
  <tbody>
    <tr><td>Vendor shortlist, scores, confidence, pillars</td><td>Platform-derived from your AnalystGenius assessment run</td></tr>
    ${p.reputation.length > 0 ? `<tr><td>Reputation snapshot</td><td>Curated from public review, developer and workplace sources; seed-confidence pending live refresh</td></tr>` : ""}
    ${p.uptake.length > 0 ? `<tr><td>Market penetration</td><td><strong>Modelled estimate</strong> (May 2026 segment-share model) — directional, not audited market share</td></tr>` : ""}
    ${p.pricing.length > 0 ? `<tr><td>Token pricing</td><td>Vendor-published list prices; "Unverified" where no clean published line exists</td></tr>` : ""}
    <tr><td>Business case, competitor profiles, risk register, KPIs, assumptions</td><td><strong>Illustrative templates</strong> — tailor to your organisation before board submission</td></tr>
  </tbody>
</table>`;
}

function statusClass(s: string): string {
  if (s === "At Risk" || s === "Broken") return "status-atrisk";
  if (s === "Watch") return "status-watch";
  return "status-stable";
}

/** Shortlist-free Executive Summary: a concise AI-market overview. */
/** Shortlist-free Executive Summary: a concise AI-market overview. */
function bodyMarketOverview(p: BoardPackExporterProps): string {
  const m = p.marketOverview;
  const takeaways = deriveMarketTakeaways(m, p.reputation);
  const takeawayItems = takeaways.map((t, i) =>
    `<div style="margin:10px 0;padding:10px 12px;border:1px solid #e4e8df;border-radius:8px;page-break-inside:avoid"><strong>${i + 1}. ${esc(t.title)}</strong><br/><span style="font-size:11px;color:#3c463b">${esc(t.body)}</span></div>`,
  ).join("");
  const categoryRows = (m?.categoryLeaders ?? []).map((c) =>
    `<tr><td><strong>${esc(c.category)}</strong></td><td>${c.vendors.map((v, i) => `${i + 1}. ${esc(v.name)} <span style="color:#697362;font-variant-numeric:tabular-nums">(${v.score})</span>`).join(" &nbsp;·&nbsp; ")}</td></tr>`,
  ).join("");
  return `
<div class="score-row">
  <div class="score-card blue"><div class="label">Vendors tracked</div><div class="value">${m?.totalVendors ?? "—"}</div></div>
  <div class="score-card green"><div class="label">Market categories</div><div class="value">${m?.totalCategories ?? "—"}</div></div>
  <div class="score-card"><div class="label">Scoring model</div><div class="value" style="font-size:15px;margin-top:14px">Per-category, confidence-rated</div></div>
</div>

<p style="font-size:11px;color:#697362">No assessment shortlist yet — this summary covers the tracked market. Run an assessment in Assess to generate a shortlist-specific defence pack. Vendors are scored within their categories; composite cross-category rankings are not used.</p>

<h2>Top 5 Takeaways</h2>
${takeawayItems}

<h2>Category Leaders — Top 3 Within Each Category</h2>
<table>
  <thead><tr><th>Category</th><th>Leaders (score)</th></tr></thead>
  <tbody>${categoryRows}</tbody>
</table>

${sectionReputation(p)}

<h2>Data Basis &amp; Provenance</h2>
<table>
  <thead><tr><th>Section</th><th>Basis</th></tr></thead>
  <tbody>
    <tr><td>Vendor scores, confidence, categories, momentum</td><td>AnalystGenius platform scoring — seed-confidence where live evidence is pending</td></tr>
    <tr><td>Takeaways</td><td>Derived deterministically from the tracked dataset above — no editorial additions</td></tr>
    <tr><td>Reputation snapshot</td><td>Curated from public review, developer and workplace sources</td></tr>
  </tbody>
</table>`;
}

function bodyExecutiveSummary(p: BoardPackExporterProps): string {
  if (p.vendors.length === 0) return bodyMarketOverview(p);
  const vendorRows = p.vendors.map((v) =>
    `<tr><td><strong>${esc(v.name)}</strong></td><td>${esc(v.role)}</td><td>${v.score}</td><td>${v.confidence}</td></tr>`
  ).join("");

  const riskRows = p.risks
    .filter((r) => r.severity === "Critical" || r.severity === "High")
    .map((r) => `<li><strong>${esc(r.risk)}</strong> <span class="${severityClass(r.severity)}">(${esc(r.severity)})</span> — ${esc(r.mitigation)}</li>`)
    .join("");

  return `
<div class="score-row">
  <div class="score-card blue"><div class="label">Board Defence</div><div class="value">${p.boardDefenceScore}</div><div class="sub">out of 100</div></div>
  <div class="score-card green"><div class="label">CIO Confidence</div><div class="value">${p.cioConfidenceScore}</div><div class="sub">out of 100</div></div>
  <div class="score-card"><div class="label">Recommendation</div><div class="value" style="font-size:18px;margin-top:12px">${esc(p.recommendation)}</div></div>
</div>

${sectionScope(p)}

<h2>Business Case</h2>
<p style="font-size:11px;color:#697362"><em>Illustrative template — quantify with your organisation’s figures before board submission.</em></p>
<p>${esc(p.businessCase.businessProblem)}</p>
<h3>Intended Outcomes</h3>
<ul>${p.businessCase.intendedOutcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
<table>
  <thead><tr><th>Impact Area</th><th>Estimate</th></tr></thead>
  <tbody>
    <tr><td>Productivity</td><td>${esc(p.businessCase.productivityImpact)}</td></tr>
    <tr><td>Cost Reduction</td><td>${esc(p.businessCase.costReductionPotential)}</td></tr>
    <tr><td>Revenue</td><td>${esc(p.businessCase.revenuePotential)}</td></tr>
    <tr><td>CX / EX</td><td>${esc(p.businessCase.cxExImpact)}</td></tr>
  </tbody>
</table>

<h2>Vendor Shortlist</h2>
${p.vendors.length > 0
    ? `<table><thead><tr><th>Vendor</th><th>Role</th><th>Score</th><th>Confidence</th></tr></thead><tbody>${vendorRows}</tbody></table>`
    : `<p><em>No vendors selected. Run an assessment to populate.</em></p>`}

<h2>Key Risks</h2>
${riskRows ? `<ul>${riskRows}</ul>` : `<p>No critical or high risks identified.</p>`}

${sectionReputation(p)}
${sectionProvenance(p)}`;
}

function bodyBoardPack(p: BoardPackExporterProps): string {
  const vendorBlocks = p.vendors.map((v) => `
    <h3>${esc(v.name)}</h3>
    <p><strong>Role:</strong> ${esc(v.role)} &nbsp;·&nbsp; <strong>Score:</strong> ${v.score} &nbsp;·&nbsp; <strong>Confidence:</strong> ${v.confidence}</p>
    <p><strong>Top pillars:</strong> ${esc(v.topPillars.map(humanisePillar).join(", ") || "—")}</p>
    ${v.risks.length > 0 ? `<p><strong>Risks:</strong> ${esc(v.risks.join(", "))}</p>` : ""}
  `).join("");

  const competitorBlocks = p.competitors.map((c) => `
    <h3>${esc(c.peer)} <span style="font-weight:normal;font-size:11px;color:#697362">(${esc(c.maturity)})</span></h3>
    <p><strong>Use cases:</strong> ${esc(c.useCases.join(", "))}</p>
    <p><strong>Known vendors:</strong> ${esc(c.knownVendors.join(", "))}</p>
    <p><strong>CIO implication:</strong> ${esc(c.implication)}</p>
  `).join("");

  const riskRows = p.risks.map((r) =>
    `<tr><td>${esc(r.risk)}</td><td>${esc(r.category)}</td><td class="${severityClass(r.severity)}">${esc(r.severity)}</td><td class="${severityClass(r.likelihood)}">${esc(r.likelihood)}</td><td>${esc(r.mitigation)}</td><td>${esc(r.owner)}</td></tr>`
  ).join("");

  const controlRows = p.mitigations.map((m) =>
    `<li><strong>${esc(m.control)}</strong> <span style="color:#697362">(${esc(m.status)})</span> — ${esc(m.description)}</li>`
  ).join("");

  const assumptionBlocks = p.assumptions.map((a) => `
    <div class="assumption-card">
      <div class="title-row"><span class="title">${esc(a.title)}</span><span class="${statusClass(a.status)}">${esc(a.status)}</span></div>
      <div class="detail"><strong>Confidence:</strong> ${a.confidence}% &nbsp;·&nbsp; <strong>Evidence:</strong> ${esc(a.evidenceGrade)}</div>
      <div class="detail"><strong>Failure trigger:</strong> ${esc(a.failureTrigger)}</div>
      <div class="detail"><strong>Current signal:</strong> ${esc(a.currentSignal)}</div>
      <div class="detail"><strong>Action:</strong> ${esc(a.recommendedAction)}</div>
    </div>
  `).join("");

  const kpiRows = p.kpis.map((k) =>
    `<tr><td>${esc(k.metric)}</td><td>${esc(k.baseline)}</td><td style="color:#059669;font-weight:600">${esc(k.target)}</td><td>${esc(k.owner)}</td><td>${esc(k.cadence)}</td></tr>`
  ).join("");

  return `
<div class="score-row">
  <div class="score-card blue"><div class="label">Board Defence</div><div class="value">${p.boardDefenceScore}</div><div class="sub">out of 100</div></div>
  <div class="score-card green"><div class="label">CIO Confidence</div><div class="value">${p.cioConfidenceScore}</div><div class="sub">out of 100</div></div>
  <div class="score-card"><div class="label">Recommendation</div><div class="value" style="font-size:18px;margin-top:12px">${esc(p.recommendation)}</div></div>
</div>

${sectionScope(p)}

<h2>1. Why Invest?</h2>
<p style="font-size:11px;color:#697362"><em>Illustrative template — quantify with your organisation’s figures before board submission.</em></p>
<p>${esc(p.businessCase.businessProblem)}</p>
<h3>Intended Outcomes</h3>
<ul>${p.businessCase.intendedOutcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
<table>
  <thead><tr><th>Impact Area</th><th>Estimate</th></tr></thead>
  <tbody>
    <tr><td>Productivity</td><td>${esc(p.businessCase.productivityImpact)}</td></tr>
    <tr><td>Cost Reduction</td><td>${esc(p.businessCase.costReductionPotential)}</td></tr>
    <tr><td>Revenue</td><td>${esc(p.businessCase.revenuePotential)}</td></tr>
    <tr><td>CX / EX</td><td>${esc(p.businessCase.cxExImpact)}</td></tr>
  </tbody>
</table>

<h2>2. Why Now?</h2>
<p style="font-size:11px;color:#697362"><em>Illustrative framing — replace with your organisation's specific drivers before board submission.</em></p>
<ul>
  <li>Enterprise AI platforms are maturing rapidly — delaying adoption raises future switching and integration cost</li>
  <li>Peer organisations in scope industries are formalising AI vendor stacks (see Market Penetration section)</li>
  <li>AI-skilled talent is scarce — early movers secure implementation capability ahead of competitors</li>
</ul>

<h2>3. Recommended Vendor Shortlist</h2>
${p.vendors.length > 0 ? vendorBlocks : `<p><em>No vendors selected. Run an assessment to populate.</em></p>`}

<h2>4. Competitive Position</h2>
${competitorBlocks}

${sectionUptake(p).replace("<h2>Market Penetration", "<h2>5. Market Penetration")}
${sectionReputation(p).replace("<h2>Reputation Snapshot", "<h2>6. Reputation Snapshot")}
${sectionPricing(p).replace("<h2>Token Pricing", "<h2>7. Indicative Cost — Token Pricing")}

<h2>8. Risk Register</h2>
<table>
  <thead><tr><th>Risk</th><th>Category</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th><th>Owner</th></tr></thead>
  <tbody>${riskRows}</tbody>
</table>

<h2>9. Controls &amp; Governance</h2>
<ul>${controlRows}</ul>

<h2>10. Assumptions</h2>
${assumptionBlocks}

<h2>11. Value Realisation KPIs</h2>
<table>
  <thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Owner</th><th>Cadence</th></tr></thead>
  <tbody>${kpiRows}</tbody>
</table>

${sectionProvenance(p)}`;
}

function bodyProcurementPack(p: BoardPackExporterProps): string {
  const vendorRows = p.vendors.map((v) =>
    `<tr><td><strong>${esc(v.name)}</strong></td><td>${esc(v.role)}</td><td>${v.score}</td><td>${v.confidence}</td><td>${esc(v.topPillars.map(humanisePillar).join(", ") || "—")}</td><td>${esc(v.risks.join(", ") || "—")}</td></tr>`
  ).join("");

  const vendorRisks = p.risks.filter((r) => r.category === "Vendor Risk" || r.category === "Concentration" || r.category === "Cost");
  const vendorRiskRows = vendorRisks.map((r) =>
    `<tr><td>${esc(r.risk)}</td><td class="${severityClass(r.severity)}">${esc(r.severity)}</td><td class="${severityClass(r.likelihood)}">${esc(r.likelihood)}</td><td>${esc(r.mitigation)}</td><td>${esc(r.owner)}</td></tr>`
  ).join("");

  const competitorRows = p.competitors.map((c) =>
    `<li><strong>${esc(c.peer)}</strong> (${esc(c.maturity)}): ${esc(c.useCases.join(", "))} — vendors: ${esc(c.knownVendors.join(", "))}</li>`
  ).join("");

  const controlRows = p.mitigations.map((m) =>
    `<li><strong>${esc(m.control)}</strong> <span style="color:#697362">(${esc(m.status)})</span> — ${esc(m.description)}</li>`
  ).join("");

  const kpiRows = p.kpis.map((k) =>
    `<tr><td>${esc(k.metric)}</td><td>${esc(k.baseline)}</td><td style="color:#059669;font-weight:600">${esc(k.target)}</td><td>${esc(k.owner)}</td></tr>`
  ).join("");

  return `
${sectionScope(p)}

<h2>Vendor Shortlist</h2>
${p.vendors.length > 0
    ? `<table><thead><tr><th>Vendor</th><th>Role</th><th>Score</th><th>Confidence</th><th>Top Pillars</th><th>Risks</th></tr></thead><tbody>${vendorRows}</tbody></table>`
    : `<p><em>No vendors selected. Run an assessment to populate.</em></p>`}

${sectionPricing(p)}

${sectionReputation(p).replace(
    "Three-pillar reputation (0–100): customer (review platforms), developer (GitHub / forums / API reliability), employee (workplace signals). 12-month service uptime where published.",
    "Three-pillar reputation (0–100) and 12-month published uptime — use uptime history to anchor SLA and service-credit negotiation.",
  )}

<h2>Vendor Risk Considerations</h2>
${vendorRiskRows
    ? `<table><thead><tr><th>Risk</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th><th>Owner</th></tr></thead><tbody>${vendorRiskRows}</tbody></table>`
    : `<p>No vendor-specific risks identified.</p>`}

${sectionUptake(p)}

<h2>Competitive Landscape</h2>
<ul>${competitorRows}</ul>

<h2>Contract Controls</h2>
<ul>${controlRows}</ul>

<h2>Value Realisation Targets</h2>
<table>
  <thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Owner</th></tr></thead>
  <tbody>${kpiRows}</tbody>
</table>

${sectionProvenance(p)}`;
}

function bodyRiskReview(p: BoardPackExporterProps): string {
  const critical = p.risks.filter((r) => r.severity === "Critical").length;
  const high = p.risks.filter((r) => r.severity === "High").length;
  const medium = p.risks.filter((r) => r.severity === "Medium").length;

  const riskRows = p.risks.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.risk)}</td><td>${esc(r.category)}</td><td class="${severityClass(r.severity)}">${esc(r.severity)}</td><td class="${severityClass(r.likelihood)}">${esc(r.likelihood)}</td><td>${esc(r.mitigation)}</td><td>${esc(r.owner)}</td><td>${esc(r.status)}</td></tr>`
  ).join("");

  const controlRows = p.mitigations.map((m) =>
    `<tr><td>${esc(m.control)}</td><td>${esc(m.description)}</td><td>${esc(m.status)}</td></tr>`
  ).join("");

  const atRisk = p.assumptions.filter((a) => a.status === "At Risk" || a.status === "Watch");
  const assumptionBlocks = atRisk.map((a) => `
    <div class="assumption-card">
      <div class="title-row"><span class="title">${esc(a.title)}</span><span class="${statusClass(a.status)}">${esc(a.status)}</span></div>
      <div class="detail"><strong>Confidence:</strong> ${a.confidence}% &nbsp;·&nbsp; <strong>Evidence:</strong> ${esc(a.evidenceGrade)}</div>
      <div class="detail"><strong>Failure trigger:</strong> ${esc(a.failureTrigger)}</div>
      <div class="detail"><strong>Current signal:</strong> ${esc(a.currentSignal)}</div>
      <div class="detail"><strong>Action:</strong> ${esc(a.recommendedAction)}</div>
    </div>
  `).join("");

  const vendorRiskRows = p.vendors.map((v) =>
    `<li><strong>${esc(v.name)}</strong> (Score: ${v.score}, Confidence: ${v.confidence}) — Risks: ${esc(v.risks.join(", ") || "None identified")}</li>`
  ).join("");

  return `
${sectionScope(p)}

<h2>Risk Summary</h2>
<div class="score-row">
  <div class="score-card" style="border-color:#dc2626;background:#fef2f2"><div class="label">Critical</div><div class="value" style="color:#dc2626">${critical}</div></div>
  <div class="score-card" style="border-color:#e11d48;background:#fff1f2"><div class="label">High</div><div class="value" style="color:#e11d48">${high}</div></div>
  <div class="score-card" style="border-color:#d97706;background:#fffbeb"><div class="label">Medium</div><div class="value" style="color:#d97706">${medium}</div></div>
  <div class="score-card"><div class="label">Total</div><div class="value">${p.risks.length}</div></div>
</div>

<h2>Full Risk Register</h2>
<table>
  <thead><tr><th>#</th><th>Risk</th><th>Category</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th><th>Owner</th><th>Status</th></tr></thead>
  <tbody>${riskRows}</tbody>
</table>

<h2>Mitigation Controls</h2>
<table>
  <thead><tr><th>Control</th><th>Description</th><th>Status</th></tr></thead>
  <tbody>${controlRows}</tbody>
</table>

<h2>Assumption Risk</h2>
${atRisk.length > 0 ? assumptionBlocks : `<p>All assumptions currently stable.</p>`}

<h2>Vendor Risk Profile</h2>
${p.vendors.length > 0 ? `<ul>${vendorRiskRows}</ul>` : `<p><em>No vendors selected.</em></p>`}

${sectionProvenance(p)}`;
}

const BODY_RENDERERS: Record<ExportType, (p: BoardPackExporterProps) => string> = {
  "Executive Summary": bodyExecutiveSummary,
  "Board Pack": bodyBoardPack,
  "Procurement Pack": bodyProcurementPack,
  "Risk Review": bodyRiskReview,
};

export const FILENAMES: Record<ExportType, string> = {
  "Executive Summary": "AG-Executive-Summary",
  "Board Pack": "AG-Board-Defence-Pack",
  "Procurement Pack": "AG-Procurement-Pack",
  "Risk Review": "AG-Risk-Review",
};

function downloadBlob(filename: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Deliberately NOT revoked immediately and NOT auto-opened in a new tab:
  // auto window.open after a timer either gets popup-blocked (silent failure)
  // or opens a duplicate tab next to a successful download. Instead the URL
  // is returned so the UI can render an explicit "open in new tab" fallback
  // link, and revoked when the next export replaces it.
  return url;
}

/** Pure pack renderer — single source for the in-app export and for tests. */
export function renderPackHtml(type: ExportType, props: BoardPackExporterProps, headshotDataUri = ""): string {
  const body = BODY_RENDERERS[type](props);
  const shortlistLabel = props.vendors.map((v) => v.name).join(", ");
  return htmlShell(SUBTITLES[type], type, body, headshotDataUri, shortlistLabel);
}

export default function BoardPackExporter(props: BoardPackExporterProps) {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [format, setFormat] = useState<"html" | "pptx">("html");
  const [lastExport, setLastExport] = useState<{ type: ExportType; url: string; filename: string } | null>(null);
  const hasShortlist = props.vendors.length > 0;

  const handleExport = useCallback(async (type: ExportType) => {
    setExporting(type);
    try {
      const headshotDataUri = await fetchHeadshotBase64();
      const date = new Date().toISOString().slice(0, 10);
      let url: string;
      let filename: string;
      if (format === "pptx") {
        // Lazy-loaded so the page bundle stays lean.
        const { generatePackPptx } = await import("./board-pack-pptx");
        const blob = await generatePackPptx(type, props, headshotDataUri);
        filename = `${FILENAMES[type]}-${date}.pptx`;
        url = downloadBlob(filename, blob);
      } else {
        const html = renderPackHtml(type, props, headshotDataUri);
        filename = `${FILENAMES[type]}-${date}.html`;
        url = downloadBlob(filename, new Blob([html], { type: "text/html; charset=utf-8" }));
      }
      setLastExport((prev) => {
        if (prev) URL.revokeObjectURL(prev.url); // free the previous blob
        return { type, url, filename };
      });
    } finally {
      setTimeout(() => setExporting(null), 800);
    }
  }, [props, format]);

  return (
    <div>
      <p className="mb-3 text-xs text-[#5f685a]">
        {hasShortlist
          ? "Export the board defence case in the format your audience needs."
          : "No assessment shortlist yet. The Executive Summary exports as a concise AI-market overview; the Board, Procurement and Risk packs unlock once you run an assessment in Assess."}
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-[10px] text-[#697362]">Format</span>
        {([
          { key: "html", label: "Document (HTML → PDF)" },
          { key: "pptx", label: "PowerPoint (.pptx)" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFormat(f.key)}
            className={`rounded-full border px-3 py-1 font-semibold transition-colors ${
              format === f.key
                ? "border-[#071827] bg-[#071827] text-white dark:border-emerald-500 dark:bg-emerald-600"
                : "border-[#cfd7c8] bg-white text-[#18201b] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["Executive Summary", "Board Pack", "Procurement Pack", "Risk Review"] as ExportType[]).map((t) => {
          const needsShortlist = t !== "Executive Summary";
          const locked = needsShortlist && !hasShortlist;
          return (
            <button
              key={t}
              onClick={() => handleExport(t)}
              disabled={exporting !== null || locked}
              aria-disabled={locked}
              title={locked ? "Requires a completed assessment shortlist — run Assess first" : undefined}
              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                locked
                  ? "cursor-not-allowed border-dashed border-[#cfd7c8] bg-[#f4f6f1] text-[#a1a8a0] dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-600"
                  : "border-[#cfd7c8] bg-white text-[#18201b] hover:bg-[#eef2e8] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {exporting === t ? "Exporting…" : locked ? `${t} — requires assessment` : `Export ${t}`}
            </button>
          );
        })}
      </div>
      {lastExport && (
        <p className="mt-2 text-[11px] text-[#5f685a] dark:text-zinc-400">
          Exported <strong>{lastExport.type}</strong> ({lastExport.filename.endsWith(".pptx") ? "PowerPoint" : "HTML"}).{" "}
          Didn&apos;t download?{" "}
          <a
            href={lastExport.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
            download={lastExport.filename}
          >
            Open it here
          </a>
          .
        </p>
      )}
      <p className="mt-2 text-[10px] text-[#697362]">
        Document format: open in browser and print to PDF. PowerPoint format: native, fully editable slides.
      </p>
    </div>
  );
}
