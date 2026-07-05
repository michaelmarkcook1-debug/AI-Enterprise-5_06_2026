import { describe, it, expect } from "vitest";
import { isAdvertorialNews, isNonNewsFragment, isSuppressedNewsItem, isDataVendorSource } from "./source-quality";

describe("source-quality: advertorial detector", () => {
  it("drops retail/affiliate deal advertorials (title or /deals/ path)", () => {
    expect(isAdvertorialNews("This E Ink tablet replaced my iPad and Kindle - and it's 30% off on Amazon right now", "https://www.zdnet.com/article/tcl-nxtpaper-11-plus-july-4-deal/")).toBe(true);
    expect(isAdvertorialNews("Best Prime Day laptop deals", "https://example.com/deals/prime-day")).toBe(true);
  });
  it("does NOT match real business/M&A/cloud 'deal' stories (the -deal URL regression)", () => {
    expect(isAdvertorialNews("Microsoft and Chevron Sign 20-Year Power Deal For Texas Data Center", "https://www.bloomberg.com/news/microsoft-chevron-power-deal")).toBe(false);
    expect(isAdvertorialNews("Perplexity signs $750M Azure cloud deal with Microsoft", "https://www.bloomberg.com/news/perplexity-azure-cloud-deal")).toBe(false);
    expect(isAdvertorialNews("Getty Images Soars 200% After OpenAI Deal", "https://www.bloomberg.com/news/getty-openai-deal")).toBe(false);
    expect(isAdvertorialNews("Anthropic cuts Claude API prices 30% for batch workloads", "https://techcrunch.com/x")).toBe(false);
  });
});

describe("source-quality: non-news doc/marketing FRAGMENT detector", () => {
  it("drops machine-junk titles on ANY host (pillar-update, snake_case key)", () => {
    expect(isNonNewsFragment({ title: "trust_center_existence update — anthropic", sourceUrl: "https://trust.anthropic.com/" })).toBe(true);
    expect(isNonNewsFragment({ title: "platform_depth_and_service_breadth update — google", sourceUrl: "https://techcrunch.com/x" })).toBe(true);
  });
  it("drops vendor-colon + ellipsis + sentence fragments on non-press hosts", () => {
    expect(isNonNewsFragment({ title: "Perplexity: Sonar API Pricing", sourceUrl: "https://docs.perplexity.ai/pricing" })).toBe(true);
    expect(isNonNewsFragment({ title: "Databricks: Ship agentic apps at scale.", sourceUrl: "https://www.databricks.com/product" })).toBe(true);
    expect(isNonNewsFragment({ title: "Harvey undergoes annual SOC 2 Type II and ISO 27001 audits to validate its controls.", sourceUrl: "https://www.harvey.ai/security" })).toBe(true);
    expect(isNonNewsFragment({ title: "AWS: AI model training for VFX can take weeks, creating bottlenecks...", sourceUrl: "https://aws.amazon.com/blogs/x" })).toBe(true);
  });
  it("KEEPS real headlines — press outlets, vendor newsrooms, and doc-host release notes", () => {
    // Press outlet — soft title tells never drop.
    expect(isNonNewsFragment({ title: "Anthropic raises $65B Series H at $965B valuation", sourceUrl: "https://techcrunch.com/x" })).toBe(false);
    // Vendor newsroom (path /news/).
    expect(isNonNewsFragment({ title: "OpenAI and NVIDIA Announce Strategic Partnership to Deploy 10 Gigawatts of NVIDIA Systems", sourceUrl: "https://nvidianews.nvidia.com/news/x" })).toBe(false);
    expect(isNonNewsFragment({ title: "OpenAI Closes $122 Billion Funding Round at $852 Billion Valuation", sourceUrl: "https://openai.com/news/funding" })).toBe(false);
    // Genuine release-note headlines that happen to live on doc subdomains (the
    // validation overturned a blanket subdomain ban that dropped these).
    expect(isNonNewsFragment({ title: "OpenAI GPT-5.4 Now Available as a Databricks-Hosted Model via Mosaic AI", sourceUrl: "https://docs.databricks.com/x" })).toBe(false);
    expect(isNonNewsFragment({ title: "GPT-5.3-Codex Launched as OpenAI's Most Capable Agentic Coding Model", sourceUrl: "https://help.openai.com/x" })).toBe(false);
  });
});

describe("source-quality: combined suppression gate", () => {
  it("suppresses data-vendor sources, advertorials and fragments together", () => {
    expect(isSuppressedNewsItem({ sourceName: "ZoomInfo", title: "Acme acquires Foo", sourceUrl: "https://x.com/y" })).toBe(true);
    expect(isSuppressedNewsItem({ sourceName: "ZDNet", title: "Gadget is 30% off on Amazon", sourceUrl: "https://zdnet.com/x" })).toBe(true);
    expect(isSuppressedNewsItem({ sourceName: "Databricks", title: "Databricks: Ship agentic apps at scale.", sourceUrl: "https://databricks.com/x" })).toBe(true);
    // Real news passes the gate.
    expect(isSuppressedNewsItem({ sourceName: "TechCrunch", title: "Anthropic raises $65B Series H", sourceUrl: "https://techcrunch.com/x" })).toBe(false);
  });
  it("isDataVendorSource still catches firmographic feeds", () => {
    expect(isDataVendorSource("PitchBook")).toBe(true);
    expect(isDataVendorSource("Business Wire")).toBe(false);
  });
});
