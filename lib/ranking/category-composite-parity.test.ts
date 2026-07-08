// Composite-unification parity test.
// ─────────────────────────────────────────────────────────────────────────────
// Before this fix, three surfaces disagreed on a vendor's rank order: the compare
// page read a raw, seed-derived IntelligenceVendor.overallScore (0-100); the
// vendor-profile "Standing in category" panel read CategoryRankedVendor.composite
// (0-100, LEGACY, explicitly non-ranking); category/homepage/vendor-list read
// CategoryRankedVendor.assessmentComposite (0-5, the actual ranking metric).
//
// The fix repoints every surface at getVendorCategoryStandings() /
// getCategoryComposites(), both backed by the SAME assessmentComposite.
// findVendorStandings() is the pure lookup getVendorCategoryStandings() delegates
// to — this test drives it directly with a fixture CategoryComposite[], proving
// it returns the *exact* CategoryRankedVendor entry (same object, not a copy),
// so no future surface can quietly re-derive or drift onto a shadow number.

import { describe, it, expect } from "vitest";
import { findVendorStandings } from "./category-composite";
import type { CategoryComposite, CategoryRankedVendor } from "./composite-types";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import type { DomainWeights } from "../assessment/composite";

const ZERO_WEIGHTS: DomainWeights = Object.fromEntries(
  ASSESSMENT_DOMAINS.map((d) => [d, 0]),
) as DomainWeights;

const RANKED: CategoryRankedVendor = {
  vendorId: "v1",
  vendorSlug: "acme",
  vendorName: "Acme AI",
  rank: 1,
  state: "ranked",
  composite: 68.4, // legacy 0-100 field — deliberately different from assessmentComposite below
  compositeConfidence: 82,
  evidenceCompleteness: "full",
  coverage: 1,
  domainScored: 12,
  domainTotal: 12,
  domainCoverage: 1,
  assessmentComposite: 3.39, // the unified 0-5 ranking metric
  tier: "Leaders",
  pillars: [],
  rankPillars: [],
  marketContext: { estimatedShare: null, confidence: null, source: null, isSeedSource: false },
};

const INCOMPLETE: CategoryRankedVendor = {
  ...RANKED,
  vendorId: "v2",
  vendorSlug: "held-co",
  vendorName: "Held Co",
  rank: null,
  state: "incomplete",
  composite: null,
  compositeConfidence: null,
  assessmentComposite: null,
  tier: null,
  excludedReason: "Enterprise Control has no E2+ evidence",
};

const FAKE_COMPOSITE: CategoryComposite = {
  category: { id: "frontier_model_api", name: "Frontier Model API", description: "" },
  ranked: [RANKED],
  incomplete: [INCOMPLETE],
  isLive: true,
  methodologyNote: "test fixture",
  resolvedDomainWeights: ZERO_WEIGHTS,
  lowDiscrimination: false,
  anomalies: [],
};

describe("composite unification parity", () => {
  it("returns the SAME CategoryRankedVendor object the composite array holds — identity, not a copy", () => {
    const standings = findVendorStandings([FAKE_COMPOSITE], "v1");
    expect(standings).toHaveLength(1);
    expect(standings[0].standing).toBe(RANKED);
  });

  it("exposes assessmentComposite (0-5, unified) as the ranking figure — distinct from the legacy 0-100 composite", () => {
    const [standing] = findVendorStandings([FAKE_COMPOSITE], "v1");
    expect(standing.standing.assessmentComposite).toBe(3.39);
    expect(standing.standing.composite).toBe(68.4); // legacy field still present, but no surface should render it as "the" composite
    expect(standing.standing.assessmentComposite).not.toBe(standing.standing.composite);
  });

  it("held (incomplete) vendors surface a null assessmentComposite, never a fabricated number", () => {
    const [standing] = findVendorStandings([FAKE_COMPOSITE], "v2");
    expect(standing.standing.state).toBe("incomplete");
    expect(standing.standing.assessmentComposite).toBeNull();
  });

  it("a vendor with no standing anywhere returns an empty list — honest absence, not a default", () => {
    expect(findVendorStandings([FAKE_COMPOSITE], "nonexistent-vendor")).toEqual([]);
  });

  it("carries categoryId/categoryName straight from the composite's own category — the compare page's shared-category matching keys off this", () => {
    const [standing] = findVendorStandings([FAKE_COMPOSITE], "v1");
    expect(standing.categoryId).toBe("frontier_model_api");
    expect(standing.categoryName).toBe("Frontier Model API");
    expect(standing.rankedCount).toBe(1);
  });
});
