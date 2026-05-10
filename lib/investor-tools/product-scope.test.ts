import { describe, expect, it } from "vitest";
import { INVESTMENT_PROVIDERS } from "../investing/seed";
import { listProductScopes, productScopesForVendor } from "./product-scope";

describe("ProductScope registry", () => {
  it("has at least one ProductScope record for every non-cash investment provider", () => {
    const missing = INVESTMENT_PROVIDERS
      .filter((provider) => provider.id !== "cash")
      .filter((provider) => productScopesForVendor(provider.id).length === 0)
      .map((provider) => provider.id);

    expect(missing).toEqual([]);
  });

  it("labels every product with evidence status, uncertainty, and module coverage", () => {
    const products = listProductScopes();

    expect(products.length).toBeGreaterThan(20);
    expect(products.every((product) => product.evidenceStatus)).toBe(true);
    expect(products.every((product) => product.uncertaintyNote.length > 0)).toBe(true);
    expect(products.every((product) => product.moduleCoverage.length > 0)).toBe(true);
    expect(products.every((product) => product.sourceIds.length > 0)).toBe(true);
  });

  it("does not count third-party hosted models as AWS-owned products", () => {
    const awsProducts = productScopesForVendor("amzn").map((product) => product.productName.toLowerCase());

    expect(awsProducts.some((name) => name.includes("claude"))).toBe(false);
    expect(awsProducts.some((name) => name.includes("anthropic"))).toBe(false);
  });
});
