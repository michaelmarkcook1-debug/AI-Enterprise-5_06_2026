import { describe, expect, it } from "vitest";
import {
  suggestLinkage,
  type LinkageProposalInput,
  type LinkageProductScope,
} from "./product-linkage";
import { canonicaliseVendorId } from "./product-linkage-runner";

const MSFT_SCOPES: LinkageProductScope[] = [
  { id: "msft_microsoft_365_copilot", vendorId: "msft", productName: "Microsoft 365 Copilot", productCategory: "enterprise_assistant" },
  { id: "msft_github_copilot", vendorId: "msft", productName: "GitHub Copilot", productCategory: "coding_agent" },
  { id: "msft_azure_ai", vendorId: "msft", productName: "Azure AI / Azure AI Foundry", productCategory: "cloud_ai_platform" },
  { id: "msft_copilot_studio", vendorId: "msft", productName: "Copilot Studio", productCategory: "agent_platform" },
  { id: "msft_microsoft_purview", vendorId: "msft", productName: "Microsoft Purview", productCategory: "agent_governance" },
];

function p(over: Partial<LinkageProposalInput> = {}): LinkageProposalInput {
  return {
    id: "prop_default",
    vendorId: "msft",
    domain: "model_reliability",
    subfactor: "documented_evals",
    excerpt: "Microsoft 365 Copilot achieved 97% accuracy on the internal benchmark.",
    ...over,
  };
}

describe("suggestLinkage", () => {
  it("exact name match returns confidence 0.95 + safeToApply when unique", () => {
    const r = suggestLinkage(p(), MSFT_SCOPES);
    expect(r.status).toBe("ok");
    expect(r.suggestions[0].productScopeId).toBe("msft_microsoft_365_copilot");
    expect(r.suggestions[0].confidence).toBe(0.95);
    expect(r.suggestions[0].safeToApply).toBe(true);
    expect(r.suggestions[0].reason).toMatch(/exact name match/);
  });

  it("normalised name match (punctuation differences) returns 0.90", () => {
    const r = suggestLinkage(
      p({ excerpt: "Azure AI Azure AI Foundry shipped a new feature." }),
      MSFT_SCOPES,
    );
    // The exact-substring matcher already handles plain punctuation,
    // but this confirms normalised path works on collapsed spaces.
    expect(r.suggestions[0].productScopeId).toBe("msft_azure_ai");
    expect(r.suggestions[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("token overlap path fires when name is paraphrased", () => {
    const r = suggestLinkage(
      p({ excerpt: "GitHub's Copilot product offers IDE assistance." }),
      MSFT_SCOPES,
    );
    expect(r.suggestions[0].productScopeId).toBe("msft_github_copilot");
    expect(r.suggestions[0].confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.suggestions[0].confidence).toBeLessThan(0.95);
  });

  it("subfactor / category alignment fires only when no name match", () => {
    const r = suggestLinkage(
      p({
        subfactor: "agent_governance",
        excerpt: "The product offers governance and lifecycle controls.",
      }),
      MSFT_SCOPES,
    );
    // Microsoft Purview matches via subfactor "agent_governance" ⇆ category "agent_governance"
    expect(r.suggestions.some((s) => s.productScopeId === "msft_microsoft_purview")).toBe(true);
  });

  it("returns multiple_competing when top two are within 0.10", () => {
    // Two products both produce 0.90+ via normalised name match → tie band
    const r = suggestLinkage(
      p({ excerpt: "Microsoft 365 Copilot and GitHub Copilot both shipped updates." }),
      MSFT_SCOPES,
    );
    expect(r.status).toBe("multiple_competing");
    expect(r.suggestions[0].safeToApply).toBe(false);
  });

  it("returns no_match when nothing fires", () => {
    const r = suggestLinkage(
      p({ excerpt: "An unrelated paragraph about quantum computing research." }),
      MSFT_SCOPES,
    );
    expect(r.status).toBe("no_match");
    expect(r.suggestions).toHaveLength(0);
  });

  it("returns no_vendor_products when vendor has no scopes", () => {
    const r = suggestLinkage(p(), []);
    expect(r.status).toBe("no_vendor_products");
    expect(r.suggestions).toHaveLength(0);
  });

  it("single-product vendor falls back to a low-confidence suggestion", () => {
    const single: LinkageProductScope[] = [
      { id: "tinyco_only_product", vendorId: "tinyco", productName: "Only Product", productCategory: "other" },
    ];
    const r = suggestLinkage(
      p({ vendorId: "tinyco", excerpt: "TinyCo had a great Q1." }),
      single,
    );
    expect(r.status).toBe("uncertain_top_match");
    expect(r.suggestions[0].confidence).toBe(0.40);
    expect(r.suggestions[0].safeToApply).toBe(false);
  });

  it("never sets safeToApply on an uncertain top match", () => {
    // Token overlap of 0.5 → no suggestion fires; subfactor alignment may
    const r = suggestLinkage(
      p({ subfactor: "uptime", excerpt: "The product runs in the cloud somewhere." }),
      MSFT_SCOPES,
    );
    for (const s of r.suggestions) expect(s.safeToApply).toBe(false);
  });

  it("REGRESSION — vendors using vendor_<id> prefix resolve via prefix-strip", () => {
    // These were the vendors landing in `no_vendor_products` before the
    // canonicaliser learned to strip the `vendor_` prefix as a fallback.
    expect(canonicaliseVendorId("vendor_cohere")).toBe("cohere");
    expect(canonicaliseVendorId("vendor_mistral")).toBe("mistral");
    expect(canonicaliseVendorId("vendor_glean")).toBe("glean");
    expect(canonicaliseVendorId("vendor_anthropic")).toBe("anthropic");
    expect(canonicaliseVendorId("vendor_openai")).toBe("openai");
    expect(canonicaliseVendorId("vendor_writer")).toBe("writer");
    expect(canonicaliseVendorId("vendor_ibm")).toBe("ibm");
    expect(canonicaliseVendorId("vendor_sap")).toBe("sap");
    expect(canonicaliseVendorId("vendor_databricks")).toBe("databricks");
  });

  it("REGRESSION — vendor_<id> aliases resolve to ticker-style ids", () => {
    // These vendors have registry ids that are stock tickers, not
    // suffix-matches — they need explicit alias entries.
    expect(canonicaliseVendorId("vendor_microsoft")).toBe("msft");
    expect(canonicaliseVendorId("vendor_google")).toBe("googl");
    expect(canonicaliseVendorId("vendor_alphabet")).toBe("googl");
    expect(canonicaliseVendorId("vendor_aws")).toBe("amzn");
    expect(canonicaliseVendorId("vendor_amazon")).toBe("amzn");
    expect(canonicaliseVendorId("vendor_servicenow")).toBe("now");
    expect(canonicaliseVendorId("vendor_salesforce")).toBe("crm");
    expect(canonicaliseVendorId("vendor_oracle")).toBe("orcl");
    expect(canonicaliseVendorId("vendor_snowflake")).toBe("snow");
    expect(canonicaliseVendorId("vendor_broadcom")).toBe("avgo");
  });

  it("REGRESSION — Glean security-page rows resolve to a product via URL-path strategy", () => {
    // Reproduces the actual production excerpts from
    // runlogs/product-linkage-batch-40.txt where every Glean row
    // landed in `no_match` because the excerpt described the
    // function (sensitive content protection, single-tenant deployment)
    // without naming a product.
    const GLEAN_SCOPES: LinkageProductScope[] = [
      { id: "glean_glean_assistant", vendorId: "glean", productName: "Glean Assistant", productCategory: "enterprise_assistant" },
      { id: "glean_glean_work_ai", vendorId: "glean", productName: "Glean Work AI", productCategory: "enterprise_assistant" },
      { id: "glean_glean_agents", vendorId: "glean", productName: "Glean Agents", productCategory: "agent_platform" },
      { id: "glean_glean_search", vendorId: "glean", productName: "Glean Search", productCategory: "enterprise_search" },
      { id: "glean_glean_protect", vendorId: "glean", productName: "Glean Protect", productCategory: "security_ai" },
      { id: "glean_glean_permissions", vendorId: "glean", productName: "Glean Permissions", productCategory: "governance_control" },
      { id: "glean_glean_sensitive_content_protection", vendorId: "glean", productName: "Glean Sensitive Content Protection", productCategory: "security_ai" },
    ];
    const r = suggestLinkage(
      {
        id: "p_glean_security",
        vendorId: "glean",
        domain: "data_security_privacy",
        subfactor: "sensitive_data_detection_dlp",
        excerpt: "Get sensitive content protection across all structured and unstructured data with customizable or one-click policies that detect credentials, payment data, medical information, and other sensitive data.",
        sourceUrl: "https://www.glean.com/security",
      },
      GLEAN_SCOPES,
    );
    // Should NOT be no_match anymore — URL path /security maps to
    // security_ai / governance_control categories.
    expect(r.status).not.toBe("no_match");
    expect(r.suggestions.length).toBeGreaterThan(0);
    // Should suggest at least one of: Glean Protect, Glean Permissions,
    // Glean Sensitive Content Protection.
    const suggestedIds = r.suggestions.map((s) => s.productScopeId);
    expect(
      suggestedIds.some((id) =>
        ["glean_glean_protect", "glean_glean_permissions", "glean_glean_sensitive_content_protection"].includes(id),
      ),
    ).toBe(true);
    // The "Sensitive Content Protection" entry has token overlap with
    // the excerpt — should rank highly.
    expect(r.suggestions[0].productScopeId).toBe("glean_glean_sensitive_content_protection");
  });

  it("URL-path strategy fires for /agents → agent_platform category", () => {
    const scopes: LinkageProductScope[] = [
      { id: "v_agents", vendorId: "v", productName: "Their Agents Suite", productCategory: "agent_platform" },
      { id: "v_unrelated", vendorId: "v", productName: "Their Search Tool", productCategory: "enterprise_search" },
    ];
    const r = suggestLinkage(
      {
        id: "p1",
        vendorId: "v",
        // Subfactor that does NOT share tokens with "agent_platform"
        // (otherwise the subfactor strategy fires first and we never
        // exercise the URL-path path).
        domain: "data_security_privacy",
        subfactor: "encryption",
        excerpt: "Generic excerpt with no product name.",
        sourceUrl: "https://example.com/agents/builder",
      },
      scopes,
    );
    expect(r.suggestions[0].productScopeId).toBe("v_agents");
    expect(r.suggestions[0].reason).toMatch(/source URL path/);
  });

  it("URL-path strategy does NOT fire when the path doesn't align with the category", () => {
    const scopes: LinkageProductScope[] = [
      { id: "v_search", vendorId: "v", productName: "Their Search", productCategory: "enterprise_search" },
      // ≥ 2 products so the single-product-vendor fallback doesn't fire.
      { id: "v_other", vendorId: "v", productName: "Their CRM Tool", productCategory: "crm_ai" },
    ];
    const r = suggestLinkage(
      {
        id: "p1",
        vendorId: "v",
        domain: "data_security_privacy",
        subfactor: "encryption_at_rest",
        excerpt: "No product name here.",
        sourceUrl: "https://example.com/security/encryption", // /security but products are search + CRM
      },
      scopes,
    );
    // Neither product aligns with /security; nothing else fires either.
    expect(r.status).toBe("no_match");
  });

  it("REGRESSION — non-prefixed ids pass through unchanged", () => {
    expect(canonicaliseVendorId("msft")).toBe("msft");
    expect(canonicaliseVendorId("anthropic")).toBe("anthropic");
    expect(canonicaliseVendorId("unknown_vendor")).toBe("unknown_vendor");
  });

  it("INVARIANT — nothing below 0.95 confidence is ever safeToApply", () => {
    const cases: LinkageProposalInput[] = [
      p({ excerpt: "GitHub's Copilot product offers IDE assistance." }),     // token overlap
      p({ excerpt: "An unrelated paragraph about quantum computing." }),     // no match
      p({ subfactor: "agent_governance", excerpt: "Governance shipped." }),  // subfactor align
    ];
    for (const c of cases) {
      const r = suggestLinkage(c, MSFT_SCOPES);
      for (const s of r.suggestions) {
        if (s.confidence < 0.95) expect(s.safeToApply).toBe(false);
      }
    }
  });
});
