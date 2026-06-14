import { describe, expect, it } from "vitest";
import { planSafeLinkages } from "./safe-linkage-apply";
import type { LinkageProductScope } from "./product-linkage";

const MSFT_SCOPES: LinkageProductScope[] = [
  { id: "msft_microsoft_365_copilot", vendorId: "msft", productName: "Microsoft 365 Copilot", productCategory: "enterprise_assistant" },
  { id: "msft_github_copilot", vendorId: "msft", productName: "GitHub Copilot", productCategory: "coding_agent" },
  { id: "msft_azure_ai", vendorId: "msft", productName: "Azure AI / Azure AI Foundry", productCategory: "cloud_ai_platform" },
];

const scopesForVendor = () => MSFT_SCOPES;

describe("planSafeLinkages — eligibility", () => {
  it("includes status=ok with safeToApply=true", () => {
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "msft",
        domain: "model_reliability",
        subfactor: "documented_evals",
        excerpt: "Microsoft 365 Copilot achieved 97% on the internal benchmark.",
      }],
      scopesForVendor,
    );
    expect(plan.eligible).toHaveLength(1);
    expect(plan.eligible[0].productScopeId).toBe("msft_microsoft_365_copilot");
    expect(plan.eligible[0].confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("INVARIANT — ok_uncertain is NEVER applied", () => {
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "msft",
        domain: "model_reliability",
        // Token overlap path → confidence < 0.95 → ok_uncertain
        subfactor: "evals",
        excerpt: "GitHub's Copilot product offers IDE assistance.",
      }],
      scopesForVendor,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skippedByStatus.ok_uncertain).toBeGreaterThanOrEqual(1);
  });

  it("INVARIANT — multiple_competing is NEVER applied", () => {
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "msft",
        domain: "model_reliability",
        subfactor: "evals",
        // Two products both exact-named → tie at 0.95
        excerpt: "Microsoft 365 Copilot and GitHub Copilot both shipped updates.",
      }],
      scopesForVendor,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skippedByStatus.multiple_competing).toBeGreaterThanOrEqual(1);
  });

  it("INVARIANT — no_match is NEVER applied", () => {
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "msft",
        domain: "data_security_privacy",
        subfactor: "encryption",
        excerpt: "An unrelated paragraph about quantum computing.",
      }],
      scopesForVendor,
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skippedByStatus.no_match).toBeGreaterThanOrEqual(1);
  });

  it("INVARIANT — no_vendor_products is NEVER applied", () => {
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "unknown",
        domain: "model_reliability",
        subfactor: "evals",
        excerpt: "Anything at all.",
      }],
      () => [],
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skippedByStatus.no_vendor_products).toBeGreaterThanOrEqual(1);
  });

  it("INVARIANT — uncertain_top_match is NEVER applied", () => {
    // Single-product vendor falls back to confidence 0.40 → uncertain
    const plan = planSafeLinkages(
      [{
        id: "p1",
        vendorId: "tinyco",
        domain: "model_reliability",
        subfactor: "evals",
        excerpt: "TinyCo had a great Q1.",
      }],
      () => [{ id: "tinyco_only", vendorId: "tinyco", productName: "Only Product", productCategory: "other" }],
    );
    expect(plan.eligible).toHaveLength(0);
    expect(plan.skippedByStatus.uncertain_top_match).toBeGreaterThanOrEqual(1);
  });
});

describe("planSafeLinkages — mixed batch", () => {
  it("counts correctly across an ok / ok_uncertain / multiple_competing / no_match batch", () => {
    const plan = planSafeLinkages(
      [
        // ok
        { id: "a", vendorId: "msft", domain: "model_reliability", subfactor: "documented_evals",
          excerpt: "Microsoft 365 Copilot achieved 97% on the internal benchmark." },
        // ok_uncertain — token overlap path
        { id: "b", vendorId: "msft", domain: "model_reliability", subfactor: "evals",
          excerpt: "GitHub's Copilot product offers IDE assistance." },
        // multiple_competing — two exact names
        { id: "c", vendorId: "msft", domain: "model_reliability", subfactor: "evals",
          excerpt: "Microsoft 365 Copilot and GitHub Copilot both shipped updates." },
        // no_match
        { id: "d", vendorId: "msft", domain: "data_security_privacy", subfactor: "encryption",
          excerpt: "Quantum computing research note." },
      ],
      scopesForVendor,
    );
    expect(plan.eligible).toHaveLength(1);
    expect(plan.eligible[0].proposalId).toBe("a");
    expect(plan.skipped).toHaveLength(3);
  });
});

describe("planSafeLinkages — audit payload shape", () => {
  it("each eligible entry has all required audit fields", () => {
    const plan = planSafeLinkages(
      [{ id: "p1", vendorId: "msft", domain: "model_reliability", subfactor: "documented_evals",
         excerpt: "Microsoft 365 Copilot achieved 97% accuracy." }],
      scopesForVendor,
    );
    const e = plan.eligible[0];
    expect(e.proposalId).toBe("p1");
    expect(e.vendorId).toBe("msft");
    expect(e.productScopeId).toBeDefined();
    expect(e.productName).toBeDefined();
    expect(e.confidence).toBeGreaterThanOrEqual(0.95);
    expect(e.reason).toBeDefined();
    expect(e.reason).toMatch(/exact name match|name match/);
  });
});
