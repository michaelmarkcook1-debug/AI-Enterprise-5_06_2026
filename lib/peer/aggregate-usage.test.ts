import { describe, it, expect } from "vitest";
import {
  getBaseUsageAggregate,
  getTopVendorsAcrossBase,
  getBaseUseCases,
  getUsageAsOf,
  getUsageCoverage,
} from "./aggregate-usage";
import { PEER_COMPANIES } from "./peer-adoption-data";

describe("peer aggregate-usage — honest, cited, no fabrication", () => {
  it("every vendor-usage count equals its named-company list length (never a synthesised number)", () => {
    for (const row of getBaseUsageAggregate()) {
      for (const cell of row.vendorUsage) {
        expect(cell.adopters).toBe(cell.companies.length);
        expect(cell.companies.length).toBeGreaterThan(0);
      }
    }
    for (const cell of getTopVendorsAcrossBase()) {
      expect(cell.adopters).toBe(cell.companies.length);
    }
  });

  it("only surfaces a vertical when it has a cited benchmark OR named exemplars", () => {
    for (const row of getBaseUsageAggregate()) {
      expect(Boolean(row.adoptionStat) || row.companyCount > 0).toBe(true);
    }
  });

  it("vendor usage is disclosed-only — never counts an inferred/undisclosed signal", () => {
    // Cross-check: the aggregate's adopter names must all come from a DISCLOSED
    // platform_integration signal on a real peer company.
    const disclosedNames = new Set(
      PEER_COMPANIES.filter((c) =>
        c.signals.some((s) => s.kind === "platform_integration" && s.status === "disclosed"),
      ).map((c) => c.name),
    );
    for (const row of getBaseUsageAggregate()) {
      for (const cell of row.vendorUsage) {
        for (const name of cell.companies) expect(disclosedNames.has(name)).toBe(true);
      }
    }
  });

  it("coverage reflects the real (thin) dataset — breadth from benchmarks, depth from disclosures", () => {
    const cov = getUsageCoverage();
    expect(cov.companies).toBe(PEER_COMPANIES.length);
    expect(cov.verticalsWithBenchmark).toBeGreaterThanOrEqual(10); // 12 BTOS verticals today
    expect(cov.verticalsWithVendorUsage).toBeGreaterThanOrEqual(2); // financial services + pharma
    expect(cov.verticalsWithVendorUsage).toBeLessThanOrEqual(cov.verticalsWithBenchmark + PEER_COMPANIES.length);
  });

  it("use-case options map to real verticals and the filter narrows the aggregate", () => {
    const useCases = getBaseUseCases();
    expect(useCases.length).toBeGreaterThan(0);
    for (const uc of useCases) expect(uc.verticals.length).toBeGreaterThan(0);
    const full = getBaseUsageAggregate();
    const filtered = getBaseUsageAggregate(useCases[0].label);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(full.length);
    for (const row of filtered) expect(useCases[0].verticals).toContain(row.verticalId);
  });

  it("has an honest as-of date", () => {
    expect(getUsageAsOf()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
