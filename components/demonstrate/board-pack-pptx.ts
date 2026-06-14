// Board pack PPTX generator — AnalystGenius brand.
// ──────────────────────────────────────────────────
// Same data contract as the HTML packs (BoardPackExporterProps), rendered as
// a native, fully editable PowerPoint deck via pptxgenjs. Loaded lazily
// (dynamic import) so the Demonstrate page bundle stays lean.
//
// Design system (mirrors the HTML packs):
//   Navy 071827 dominant on title/closing slides ("sandwich" structure),
//   white content slides, emerald 6EE7B7 + gold F5C451 accents,
//   Arial throughout (metric-safe in PowerPoint and LibreOffice).

import type PptxGenJS from "pptxgenjs";
import type { BoardPackExporterProps, ExportType } from "./BoardPackExporter";
import { CEO_BIO, CONFIDENTIALITY, SUBTITLES, deriveMarketTakeaways } from "./BoardPackExporter";
import { AG_LOGO_PNG_B64 } from "./board-pack-pptx-logo";

// ── Palette ──────────────────────────────────────────────────────────
const NAVY = "071827";
const INK = "18201B";
const MUTED = "697362";
const FAINT = "A1A8A0";
const EMERALD = "6EE7B7";
const EMERALD_DARK = "065F46";
const GOLD = "F5C451";
const ROSE = "DC2626";
const AMBER = "D97706";
const ROW_ALT = "F4F6F1";
const HAIR = "E4E8DF";

const PAGE_W = 10;
const PAGE_H = 5.625;
const MARGIN = 0.55;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT = "Arial";

type Slide = PptxGenJS.Slide;
type TableRow = PptxGenJS.TableRow;

function ts(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function humanisePillar(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── Shared slide furniture ───────────────────────────────────────────

function titleSlide(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addImage({ data: AG_LOGO_PNG_B64, x: MARGIN, y: 0.5, w: 0.62, h: 0.62 });
  s.addText("AnalystGenius", { x: MARGIN + 0.78, y: 0.5, w: 4.5, h: 0.4, fontFace: FONT, fontSize: 19, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("AI ENTERPRISE — CIO DECISION INTELLIGENCE PLATFORM", { x: MARGIN + 0.78, y: 0.86, w: 5.5, h: 0.3, fontFace: FONT, fontSize: 8, color: FAINT, charSpacing: 2, margin: 0 });

  // Confidentiality chip
  s.addShape("roundRect", { x: PAGE_W - MARGIN - 2.6, y: 0.55, w: 2.6, h: 0.36, rectRadius: 0.18, fill: { color: "0E2436" }, line: { color: GOLD, width: 0.75 } });
  s.addText(CONFIDENTIALITY[type].toUpperCase(), { x: PAGE_W - MARGIN - 2.6, y: 0.55, w: 2.6, h: 0.36, fontFace: FONT, fontSize: 8, bold: true, color: GOLD, align: "center", valign: "middle", charSpacing: 1, margin: 0 });

  s.addText(SUBTITLES[type], { x: MARGIN, y: 2.15, w: CONTENT_W, h: 1.1, fontFace: FONT, fontSize: 34, bold: true, color: "FFFFFF", margin: 0 });
  const shortlist = p.vendors.map((v) => v.name).join("  ·  ");
  s.addText([
    { text: "Generated ", options: { color: FAINT } },
    { text: ts(), options: { color: "FFFFFF", bold: true } },
    ...(shortlist ? [{ text: "      Shortlist: ", options: { color: FAINT } }, { text: shortlist, options: { color: EMERALD, bold: true } }] : []),
  ], { x: MARGIN, y: 3.35, w: CONTENT_W, h: 0.4, fontFace: FONT, fontSize: 12, margin: 0 });

  s.addText("AnalystGenius Proprietary Methodology — evidence-graded and confidence-labelled", { x: MARGIN, y: PAGE_H - 0.85, w: 6.5, h: 0.3, fontFace: FONT, fontSize: 8.5, italic: true, color: FAINT, margin: 0 });
}

let pageNo = 0;

function contentSlide(pres: PptxGenJS, type: ExportType, title: string): Slide {
  const s = pres.addSlide();
  s.background = { color: "FFFFFF" };
  s.addImage({ data: AG_LOGO_PNG_B64, x: MARGIN, y: 0.28, w: 0.3, h: 0.3 });
  s.addText(`AnalystGenius · ${SUBTITLES[type]}`, { x: MARGIN + 0.42, y: 0.28, w: 7, h: 0.3, fontFace: FONT, fontSize: 8.5, color: MUTED, valign: "middle", margin: 0 });
  pageNo += 1;
  s.addText(String(pageNo).padStart(2, "0"), { x: PAGE_W - MARGIN - 0.6, y: 0.28, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 8.5, color: FAINT, align: "right", valign: "middle", margin: 0 });
  s.addText(title, { x: MARGIN, y: 0.72, w: CONTENT_W, h: 0.55, fontFace: FONT, fontSize: 23, bold: true, color: INK, margin: 0 });
  return s;
}

function note(s: Slide, text: string, y: number, w: number = CONTENT_W) {
  s.addText(text, { x: MARGIN, y, w, h: 0.32, fontFace: FONT, fontSize: 9.5, italic: true, color: MUTED, margin: 0 });
}

function statCards(s: Slide, y: number, cards: { label: string; value: string; sub?: string; tone?: "blue" | "green" | "rose" | "amber" | "plain" }[]) {
  const gap = 0.3;
  const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const tones: Record<string, { fill: string; val: string; line: string }> = {
    blue: { fill: "EFF6FF", val: "1E40AF", line: "93C5FD" },
    green: { fill: "F0FDF8", val: EMERALD_DARK, line: EMERALD },
    rose: { fill: "FEF2F2", val: ROSE, line: "FCA5A5" },
    amber: { fill: "FFFBEB", val: AMBER, line: "FCD34D" },
    plain: { fill: "FFFFFF", val: NAVY, line: HAIR },
  };
  cards.forEach((c, i) => {
    const t = tones[c.tone ?? "plain"];
    const x = MARGIN + i * (w + gap);
    s.addShape("roundRect", { x, y, w, h: 1.25, rectRadius: 0.08, fill: { color: t.fill }, line: { color: t.line, width: 1 }, shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 90, opacity: 0.1 } });
    s.addText(c.label.toUpperCase(), { x: x + 0.1, y: y + 0.12, w: w - 0.2, h: 0.25, fontFace: FONT, fontSize: 8, bold: true, color: MUTED, align: "center", charSpacing: 1, margin: 0 });
    const big = c.value.length <= 4;
    s.addText(c.value, { x: x + 0.1, y: y + 0.33, w: w - 0.2, h: 0.62, fontFace: FONT, fontSize: big ? 36 : 16, bold: true, color: t.val, align: "center", valign: "middle", margin: 0 });
    if (c.sub) s.addText(c.sub, { x: x + 0.1, y: y + 0.95, w: w - 0.2, h: 0.22, fontFace: FONT, fontSize: 8, color: MUTED, align: "center", margin: 0 });
  });
}

function headerRow(cells: string[]): TableRow {
  return cells.map((c) => ({
    text: c.toUpperCase(),
    options: { fill: { color: NAVY }, color: "FFFFFF", bold: true, fontSize: 8, fontFace: FONT, charSpacing: 0.5, valign: "middle" as const },
  }));
}

function bodyCell(text: string, opts: Record<string, unknown> = {}) {
  return { text, options: { fontSize: 9.5, fontFace: FONT, color: INK, valign: "top" as const, ...opts } };
}

function addBrandTable(s: Slide, y: number, rows: TableRow[], colW: number[], opts: { h?: number } = {}) {
  s.addTable(rows, {
    x: MARGIN, y, w: CONTENT_W, colW,
    border: { type: "solid", pt: 0.5, color: HAIR },
    autoPage: false,
    rowH: 0.3,
    ...(opts.h ? { h: opts.h } : {}),
  });
}

function altFill(i: number) {
  return i % 2 === 1 ? { fill: { color: ROW_ALT } } : {};
}

function sevColor(sev: string): string {
  if (sev === "Critical") return ROSE;
  if (sev === "High") return "E11D48";
  if (sev === "Medium") return AMBER;
  return "059669";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function closingSlide(pres: PptxGenJS, headshot: string) {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  if (headshot) {
    s.addImage({ data: headshot, x: MARGIN, y: 1.35, w: 1.5, h: 1.5, rounding: true });
  } else {
    s.addShape("ellipse", { x: MARGIN, y: 1.35, w: 1.5, h: 1.5, fill: { color: "0E2436" }, line: { color: EMERALD, width: 1 } });
    s.addText("MC", { x: MARGIN, y: 1.35, w: 1.5, h: 1.5, fontFace: FONT, fontSize: 26, bold: true, color: EMERALD, align: "center", valign: "middle", margin: 0 });
  }
  s.addText("Michael Cook", { x: 2.35, y: 1.4, w: 6.5, h: 0.45, fontFace: FONT, fontSize: 22, bold: true, color: "FFFFFF", margin: 0 });
  s.addText("CEO — AnalystGenius", { x: 2.35, y: 1.85, w: 6.5, h: 0.3, fontFace: FONT, fontSize: 11, color: GOLD, margin: 0 });
  s.addText(CEO_BIO, { x: 2.35, y: 2.25, w: 6.9, h: 1.6, fontFace: FONT, fontSize: 10, color: "C9D1CC", lineSpacingMultiple: 1.25, margin: 0 });
  s.addImage({ data: AG_LOGO_PNG_B64, x: MARGIN, y: PAGE_H - 1.0, w: 0.4, h: 0.4 });
  s.addText(
    `Generated by AI Enterprise — AnalystGenius proprietary methodology. Evidence-graded and confidence-labelled. Estimated data is clearly marked. This document is not financial, legal, or procurement advice. © ${new Date().getFullYear()} AnalystGenius. All rights reserved.`,
    { x: MARGIN + 0.55, y: PAGE_H - 1.05, w: 8.3, h: 0.6, fontFace: FONT, fontSize: 7.5, color: FAINT, valign: "middle", margin: 0 },
  );
}

// ── Shared content slides ────────────────────────────────────────────

function slideDecision(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  const s = contentSlide(pres, type, "The Decision");
  statCards(s, 1.45, [
    { label: "Board Defence", value: String(p.boardDefenceScore), sub: "out of 100", tone: "blue" },
    { label: "CIO Confidence", value: String(p.cioConfidenceScore), sub: "out of 100", tone: "green" },
    { label: "Recommendation", value: p.recommendation, tone: "plain" },
  ]);
  const sc = p.scope;
  const rows: TableRow[] = [];
  const push = (l: string, v: string) => { if (v) rows.push([bodyCell(l.toUpperCase(), { color: MUTED, fontSize: 8, bold: true }), bodyCell(v, { bold: true })]); };
  push("Shortlisted vendors", p.vendors.map((v) => v.name).join(", "));
  push("Industries", sc.industries.join(", "));
  push("Use cases", sc.useCases.join(", "));
  push("Region", sc.region);
  push("Data sensitivity", sc.dataSensitivity);
  push("Cost sensitivity", sc.costSensitivity);
  note(s, "This deck defends the shortlist produced under the context below. If the context changes, re-run the assessment.", 2.95);
  addBrandTable(s, 3.3, rows, [2.2, CONTENT_W - 2.2]);
}

function slideBusinessCase(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps, title = "Why Invest?") {
  const s = contentSlide(pres, type, title);
  note(s, "Illustrative template — quantify with your organisation's figures before board submission.", 1.32);
  s.addText(p.businessCase.businessProblem, { x: MARGIN, y: 1.7, w: 4.3, h: 1.1, fontFace: FONT, fontSize: 11, color: INK, lineSpacingMultiple: 1.2, margin: 0 });
  s.addText("INTENDED OUTCOMES", { x: MARGIN, y: 2.9, w: 4.3, h: 0.28, fontFace: FONT, fontSize: 9, bold: true, color: MUTED, charSpacing: 1, margin: 0 });
  s.addText(
    p.businessCase.intendedOutcomes.map((o, i, a) => ({ text: o, options: { bullet: { code: "2022" }, breakLine: i < a.length - 1, color: INK } })),
    { x: MARGIN, y: 3.2, w: 4.3, h: 1.7, fontFace: FONT, fontSize: 10.5, paraSpaceAfter: 6, margin: 0 },
  );
  const rows: TableRow[] = [headerRow(["Impact area", "Estimate"])];
  const impacts: [string, string][] = [
    ["Productivity", p.businessCase.productivityImpact],
    ["Cost reduction", p.businessCase.costReductionPotential],
    ["Revenue", p.businessCase.revenuePotential],
    ["CX / EX", p.businessCase.cxExImpact],
  ];
  impacts.forEach(([k, v], i) => rows.push([bodyCell(k, { bold: true, ...altFill(i) }), bodyCell(v, altFill(i))]));
  s.addTable(rows, { x: 5.2, y: 1.7, w: PAGE_W - MARGIN - 5.2, colW: [1.45, PAGE_W - MARGIN - 5.2 - 1.45], border: { type: "solid", pt: 0.5, color: HAIR }, rowH: 0.42 });
}

function slideVendors(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  const s = contentSlide(pres, type, "Recommended Vendor Shortlist");
  if (p.vendors.length === 0) {
    note(s, "No vendors selected. Run an assessment in Assess to populate.", 1.5);
    return;
  }
  const gap = 0.3;
  const cols = Math.min(3, p.vendors.length);
  const w = (CONTENT_W - gap * (cols - 1)) / cols;
  p.vendors.slice(0, 3).forEach((v, i) => {
    const x = MARGIN + i * (w + gap);
    const y = 1.5;
    s.addShape("roundRect", { x, y, w, h: 3.3, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: HAIR, width: 1 }, shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 } });
    s.addText(v.name, { x: x + 0.18, y: y + 0.16, w: w - 0.36, h: 0.35, fontFace: FONT, fontSize: 15, bold: true, color: NAVY, margin: 0 });
    s.addText(v.role, { x: x + 0.18, y: y + 0.52, w: w - 0.36, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, margin: 0 });
    s.addText([
      { text: String(v.score), options: { fontSize: 26, bold: true, color: EMERALD_DARK } },
      { text: "  score   ", options: { fontSize: 9, color: MUTED } },
      { text: String(v.confidence), options: { fontSize: 26, bold: true, color: NAVY } },
      { text: "  conf.", options: { fontSize: 9, color: MUTED } },
    ], { x: x + 0.18, y: y + 0.9, w: w - 0.36, h: 0.55, fontFace: FONT, valign: "middle", margin: 0 });
    s.addText("TOP PILLARS", { x: x + 0.18, y: y + 1.6, w: w - 0.36, h: 0.22, fontFace: FONT, fontSize: 7.5, bold: true, color: MUTED, charSpacing: 1, margin: 0 });
    s.addText(v.topPillars.map(humanisePillar).join(", ") || "—", { x: x + 0.18, y: y + 1.82, w: w - 0.36, h: 0.55, fontFace: FONT, fontSize: 9.5, color: INK, margin: 0 });
    s.addText("RISKS", { x: x + 0.18, y: y + 2.42, w: w - 0.36, h: 0.22, fontFace: FONT, fontSize: 7.5, bold: true, color: MUTED, charSpacing: 1, margin: 0 });
    s.addText(v.risks.join(", ") || "None flagged", { x: x + 0.18, y: y + 2.64, w: w - 0.36, h: 0.55, fontFace: FONT, fontSize: 9.5, color: v.risks.length > 0 ? AMBER : MUTED, margin: 0 });
  });
}

function slideUptake(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  if (p.uptake.length === 0) return;
  const s = contentSlide(pres, type, "Market Penetration — Peer Adoption (Modelled)");
  note(s, `Share of named-vendor usage within ${p.uptakeScopeLabel}. Modelled estimates (May 2026 segment-share model) — directional, not audited market share.`, 1.32, CONTENT_W);
  s.addChart("bar", [{
    name: "Share of named usage (%)",
    labels: p.uptake.map((u) => u.vendor),
    values: p.uptake.map((u) => Number(u.sharePct.toFixed(1))),
  }], {
    x: MARGIN, y: 1.8, w: 5.4, h: 3.3, barDir: "bar",
    chartColors: [EMERALD_DARK],
    chartArea: { fill: { color: "FFFFFF" } },
    catAxisLabelColor: MUTED, valAxisLabelColor: MUTED,
    catAxisLabelFontSize: 9, valAxisLabelFontSize: 8,
    valGridLine: { color: HAIR, size: 0.5 }, catGridLine: { style: "none" },
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: INK, dataLabelFontSize: 9, dataLabelFormatCode: "0.0",
    showLegend: false, fontFace: FONT,
  });
  const rows: TableRow[] = [headerRow(["Vendor", "Share", "Conf."])];
  p.uptake.forEach((u, i) => rows.push([
    bodyCell(u.vendor, { bold: true, ...altFill(i) }),
    bodyCell(`${u.sharePct.toFixed(1)}%`, altFill(i)),
    bodyCell(u.confidence, { color: MUTED, ...altFill(i) }),
  ]));
  s.addTable(rows, { x: 6.2, y: 1.8, w: PAGE_W - MARGIN - 6.2, colW: [1.35, 0.85, (PAGE_W - MARGIN - 6.2) - 2.2], border: { type: "solid", pt: 0.5, color: HAIR }, rowH: 0.32 });
}

function slideReputation(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps, subtitle: string) {
  if (p.reputation.length === 0) return;
  const s = contentSlide(pres, type, "Reputation Snapshot — Shortlist");
  note(s, subtitle, 1.32);
  const fmt = (n: number | null) => (n === null ? "—" : String(n));
  const rows: TableRow[] = [headerRow(["Vendor", "Customer", "Developer", "Employee", "Uptime (12mo)"])];
  p.reputation.forEach((r, i) => rows.push([
    bodyCell(r.vendor, { bold: true, ...altFill(i) }),
    bodyCell(fmt(r.customer), altFill(i)),
    bodyCell(fmt(r.developer), altFill(i)),
    bodyCell(fmt(r.employee), altFill(i)),
    bodyCell(r.uptimePct === null ? "—" : `${r.uptimePct}%`, { bold: true, color: EMERALD_DARK, ...altFill(i) }),
  ]));
  addBrandTable(s, 1.8, rows, [2.6, 1.6, 1.6, 1.6, CONTENT_W - 7.4]);
}

function slidePricing(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  if (p.pricing.length === 0) return;
  const s = contentSlide(pres, type, "Indicative Cost — Token Pricing");
  note(s, "USD per 1M tokens, vendor-published list prices at generation date. Negotiated and committed-use pricing will differ — validate during procurement.", 1.32);
  const fmt = (n: number | null) => (n === null ? "Unverified" : `$${n.toFixed(2)}`);
  const rows: TableRow[] = [headerRow(["Vendor", "Model", "Input / 1M", "Output / 1M"])];
  p.pricing.forEach((r, i) => rows.push([
    bodyCell(r.vendorName, { bold: true, ...altFill(i) }),
    bodyCell(r.modelName, altFill(i)),
    bodyCell(fmt(r.inputPerM), altFill(i)),
    bodyCell(fmt(r.outputPerM), altFill(i)),
  ]));
  addBrandTable(s, 1.8, rows, [2.2, 3.7, 1.5, 1.5]);
}

function slideRisks(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps, opts: { title?: string; filterFn?: (r: BoardPackExporterProps["risks"][number]) => boolean } = {}) {
  const risks = opts.filterFn ? p.risks.filter(opts.filterFn) : p.risks;
  if (risks.length === 0) return;
  for (const [pi, page] of chunk(risks, 6).entries()) {
    const s = contentSlide(pres, type, `${opts.title ?? "Risk Register"}${pi > 0 ? " (cont.)" : ""}`);
    const rows: TableRow[] = [headerRow(["Risk", "Category", "Severity", "Likelihood", "Mitigation", "Owner"])];
    page.forEach((r, i) => rows.push([
      bodyCell(r.risk, { bold: true, ...altFill(i) }),
      bodyCell(r.category, { color: MUTED, ...altFill(i) }),
      bodyCell(r.severity, { bold: true, color: sevColor(r.severity), ...altFill(i) }),
      bodyCell(r.likelihood, { color: sevColor(r.likelihood), ...altFill(i) }),
      bodyCell(r.mitigation, altFill(i)),
      bodyCell(r.owner, { color: MUTED, ...altFill(i) }),
    ]));
    addBrandTable(s, 1.5, rows, [2.1, 1.1, 0.85, 0.95, 2.9, 1.0]);
  }
}

function slideKpis(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  if (p.kpis.length === 0) return;
  const s = contentSlide(pres, type, "Value Realisation KPIs");
  const rows: TableRow[] = [headerRow(["Metric", "Baseline", "Target", "Owner", "Cadence"])];
  p.kpis.forEach((k, i) => rows.push([
    bodyCell(k.metric, { bold: true, ...altFill(i) }),
    bodyCell(k.baseline, altFill(i)),
    bodyCell(k.target, { bold: true, color: EMERALD_DARK, ...altFill(i) }),
    bodyCell(k.owner, { color: MUTED, ...altFill(i) }),
    bodyCell(k.cadence, { color: MUTED, ...altFill(i) }),
  ]));
  addBrandTable(s, 1.5, rows, [3.0, 1.7, 1.6, 1.6, CONTENT_W - 7.9]);
}

function slideAssumptions(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps, onlyAtRisk = false) {
  const items = onlyAtRisk ? p.assumptions.filter((a) => a.status === "At Risk" || a.status === "Watch") : p.assumptions;
  if (items.length === 0) return;
  for (const [pi, page] of chunk(items, 4).entries()) {
    const s = contentSlide(pres, type, `${onlyAtRisk ? "Assumption Risk" : "Assumptions"}${pi > 0 ? " (cont.)" : ""}`);
    const gap = 0.25;
    const w = (CONTENT_W - gap) / 2;
    page.forEach((a, i) => {
      const x = MARGIN + (i % 2) * (w + gap);
      const y = 1.45 + Math.floor(i / 2) * 2.0;
      const statusColor = a.status === "At Risk" || a.status === "Broken" ? ROSE : a.status === "Watch" ? AMBER : "059669";
      s.addShape("roundRect", { x, y, w, h: 1.85, rectRadius: 0.07, fill: { color: "FFFFFF" }, line: { color: HAIR, width: 1 }, shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 90, opacity: 0.1 } });
      s.addText([
        { text: a.title, options: { bold: true, fontSize: 11, color: INK } },
        { text: `   ${a.status}`, options: { bold: true, fontSize: 9, color: statusColor } },
      ], { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.32, fontFace: FONT, margin: 0 });
      s.addText([
        { text: `Confidence ${a.confidence}% · Evidence ${a.evidenceGrade}`, options: { color: MUTED, breakLine: true } },
        { text: `Trigger: ${a.failureTrigger}`, options: { breakLine: true } },
        { text: `Signal: ${a.currentSignal}`, options: { breakLine: true } },
        { text: `Action: ${a.recommendedAction}`, options: { color: EMERALD_DARK } },
      ], { x: x + 0.15, y: y + 0.45, w: w - 0.3, h: 1.32, fontFace: FONT, fontSize: 8.5, color: INK, paraSpaceAfter: 3, margin: 0 });
    });
  }
}

function slideProvenance(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  const s = contentSlide(pres, type, "Data Basis & Provenance");
  const rows: TableRow[] = [headerRow(["Section", "Basis"])];
  const data: [string, string][] = [
    ["Vendor shortlist, scores, confidence, pillars", "Platform-derived from your AnalystGenius assessment run"],
    ...(p.reputation.length > 0 ? [["Reputation snapshot", "Curated from public review, developer and workplace sources; seed-confidence pending live refresh"] as [string, string]] : []),
    ...(p.uptake.length > 0 ? [["Market penetration", "MODELLED ESTIMATE (May 2026 segment-share model) — directional, not audited market share"] as [string, string]] : []),
    ...(p.pricing.length > 0 ? [["Token pricing", 'Vendor-published list prices; "Unverified" where no clean published line exists'] as [string, string]] : []),
    ["Business case, competitor profiles, risk register, KPIs, assumptions", "ILLUSTRATIVE TEMPLATES — tailor to your organisation before board submission"],
  ];
  data.forEach(([k, v], i) => rows.push([bodyCell(k, { bold: true, ...altFill(i) }), bodyCell(v, altFill(i))]));
  addBrandTable(s, 1.5, rows, [3.6, CONTENT_W - 3.6]);
}

function slideCompetitors(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps) {
  if (p.competitors.length === 0) return;
  for (const [pi, page] of chunk(p.competitors, 6).entries()) {
    const s = contentSlide(pres, type, `Competitive Position${pi > 0 ? " (cont.)" : ""}`);
    const rows: TableRow[] = [headerRow(["Peer", "Maturity", "Use cases", "Known vendors", "CIO implication"])];
    page.forEach((c, i) => rows.push([
      bodyCell(c.peer, { bold: true, ...altFill(i) }),
      bodyCell(c.maturity, { color: MUTED, ...altFill(i) }),
      bodyCell(c.useCases.join(", "), altFill(i)),
      bodyCell(c.knownVendors.join(", "), altFill(i)),
      bodyCell(c.implication, altFill(i)),
    ]));
    addBrandTable(s, 1.5, rows, [1.3, 1.0, 2.0, 1.8, 2.8]);
  }
}

function slideControls(pres: PptxGenJS, type: ExportType, p: BoardPackExporterProps, title: string) {
  if (p.mitigations.length === 0) return;
  const s = contentSlide(pres, type, title);
  const rows: TableRow[] = [headerRow(["Control", "Description", "Status"])];
  p.mitigations.forEach((m, i) => rows.push([
    bodyCell(m.control, { bold: true, ...altFill(i) }),
    bodyCell(m.description, altFill(i)),
    bodyCell(m.status, { color: MUTED, ...altFill(i) }),
  ]));
  addBrandTable(s, 1.5, rows, [2.4, 5.2, CONTENT_W - 7.6]);
}

function slideWhyNow(pres: PptxGenJS, type: ExportType) {
  const s = contentSlide(pres, type, "Why Now?");
  note(s, "Illustrative framing — replace with your organisation's specific drivers before board submission.", 1.32);
  const drivers = [
    ["Maturity window", "Enterprise AI platforms are maturing rapidly — delaying adoption raises future switching and integration cost."],
    ["Peer movement", "Peer organisations in scope industries are formalising AI vendor stacks (see Market Penetration)."],
    ["Talent scarcity", "AI-skilled talent is scarce — early movers secure implementation capability ahead of competitors."],
  ];
  drivers.forEach(([title, body], i) => {
    const y = 1.8 + i * 1.05;
    s.addShape("ellipse", { x: MARGIN, y: y + 0.05, w: 0.5, h: 0.5, fill: { color: "F0FDF8" }, line: { color: EMERALD, width: 1 } });
    s.addText(String(i + 1), { x: MARGIN, y: y + 0.05, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: EMERALD_DARK, align: "center", valign: "middle", margin: 0 });
    s.addText(title, { x: MARGIN + 0.75, y, w: CONTENT_W - 0.75, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: INK, margin: 0 });
    s.addText(body, { x: MARGIN + 0.75, y: y + 0.3, w: CONTENT_W - 0.75, h: 0.5, fontFace: FONT, fontSize: 10.5, color: MUTED, margin: 0 });
  });
}

// ── Pack assemblies ──────────────────────────────────────────────────

const REPUTATION_NOTE = "Three-pillar reputation (0–100): customer (review platforms), developer (GitHub / forums / API reliability), employee (workplace signals). 12-month service uptime where published.";
const REPUTATION_NOTE_PROCUREMENT = "Three-pillar reputation (0–100) and 12-month published uptime — use uptime history to anchor SLA and service-credit negotiation.";

export async function generatePackPptx(type: ExportType, p: BoardPackExporterProps, headshotDataUri = ""): Promise<Blob> {
  const { default: PptxGen } = await import("pptxgenjs");
  const pres = new PptxGen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "AnalystGenius";
  pres.company = "AnalystGenius";
  pres.title = `${SUBTITLES[type]} — AnalystGenius`;
  pageNo = 0;

  titleSlide(pres, type, p);

  if (type === "Executive Summary") {
    if (p.vendors.length === 0) {
      // Shortlist-free: a market overview a business leader can absorb fast.
      const m = p.marketOverview;
      const takeaways = deriveMarketTakeaways(m, p.reputation);

      // 1. Market at a glance
      const s = contentSlide(pres, type, "The Enterprise AI Market at a Glance");
      note(s, "No assessment shortlist yet — this summary covers the tracked market. Vendors are scored WITHIN their categories; composite cross-category rankings are not used.", 1.32);
      statCards(s, 1.85, [
        { label: "Vendors tracked", value: String(m?.totalVendors ?? "—"), tone: "blue" },
        { label: "Market categories", value: String(m?.totalCategories ?? "—"), tone: "green" },
        { label: "Scoring model", value: "Per-category", sub: "confidence-rated", tone: "plain" },
      ]);
      s.addText("Run an assessment in Assess to generate a shortlist-specific defence pack.", { x: MARGIN, y: 3.5, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, margin: 0 });

      // 2. Top 5 takeaways
      if (takeaways.length > 0) {
        const s2 = contentSlide(pres, type, "Top 5 Takeaways");
        takeaways.forEach((t, i) => {
          const y = 1.4 + i * 0.78;
          s2.addShape("ellipse", { x: MARGIN, y: y + 0.04, w: 0.42, h: 0.42, fill: { color: "F0FDF8" }, line: { color: EMERALD, width: 1 } });
          s2.addText(String(i + 1), { x: MARGIN, y: y + 0.04, w: 0.42, h: 0.42, fontFace: FONT, fontSize: 13, bold: true, color: EMERALD_DARK, align: "center", valign: "middle", margin: 0 });
          s2.addText(t.title, { x: MARGIN + 0.62, y, w: CONTENT_W - 0.62, h: 0.26, fontFace: FONT, fontSize: 11.5, bold: true, color: INK, margin: 0 });
          s2.addText(t.body, { x: MARGIN + 0.62, y: y + 0.25, w: CONTENT_W - 0.62, h: 0.5, fontFace: FONT, fontSize: 8.5, color: MUTED, margin: 0 });
        });
      }

      // 3. Category leaders — top 3 WITHIN each category, never across
      const leaders = m?.categoryLeaders ?? [];
      if (leaders.length > 0) {
        const s3 = contentSlide(pres, type, "Category Leaders — Top 3 Within Each Category");
        note(s3, "Leadership is category-specific. Comparing a chip maker against a model lab on one scale would mislead — so AnalystGenius doesn't.", 1.32);
        const rows: TableRow[] = [headerRow(["Category", "1st", "2nd", "3rd"])];
        leaders.forEach((c, i) => rows.push([
          bodyCell(c.category, { bold: true, ...altFill(i) }),
          bodyCell(c.vendors[0] ? `${c.vendors[0].name} (${c.vendors[0].score})` : "—", { bold: true, color: EMERALD_DARK, ...altFill(i) }),
          bodyCell(c.vendors[1] ? `${c.vendors[1].name} (${c.vendors[1].score})` : "—", altFill(i)),
          bodyCell(c.vendors[2] ? `${c.vendors[2].name} (${c.vendors[2].score})` : "—", { color: MUTED, ...altFill(i) }),
        ]));
        addBrandTable(s3, 1.75, rows, [3.0, 2.0, 2.0, CONTENT_W - 7.0]);
      }

      // 4. Reputation
      slideReputation(pres, type, p, REPUTATION_NOTE);
    } else {
      slideDecision(pres, type, p);
      slideBusinessCase(pres, type, p, "Business Case");
      slideVendors(pres, type, p);
      slideRisks(pres, type, p, { title: "Key Risks", filterFn: (r) => r.severity === "Critical" || r.severity === "High" });
      slideReputation(pres, type, p, REPUTATION_NOTE);
      slideProvenance(pres, type, p);
    }
  } else if (type === "Board Pack") {
    slideDecision(pres, type, p);
    slideBusinessCase(pres, type, p, "Why Invest?");
    slideWhyNow(pres, type);
    slideVendors(pres, type, p);
    slideCompetitors(pres, type, p);
    slideUptake(pres, type, p);
    slideReputation(pres, type, p, REPUTATION_NOTE);
    slidePricing(pres, type, p);
    slideRisks(pres, type, p);
    slideControls(pres, type, p, "Controls & Governance");
    slideAssumptions(pres, type, p);
    slideKpis(pres, type, p);
    slideProvenance(pres, type, p);
  } else if (type === "Procurement Pack") {
    slideDecision(pres, type, p);
    slideVendors(pres, type, p);
    slidePricing(pres, type, p);
    slideReputation(pres, type, p, REPUTATION_NOTE_PROCUREMENT);
    slideRisks(pres, type, p, { title: "Vendor Risk Considerations", filterFn: (r) => r.category === "Vendor Risk" || r.category === "Concentration" || r.category === "Cost" });
    slideUptake(pres, type, p);
    slideControls(pres, type, p, "Contract Controls");
    slideKpis(pres, type, p);
    slideProvenance(pres, type, p);
  } else {
    // Risk Review
    slideDecision(pres, type, p);
    const critical = p.risks.filter((r) => r.severity === "Critical").length;
    const high = p.risks.filter((r) => r.severity === "High").length;
    const medium = p.risks.filter((r) => r.severity === "Medium").length;
    const s = contentSlide(pres, type, "Risk Summary");
    statCards(s, 1.6, [
      { label: "Critical", value: String(critical), tone: "rose" },
      { label: "High", value: String(high), tone: "rose" },
      { label: "Medium", value: String(medium), tone: "amber" },
      { label: "Total", value: String(p.risks.length), tone: "plain" },
    ]);
    slideRisks(pres, type, p, { title: "Full Risk Register" });
    slideControls(pres, type, p, "Mitigation Controls");
    slideAssumptions(pres, type, p, true);
    slideProvenance(pres, type, p);
  }

  closingSlide(pres, headshotDataUri);

  return (await pres.write({ outputType: "blob" })) as Blob;
}
