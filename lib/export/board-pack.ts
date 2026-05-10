// Renders an assessment result into a self-contained HTML board pack.
// Print-to-PDF friendly: single column, no external assets.

import type { AssessmentResult, VendorResult, PillarId } from "../types";
import { PILLARS } from "../types";
import { DOMAIN_CROSSWALK } from "./compliance-mappings";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function bandLabel(b: string): string {
  return ({
    enterprise_scale: "Enterprise-scale candidate",
    controlled_deployment: "Controlled deployment",
    pilot_only: "Pilot only",
    not_recommended: "Not recommended",
  } as Record<string, string>)[b] ?? b;
}

function vendorBlock(vr: VendorResult): string {
  const pillars = PILLARS.map((p) => `
    <tr>
      <td>${esc(p.label)}</td>
      <td class="num">${vr.pillarScores[p.id as PillarId].toFixed(0)}</td>
    </tr>`).join("");

  const breakdown = vr.pillarBreakdown.map((b) => `
    <li><strong>${esc(PILLARS.find((p) => p.id === b.pillar)!.label)}:</strong>
        ${b.score.toFixed(0)} × ${(b.weight * 100).toFixed(0)}% = ${b.weightedContribution.toFixed(1)}
        <span class="muted">(${b.contributingDomains.filter((d) => d.evidenceCount > 0).map((d) => `${d.domain}:${d.score.toFixed(0)}`).join(" · ") || "no evidence"})</span>
    </li>`).join("");

  return `
  <section class="vendor ${vr.excluded ? "excluded" : ""}">
    <header>
      <h2>#${vr.rank} · ${esc(vr.vendorName)}</h2>
      <div class="meta">
        <span class="band">${esc(bandLabel(vr.recommendationBand))}</span>
        <span>Score: <strong>${vr.excluded ? "—" : vr.finalScore.toFixed(1)}</strong></span>
        <span>Confidence: ${vr.confidenceScore.toFixed(0)}/100</span>
      </div>
      <p class="rationale">${esc(vr.industryRationale)}</p>
    </header>
    ${vr.excluded ? `<div class="warn">Excluded: ${esc(vr.excludedReason ?? "")}</div>` : ""}

    <h3>Pillar scores</h3>
    <table class="pillars"><tbody>${pillars}</tbody></table>

    <div class="grid">
      <div>
        <h3>Top strengths</h3>
        <ul>${vr.topStrengths.map((s) => `<li>${esc(s)}</li>`).join("") || "<li class='muted'>None</li>"}</ul>
      </div>
      <div>
        <h3>Top risks</h3>
        <ul>${vr.topRisks.map((s) => `<li>${esc(s)}</li>`).join("") || "<li class='muted'>None</li>"}</ul>
      </div>
      <div>
        <h3>Missing evidence</h3>
        <ul>${vr.missingEvidence.map((s) => `<li>${esc(s)}</li>`).join("") || "<li class='muted'>None</li>"}</ul>
      </div>
      <div>
        <h3>Validation steps</h3>
        <ul>${vr.validationSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>
    </div>

    <h3>Score components</h3>
    <ul class="components">${breakdown}</ul>
    <p class="adjustments">
      Adjustments — strategic fit: +${vr.bonuses.strategicFit.toFixed(1)} ·
      sector adoption: +${vr.bonuses.sectorAdoptionFit.toFixed(1)} ·
      risk: −${vr.penalties.risk.toFixed(1)} ·
      missing evidence: −${vr.penalties.missingEvidence.toFixed(1)} ·
      adoption friction: −${vr.penalties.adoptionFriction.toFixed(1)}
    </p>
  </section>`;
}

function complianceCrosswalk(): string {
  const rows = Object.values(DOMAIN_CROSSWALK).map((row) => `
    <tr>
      <td>${esc(row.domain.replace(/_/g, " "))}</td>
      <td>${row.euAiAct.map(esc).join(", ") || "<span class='muted'>—</span>"}</td>
      <td>${row.iso27001.map(esc).join(", ") || "<span class='muted'>—</span>"}</td>
      <td>${row.iso42001.map(esc).join(", ") || "<span class='muted'>—</span>"}</td>
      <td>${row.nistAiRmf.map(esc).join(", ") || "<span class='muted'>—</span>"}</td>
    </tr>`).join("");
  return `
  <section class="compliance">
    <h2>Compliance crosswalk</h2>
    <p class="muted">Backend domain → EU AI Act / ISO/IEC 27001:2022 / ISO/IEC 42001 / NIST AI RMF.</p>
    <table>
      <thead><tr><th>Domain</th><th>EU AI Act</th><th>ISO 27001</th><th>ISO 42001</th><th>NIST AI RMF</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export interface BoardPackOptions {
  includeCompliance?: boolean;
  reportTitle?: string;
}

export function renderBoardPackHtml(result: AssessmentResult, opts: BoardPackOptions = {}): string {
  const title = opts.reportTitle ?? `AI Platform Ranking — ${result.inputSummary.industryName}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #18181b; max-width: 920px; margin: 24px auto; padding: 0 24px; }
  h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: -0.01em; }
  h2 { margin: 24px 0 8px; font-size: 18px; letter-spacing: -0.01em; }
  h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #52525b; }
  .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #52525b; }
  .band { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #f4f4f5; color: #18181b; font-weight: 600; }
  .summary-box { border: 1px solid #e4e4e7; border-radius: 12px; padding: 12px 16px; margin-top: 12px; }
  .vendor { border-top: 1px solid #e4e4e7; padding-top: 16px; margin-top: 24px; page-break-inside: avoid; }
  .vendor.excluded { background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 12px; }
  .rationale { color: #52525b; font-size: 13px; margin: 4px 0 0; }
  .warn { background: #fef2f2; color: #991b1b; padding: 6px 10px; border-radius: 8px; font-size: 13px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #f4f4f5; }
  td.num { font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px; }
  ul { margin: 4px 0 8px; padding-left: 20px; }
  li { margin: 2px 0; }
  .components li { font-size: 12px; }
  .muted { color: #a1a1aa; font-style: italic; }
  .adjustments { font-size: 12px; color: #52525b; margin-top: 8px; }
  footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e4e4e7; font-size: 11px; color: #71717a; }
  @page { margin: 18mm; }
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">
  <span>Run: <code>${esc(result.runId)}</code></span>
  <span>Generated: ${esc(new Date(result.generatedAt).toLocaleString())}</span>
  <span>Scoring rule: ${esc(result.scoringRuleVersion)}</span>
</div>

<section class="summary-box">
  <h3>Context</h3>
  <p style="margin:4px 0 8px"><strong>${esc(result.inputSummary.industryName)}</strong> ·
    Use cases: ${esc(result.inputSummary.useCases.join(", "))} ·
    Sensitivity ${result.inputSummary.dataSensitivity}/5 · Risk tolerance ${result.inputSummary.riskTolerance}/5 ·
    Autonomy: ${esc(result.inputSummary.autonomyAppetite)} ·
    Deployment: ${esc(result.inputSummary.deploymentPreference)}
  </p>
  <h3>Why this ranking</h3>
  <p style="margin:4px 0 0">${esc(result.comparisonSummary)}</p>
</section>

${result.ranking.map(vendorBlock).join("")}

${opts.includeCompliance ? complianceCrosswalk() : ""}

<footer>
  Generated by Enterprise AI Platform Ranking Engine. This document combines machine-extracted public evidence with deterministic scoring rules. It is not a substitute for procurement, security, legal, privacy, or contract review.
</footer>
</body></html>`;
}
