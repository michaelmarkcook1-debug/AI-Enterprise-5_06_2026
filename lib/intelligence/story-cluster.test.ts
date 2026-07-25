import { describe, it, expect } from "vitest";
import { clusterNewsStories, normaliseTitle, type ClusterableNews } from "./story-cluster";

const item = (o: Partial<ClusterableNews> & { id: string; title: string }): ClusterableNews => ({
  publishedAt: "2026-07-24T00:00:00.000Z",
  vendors: ["anthropic"],
  sourceName: "Source",
  sourceUrl: "https://example.org/a",
  ...o,
});

describe("normaliseTitle", () => {
  it("strips outlet tags and trailing publisher", () => {
    expect(normaliseTitle("[AINews] Claude Opus 5 ships")).toBe("claude opus 5 ships");
    expect(normaliseTitle("Google raises spending — Memeburn")).toBe("google raises spending");
  });
});

describe("clusterNewsStories — merges same-event coverage", () => {
  // The exact pair observed on the live feed: one launch, two outlets.
  it("clusters the Claude Opus 5 launch reported by two publishers", () => {
    const clusters = clusterNewsStories([
      item({
        id: "a",
        title: "[AINews] Claude Opus 5: Fable-level performance at Opus price (half Fable)",
        sourceName: "Latent.Space",
      }),
      item({
        id: "b",
        title: "Anthropic launches Claude Opus 5 model at half the price of Fable 5",
        sourceName: "Bloomberg",
      }),
    ]);

    expect(clusters).toHaveLength(1);
    // Untagged Bloomberg headline leads; the [AINews] one is the duplicate.
    expect(clusters[0].lead.id).toBe("b");
    expect(clusters[0].duplicates.map((d) => d.id)).toEqual(["a"]);
    // Both citations survive.
    expect(clusters[0].sources.map((s) => s.name).sort()).toEqual(["Bloomberg", "Latent.Space"]);
  });

  it("keeps every source URL — nothing is dropped by clustering", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Anthropic launches Claude Opus 5 model", sourceName: "X", sourceUrl: "https://x.test/1" }),
      item({ id: "b", title: "Anthropic launches Claude Opus 5 model today", sourceName: "Y", sourceUrl: "https://y.test/2" }),
    ]);
    expect(clusters).toHaveLength(1);
    const urls = clusters[0].sources.map((s) => s.url);
    expect(urls).toContain("https://x.test/1");
    expect(urls).toContain("https://y.test/2");
  });
});

describe("clusterNewsStories — does NOT merge different stories", () => {
  it("keeps two unrelated stories about the same vendor apart", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Anthropic launches Claude Opus 5 model at half the price" }),
      item({ id: "b", title: "Anthropic raises 30 billion at 400 billion valuation" }),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("keeps same-shaped headlines about different vendors apart", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Google raises 2026 AI capital spending to 205 billion", vendors: ["google"] }),
      item({ id: "b", title: "Microsoft raises 2026 AI capital spending to 205 billion", vendors: ["microsoft"] }),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("keeps the same story apart when it falls outside the date window", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Anthropic launches Claude Opus 5 model", publishedAt: "2026-07-01T00:00:00.000Z" }),
      item({ id: "b", title: "Anthropic launches Claude Opus 5 model", publishedAt: "2026-07-24T00:00:00.000Z" }),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("does not merge on generic verbs alone (needs 2 distinctive anchors)", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Anthropic launches new thing" }),
      item({ id: "b", title: "Anthropic launches other stuff" }),
    ]);
    expect(clusters).toHaveLength(2);
  });

  it("demands a stricter title match when a vendor tag is missing", () => {
    const clusters = clusterNewsStories([
      item({ id: "a", title: "Claude Opus 5 arrives with cheaper pricing", vendors: [] }),
      item({ id: "b", title: "Claude Opus 5 launches at half price for enterprise buyers today", vendors: [] }),
    ]);
    // Below the raised 0.62 bar for unconfirmed subjects → stays separate.
    expect(clusters).toHaveLength(2);
  });
});

describe("clusterNewsStories — ordering and stability", () => {
  it("preserves upstream ordering of leads", () => {
    const clusters = clusterNewsStories([
      item({ id: "first", title: "Google raises 2026 AI capital spending", vendors: ["google"] }),
      item({ id: "second", title: "Databricks plans Series M funding round", vendors: ["databricks"] }),
    ]);
    expect(clusters.map((c) => c.lead.id)).toEqual(["first", "second"]);
  });

  it("is deterministic for identical input", () => {
    const input = [
      item({ id: "a", title: "Anthropic launches Claude Opus 5 model", sourceName: "A" }),
      item({ id: "b", title: "Anthropic launches Claude Opus 5 model now", sourceName: "B" }),
    ];
    expect(JSON.stringify(clusterNewsStories(input))).toBe(JSON.stringify(clusterNewsStories(input)));
  });

  it("returns single-item clusters unchanged", () => {
    const clusters = clusterNewsStories([item({ id: "solo", title: "A one-off market development story" })]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].duplicates).toEqual([]);
    expect(clusters[0].sources).toHaveLength(1);
  });

  it("handles an empty feed", () => {
    expect(clusterNewsStories([])).toEqual([]);
  });
});
