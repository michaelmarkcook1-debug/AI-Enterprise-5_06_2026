import { describe, expect, it } from "vitest";
import { renderPackHtml, type BoardPackExporterProps, type ExportType } from "./BoardPackExporter";

const sampleProps: BoardPackExporterProps = {
  boardDefenceScore: 83,
  cioConfidenceScore: 76,
  recommendation: "Defensible",
  businessCase: {
    businessProblem: "Manual document review consumes 40% of analyst time.",
    intendedOutcomes: ["Reduce review cycle time", "Improve consistency"],
    productivityImpact: "To be quantified in pilot",
    costReductionPotential: "To be quantified in pilot",
    revenuePotential: "Indirect",
    cxExImpact: "Faster client turnaround",
  } as BoardPackExporterProps["businessCase"],
  vendors: [
    { name: "Anthropic", role: "Frontier model", score: 88, confidence: 80, topPillars: ["Reasoning", "Safety"], risks: ["Concentration"] },
    { name: "OpenAI", role: "Frontier model", score: 90, confidence: 78, topPillars: ["Ecosystem"], risks: [] },
  ],
  competitors: [],
  risks: [],
  mitigations: [],
  assumptions: [],
  kpis: [],
  scope: {
    industries: ["Financial services"],
    useCases: ["Document intelligence"],
    region: "Europe & UK",
    dataSensitivity: "4/5",
    costSensitivity: "3/5",
  },
  reputation: [
    { vendor: "Anthropic", customer: 92, developer: 88, employee: 85, uptimePct: 99.6 },
    { vendor: "OpenAI", customer: 90, developer: 86, employee: 80, uptimePct: 99.3 },
  ],
  uptake: [
    { vendor: "OpenAI", sharePct: 31.2, confidence: "Medium" },
    { vendor: "Anthropic", sharePct: 24.8, confidence: "Medium" },
  ],
  uptakeScopeLabel: "Financial services · Europe & UK",
  pricing: [
    { vendorName: "Anthropic", modelName: "Claude Opus 4.8", inputPerM: 5, outputPerM: 25 },
    { vendorName: "OpenAI", modelName: "GPT-5.2", inputPerM: 4, outputPerM: 20 },
  ],
};

const ALL_TYPES: ExportType[] = ["Executive Summary", "Board Pack", "Procurement Pack", "Risk Review"];

describe("board pack exports", () => {
  it("every pack states the decision scope and the shortlisted vendors", () => {
    for (const type of ALL_TYPES) {
      const html = renderPackHtml(type, sampleProps);
      expect(html).toContain("Decision Scope");
      expect(html).toContain("Anthropic");
      expect(html).toContain("OpenAI");
      expect(html).toContain("Financial services");
      expect(html).toContain("Europe &amp; UK");
    }
  });

  it("every pack carries the data-basis / provenance block (honesty contract)", () => {
    for (const type of ALL_TYPES) {
      const html = renderPackHtml(type, sampleProps);
      expect(html).toContain("Data Basis &amp; Provenance");
      expect(html).toContain("Illustrative templates");
    }
  });

  it("the Board Pack contains no unsourced productivity statistic", () => {
    const html = renderPackHtml("Board Pack", sampleProps);
    expect(html).not.toContain("15–30%");
    expect(html).not.toContain("15-30%");
    expect(html).toContain("Illustrative framing");
  });

  it("market penetration is labelled as modelled and scoped to the assessment", () => {
    const html = renderPackHtml("Board Pack", sampleProps);
    expect(html).toContain("Market Penetration");
    expect(html).toContain("Modelled estimates, not audited market share");
    expect(html).toContain("Financial services · Europe &amp; UK");
    expect(html).toContain("31.2%");
  });

  it("the Procurement Pack includes vendor-published pricing with unverified handling", () => {
    const html = renderPackHtml("Procurement Pack", {
      ...sampleProps,
      pricing: [...sampleProps.pricing, { vendorName: "Mistral AI", modelName: "Large 3", inputPerM: null, outputPerM: null }],
    });
    expect(html).toContain("Token Pricing");
    expect(html).toContain("$5.00");
    expect(html).toContain("Unverified");
  });

  it("HTML-escapes vendor-derived strings (no markup injection into board documents)", () => {
    const html = renderPackHtml("Executive Summary", {
      ...sampleProps,
      vendors: [{ name: "<script>alert(1)</script>", role: "x", score: 1, confidence: 1, topPillars: [], risks: [] }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders valid standalone HTML with the AG header and sign-off in every pack", () => {
    for (const type of ALL_TYPES) {
      const html = renderPackHtml(type, sampleProps);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("AnalystGenius");
      expect(html).toContain("Michael Cook");
      expect(html).toContain("</html>");
    }
  });
});
