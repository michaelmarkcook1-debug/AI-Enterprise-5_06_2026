import { describe, it, expect } from "vitest";
import { renderBoardPackHtml } from "./board-pack";
import { runAssessment } from "../engine";
import { getSeedVendors } from "../seed-vendors";
import type { AssessmentInput } from "../types";

const baseInput: AssessmentInput = {
  industry: "legal_professional",
  orgSize: "enterprise",
  primaryObjectives: ["productivity"],
  useCases: ["contract_review"],
  dataSensitivity: 4,
  riskTolerance: 2,
  autonomyAppetite: "human_in_loop",
  ecosystem: ["microsoft"],
  deploymentPreference: "saas",
  budgetSensitivity: 3,
  vendorIds: [],
};

describe("board pack export", () => {
  const result = runAssessment(baseInput, getSeedVendors());

  it("renders top-level summary HTML", () => {
    const html = renderBoardPackHtml(result);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Why this ranking");
    expect(html).toContain(result.runId);
    for (const v of result.ranking) {
      expect(html).toContain(v.vendorName);
    }
  });

  it("includes compliance crosswalk only when requested", () => {
    expect(renderBoardPackHtml(result)).not.toContain("Compliance crosswalk");
    expect(renderBoardPackHtml(result, { includeCompliance: true })).toContain("Compliance crosswalk");
  });

  it("escapes HTML in vendor names and rationale", () => {
    const tampered = {
      ...result,
      ranking: result.ranking.map((vr, i) =>
        i === 0 ? { ...vr, vendorName: "Hacker <script>alert(1)</script>" } : vr,
      ),
    };
    const html = renderBoardPackHtml(tampered);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
