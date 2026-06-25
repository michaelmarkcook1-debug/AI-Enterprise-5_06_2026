import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("escapes raw HTML (XSS-safe)", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders headings starting at h2 (page owns h1)", () => {
    expect(renderMarkdown("# Title")).toContain("<h2>Title</h2>");
    expect(renderMarkdown("## Sub")).toContain("<h3>Sub</h3>");
  });

  it("renders bold, italic, and code", () => {
    expect(renderMarkdown("**b**")).toContain("<strong>b</strong>");
    expect(renderMarkdown("*i*")).toContain("<em>i</em>");
    expect(renderMarkdown("`c`")).toContain("<code>c</code>");
  });

  it("renders safe links but not javascript: URIs", () => {
    expect(renderMarkdown("[ok](https://example.com)")).toContain('href="https://example.com"');
    const bad = renderMarkdown("[x](javascript:alert(1))");
    expect(bad).not.toContain("href=");
    expect(bad).toContain("x");
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdown("- one\n- two")).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(renderMarkdown("1. a\n2. b")).toContain("<ol><li>a</li><li>b</li></ol>");
  });

  it("wraps prose in paragraphs", () => {
    expect(renderMarkdown("hello world")).toBe("<p>hello world</p>");
  });
});
