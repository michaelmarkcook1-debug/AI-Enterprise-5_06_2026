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
}

type ExportType = "Executive Summary" | "Board Pack" | "Procurement Pack" | "Risk Review";

const CEO_BIO =
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

const CONFIDENTIALITY: Record<ExportType, string> = {
  "Executive Summary": "Board / C-Suite Only",
  "Board Pack": "Board / C-Suite Only",
  "Procurement Pack": "Procurement / Vendor Management",
  "Risk Review": "Risk Committee / CISO",
};

const SUBTITLES: Record<ExportType, string> = {
  "Executive Summary": "AI Investment — Executive Summary",
  "Board Pack": "AI Investment — Board Defence Pack",
  "Procurement Pack": "AI Vendor Selection — Procurement Pack",
  "Risk Review": "AI Investment — Risk Review",
};

function htmlShell(title: string, type: ExportType, body: string, headshotDataUri: string): string {
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
<div class="doc-meta">Generated ${timestamp()} &nbsp;·&nbsp; AnalystGenius Proprietary Methodology</div>

${body}

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

</body>
</html>`;
}

function severityClass(s: string): string {
  if (s === "Critical") return "severity-critical";
  if (s === "High") return "severity-high";
  if (s === "Medium") return "severity-medium";
  return "severity-low";
}

function statusClass(s: string): string {
  if (s === "At Risk" || s === "Broken") return "status-atrisk";
  if (s === "Watch") return "status-watch";
  return "status-stable";
}

function bodyExecutiveSummary(p: BoardPackExporterProps): string {
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

<h2>Business Case</h2>
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
${riskRows ? `<ul>${riskRows}</ul>` : `<p>No critical or high risks identified.</p>`}`;
}

function bodyBoardPack(p: BoardPackExporterProps): string {
  const vendorBlocks = p.vendors.map((v) => `
    <h3>${esc(v.name)}</h3>
    <p><strong>Role:</strong> ${esc(v.role)} &nbsp;·&nbsp; <strong>Score:</strong> ${v.score} &nbsp;·&nbsp; <strong>Confidence:</strong> ${v.confidence}</p>
    <p><strong>Top pillars:</strong> ${esc(v.topPillars.join(", ") || "—")}</p>
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

<h2>1. Why Invest?</h2>
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
<ul>
  <li>Peers adopting AI see 15–30% productivity gains within 12 months</li>
  <li>Enterprise AI platforms maturing rapidly — delaying increases switching cost</li>
  <li>AI-skilled workforce increasingly scarce — early movers secure better talent</li>
</ul>

<h2>3. Recommended Vendor Shortlist</h2>
${p.vendors.length > 0 ? vendorBlocks : `<p><em>No vendors selected. Run an assessment to populate.</em></p>`}

<h2>4. Competitive Position</h2>
${competitorBlocks}

<h2>5. Risk Register</h2>
<table>
  <thead><tr><th>Risk</th><th>Category</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th><th>Owner</th></tr></thead>
  <tbody>${riskRows}</tbody>
</table>

<h2>6. Controls &amp; Governance</h2>
<ul>${controlRows}</ul>

<h2>7. Assumptions</h2>
${assumptionBlocks}

<h2>8. Value Realisation KPIs</h2>
<table>
  <thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Owner</th><th>Cadence</th></tr></thead>
  <tbody>${kpiRows}</tbody>
</table>`;
}

function bodyProcurementPack(p: BoardPackExporterProps): string {
  const vendorRows = p.vendors.map((v) =>
    `<tr><td><strong>${esc(v.name)}</strong></td><td>${esc(v.role)}</td><td>${v.score}</td><td>${v.confidence}</td><td>${esc(v.topPillars.join(", ") || "—")}</td><td>${esc(v.risks.join(", ") || "—")}</td></tr>`
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
<h2>Vendor Shortlist</h2>
${p.vendors.length > 0
    ? `<table><thead><tr><th>Vendor</th><th>Role</th><th>Score</th><th>Confidence</th><th>Top Pillars</th><th>Risks</th></tr></thead><tbody>${vendorRows}</tbody></table>`
    : `<p><em>No vendors selected. Run an assessment to populate.</em></p>`}

<h2>Vendor Risk Considerations</h2>
${vendorRiskRows
    ? `<table><thead><tr><th>Risk</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th><th>Owner</th></tr></thead><tbody>${vendorRiskRows}</tbody></table>`
    : `<p>No vendor-specific risks identified.</p>`}

<h2>Competitive Landscape</h2>
<ul>${competitorRows}</ul>

<h2>Contract Controls</h2>
<ul>${controlRows}</ul>

<h2>Value Realisation Targets</h2>
<table>
  <thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Owner</th></tr></thead>
  <tbody>${kpiRows}</tbody>
</table>`;
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
${p.vendors.length > 0 ? `<ul>${vendorRiskRows}</ul>` : `<p><em>No vendors selected.</em></p>`}`;
}

const BODY_RENDERERS: Record<ExportType, (p: BoardPackExporterProps) => string> = {
  "Executive Summary": bodyExecutiveSummary,
  "Board Pack": bodyBoardPack,
  "Procurement Pack": bodyProcurementPack,
  "Risk Review": bodyRiskReview,
};

const FILENAMES: Record<ExportType, string> = {
  "Executive Summary": "AG-Executive-Summary",
  "Board Pack": "AG-Board-Defence-Pack",
  "Procurement Pack": "AG-Procurement-Pack",
  "Risk Review": "AG-Risk-Review",
};

function downloadHtml(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Fallback: if download attribute is ignored (cross-origin/tunnel), open in new tab
  const fallbackTimer = setTimeout(() => {
    window.open(url, "_blank");
  }, 500);
  // If the page loses focus, the download likely started — cancel fallback
  const cancelFallback = () => { clearTimeout(fallbackTimer); window.removeEventListener("blur", cancelFallback); };
  window.addEventListener("blur", cancelFallback);
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.removeEventListener("blur", cancelFallback);
  }, 3000);
}

export default function BoardPackExporter(props: BoardPackExporterProps) {
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const handleExport = useCallback(async (type: ExportType) => {
    setExporting(type);
    try {
      const headshotDataUri = await fetchHeadshotBase64();
      const body = BODY_RENDERERS[type](props);
      const title = SUBTITLES[type];
      const html = htmlShell(title, type, body, headshotDataUri);
      const date = new Date().toISOString().slice(0, 10);
      downloadHtml(`${FILENAMES[type]}-${date}.html`, html);
    } finally {
      setTimeout(() => setExporting(null), 800);
    }
  }, [props]);

  return (
    <div>
      <p className="mb-3 text-xs text-[#5f685a]">
        Export the board defence case in the format your audience needs. Print to PDF from your browser.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["Executive Summary", "Board Pack", "Procurement Pack", "Risk Review"] as ExportType[]).map((t) => (
          <button
            key={t}
            onClick={() => handleExport(t)}
            disabled={exporting !== null}
            className="rounded-full border border-[#cfd7c8] bg-white px-4 py-2 text-xs font-semibold text-[#18201b] hover:bg-[#eef2e8] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {exporting === t ? "Exporting…" : `Export ${t}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#697362]">
        HTML export — open in browser and print to PDF. PowerPoint format coming soon.
      </p>
    </div>
  );
}
