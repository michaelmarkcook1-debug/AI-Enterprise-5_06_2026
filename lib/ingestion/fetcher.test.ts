import { describe, it, expect } from "vitest";
import { htmlToText } from "./fetcher";

describe("htmlToText", () => {
  it("strips scripts and styles", () => {
    const html = `<html><body><script>evil()</script><style>.x{}</style><p>Hello world</p></body></html>`;
    expect(htmlToText(html)).toBe("Hello world");
  });

  it("decodes common entities and collapses whitespace", () => {
    const html = `<p>Foo&nbsp;&amp;&nbsp;Bar    is    here</p><p>Next</p>`;
    const out = htmlToText(html);
    expect(out).toContain("Foo & Bar is here");
    expect(out).toContain("Next");
  });

  it("keeps text inside complex containers", () => {
    const html = `<div class="x"><h1>Trust centre</h1><ul><li>SOC 2 Type II</li><li>ISO 27001</li></ul></div>`;
    const out = htmlToText(html);
    expect(out).toMatch(/Trust centre/);
    expect(out).toMatch(/SOC 2 Type II/);
    expect(out).toMatch(/ISO 27001/);
  });
});
