import { describe, it, expect } from "vitest";
import { DOMAIN_TO_PILLAR, type DomainId } from "../types";
import { ASSESSMENT_DOMAINS, type DomainScore, type DomainCitation, type DomainBand, type DomainBandLabel } from "../assessment/domain-rubric";
import { DEFAULT_DOMAIN_WEIGHTS } from "../assessment/composite";
import type { VendorScorecard } from "../assessment/domain-scores";
import { buildProcurementPackData } from "./procurement-pack";
import { procurementPackToCsv } from "./procurement-pack-csv";

/** Minimal RFC-4180-aware row splitter for assertions — a naive .split(",")
 *  breaks on quoted fields that legitimately contain a comma (e.g. band text
 *  "Enterprise-ready, evidenced"), which the generator correctly quotes. */
function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function scored(domain: DomainId, citations: DomainCitation[] = []): DomainScore {
  return {
    domain,
    pillar: DOMAIN_TO_PILLAR[domain],
    state: "scored",
    score: 4.2,
    band: 4 as DomainBand,
    bandLabel: "enterprise_ready" as DomainBandLabel,
    confidence: 80,
    lowConfidence: false,
    bestGrade: "E4",
    evidenceCount: citations.length || 1,
    citations,
  };
}
function insufficient(domain: DomainId): DomainScore {
  return { domain, pillar: DOMAIN_TO_PILLAR[domain], state: "insufficient_evidence" };
}

function scorecard(domains: DomainScore[]): VendorScorecard {
  return {
    vendorId: "v1",
    domains,
    scoredCount: domains.filter((d) => d.state === "scored").length,
    insufficientCount: domains.filter((d) => d.state === "insufficient_evidence").length,
    hasAnyEvidence: true,
    totalEvidenceRows: 10,
    modelQuality: null,
    modelQualityCoding: null,
    devSentiment: null,
  };
}

const CIT = { sourceUrl: "https://example.com/src", evidenceGrade: "E4" as const, capturedAt: "2026-06-01T00:00:00.000Z" };

describe("procurementPackToCsv", () => {
  it("has one row per (vendor × domain) plus a header, with the exact required columns", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, [CIT]));
    const pack = buildProcurementPackData({
      kind: "category", title: "Test", categoryId: null, categoryName: null, asOfDate: "2026-07-01",
      generatedAt: "2026-07-07T00:00:00.000Z", weights: DEFAULT_DOMAIN_WEIGHTS, weightingLabel: "Framework default",
      vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    });
    const csv = procurementPackToCsv(pack);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + ASSESSMENT_DOMAINS.length); // header + 12 domain rows
    expect(lines[0]).toBe(
      "vendor,domain,score,band,weight_pct,evidence_count,top_source,evidence_grade,confidence,low_confidence,insufficient_evidence",
    );
  });

  it("a known-insufficient domain prints the literal string, never a blank cell", () => {
    const domains = [insufficient("strategic_value"), ...ASSESSMENT_DOMAINS.slice(1).map((d) => scored(d, [CIT]))];
    const pack = buildProcurementPackData({
      kind: "category", title: "Test", categoryId: null, categoryName: null, asOfDate: null,
      generatedAt: "2026-07-07T00:00:00.000Z", weights: DEFAULT_DOMAIN_WEIGHTS, weightingLabel: "Framework default",
      vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    });
    const csv = procurementPackToCsv(pack);
    const row = csv.split("\r\n").find((l) => l.includes("Strategic Value"))!;
    expect(row).toBeTruthy();
    const cells = parseCsvRow(row);
    // vendor,domain,score,band,weight_pct,evidence_count,top_source,evidence_grade,confidence,low_confidence,insufficient_evidence
    expect(cells[2]).toBe("insufficient evidence"); // score
    expect(cells[3]).toBe("insufficient evidence"); // band
    expect(cells[6]).toBe("insufficient evidence"); // top_source
    expect(cells[7]).toBe("insufficient evidence"); // evidence_grade
    expect(cells[8]).toBe("insufficient evidence"); // confidence
    expect(cells[10]).toBe("true"); // insufficient_evidence flag
    expect(row).not.toMatch(/,,/); // no empty (blank) cell anywhere
  });

  it("scored rows carry real numbers, not placeholders", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, [CIT]));
    const pack = buildProcurementPackData({
      kind: "category", title: "Test", categoryId: null, categoryName: null, asOfDate: null,
      generatedAt: "2026-07-07T00:00:00.000Z", weights: DEFAULT_DOMAIN_WEIGHTS, weightingLabel: "Framework default",
      vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    });
    const csv = procurementPackToCsv(pack);
    const row = csv.split("\r\n").find((l) => l.includes("Strategic Value"))!;
    const cells = parseCsvRow(row);
    expect(cells[2]).toBe("4.2");
    expect(cells[6]).toBe(CIT.sourceUrl);
    expect(cells[7]).toBe("E4");
    expect(cells[10]).toBe("false");
  });

  it("escapes fields containing commas or quotes", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, [CIT]));
    const pack = buildProcurementPackData({
      kind: "category", title: "Test", categoryId: null, categoryName: null, asOfDate: null,
      generatedAt: "2026-07-07T00:00:00.000Z", weights: DEFAULT_DOMAIN_WEIGHTS, weightingLabel: "Framework default",
      vendors: [{ vendorId: "v1", vendorName: 'Acme, "AI"', vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    });
    const csv = procurementPackToCsv(pack);
    expect(csv).toContain('"Acme, ""AI"""');
  });

  it("is deterministic — identical pack produces byte-identical CSV", () => {
    const domains = ASSESSMENT_DOMAINS.map((d) => scored(d, [CIT]));
    const pack = buildProcurementPackData({
      kind: "category", title: "Test", categoryId: null, categoryName: null, asOfDate: null,
      generatedAt: "2026-07-07T00:00:00.000Z", weights: DEFAULT_DOMAIN_WEIGHTS, weightingLabel: "Framework default",
      vendors: [{ vendorId: "v1", vendorName: "Acme AI", vendorSlug: "acme-ai", scorecard: scorecard(domains) }],
    });
    expect(procurementPackToCsv(pack)).toBe(procurementPackToCsv(pack));
  });
});
