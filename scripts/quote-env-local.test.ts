import { describe, expect, it } from "vitest";
import { rewrite, isAlreadyQuoted } from "./quote-env-local";

describe("isAlreadyQuoted", () => {
  it.each([
    ['"x"', true],
    ["'x'", true],
    ['"hello world"', true],
    ["plain", false],
    ['"unbalanced', false],
    ["unbalanced'", false],
    ["", false],
    ['"', false], // single char
  ] as const)("%s → %s", (input, expected) => {
    expect(isAlreadyQuoted(input)).toBe(expected);
  });
});

describe("rewrite", () => {
  it("quotes a plain unquoted value", () => {
    const { rewritten, results } = rewrite("FOO=bar");
    expect(rewritten).toBe('FOO="bar"');
    expect(results[0].status).toBe("will_quote");
  });

  it("leaves an already-quoted value alone", () => {
    const { rewritten, results } = rewrite('FOO="bar"');
    expect(rewritten).toBe('FOO="bar"');
    expect(results[0].status).toBe("quoted_already");
  });

  it("preserves single-quoted values verbatim", () => {
    const { rewritten, results } = rewrite("FOO='bar baz'");
    expect(rewritten).toBe("FOO='bar baz'");
    expect(results[0].status).toBe("quoted_already");
  });

  it("preserves blank lines verbatim", () => {
    const { rewritten, results } = rewrite("\n\nFOO=bar\n");
    expect(results.filter((r) => r.status === "blank").length).toBe(3);
    expect(rewritten.split("\n")).toContain('FOO="bar"');
  });

  it("preserves comment lines verbatim", () => {
    const input = "# a comment\nFOO=bar";
    const { rewritten, results } = rewrite(input);
    expect(rewritten.startsWith("# a comment\n")).toBe(true);
    expect(results[0].status).toBe("comment");
  });

  it("quotes a value containing # without truncating", () => {
    // This is the canonical bug — Node --env-file treats # as inline
    // comment in unquoted values.
    const { rewritten } = rewrite("FOO=abc#def");
    expect(rewritten).toBe('FOO="abc#def"');
  });

  it("quotes a value with leading whitespace", () => {
    const { rewritten } = rewrite("FOO=   spacy");
    expect(rewritten).toBe('FOO="   spacy"');
  });

  it("escapes embedded double-quotes so the wrap is parseable", () => {
    const { rewritten } = rewrite('FOO=he said "hi"');
    expect(rewritten).toBe('FOO="he said \\"hi\\""');
  });

  it("escapes embedded backslashes before quoting", () => {
    const { rewritten } = rewrite("FOO=path\\with\\slash");
    expect(rewritten).toBe('FOO="path\\\\with\\\\slash"');
  });

  it("marks malformed lines (no =) as malformed and leaves them alone", () => {
    const input = "this is not env\nFOO=bar";
    const { rewritten, results } = rewrite(input);
    expect(results[0].status).toBe("malformed");
    expect(rewritten.split("\n")[0]).toBe("this is not env");
  });

  it("idempotent — running rewrite twice produces the same output", () => {
    const input = "FOO=bar\nBAZ=qux#with-hash\n# comment\nQUOTED=\"already\"";
    const once = rewrite(input).rewritten;
    const twice = rewrite(once).rewritten;
    expect(twice).toBe(once);
  });

  it("handles a realistic .env.local shape", () => {
    const input = [
      "# AI Enterprise local env",
      "",
      'DATABASE_URL="postgresql://user:pass@host/db?sslmode=verify-full"',
      "ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxx",
      "SEC_USER_AGENT=AI Enterprise me@example.com",
      "EIA_API_KEY=abc#def",
      "",
      "# generated",
      'ADMIN_API_TOKEN="385f"',
    ].join("\n");
    const { rewritten, results } = rewrite(input);
    const willQuote = results.filter((r) => r.status === "will_quote").map((r) => r.key);
    expect(willQuote).toEqual(["ANTHROPIC_API_KEY", "SEC_USER_AGENT", "EIA_API_KEY"]);
    expect(rewritten).toContain('ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxx"');
    expect(rewritten).toContain('SEC_USER_AGENT="AI Enterprise me@example.com"');
    expect(rewritten).toContain('EIA_API_KEY="abc#def"');
    // Already-quoted lines stay verbatim
    expect(rewritten).toContain('DATABASE_URL="postgresql://user:pass@host/db?sslmode=verify-full"');
    expect(rewritten).toContain('ADMIN_API_TOKEN="385f"');
  });
});
