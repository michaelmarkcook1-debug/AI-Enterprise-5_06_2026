import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Independence firewall for Phase 2 member data: a buyer's identity/watchlist can
// NEVER influence a vendor's score. This asserts that statically, alongside the
// existing lib/scores/score-writer.test.ts guard.
const ROOT = process.cwd();

describe("member firewall", () => {
  it("MemberWatchlist relates only to Subscriber — no link to any score/ranking table", () => {
    const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
    const block = schema.match(/model MemberWatchlist \{[\s\S]*?\n\}/)?.[0];
    expect(block).toBeTruthy();
    expect(block!).toMatch(/subscriber\s+Subscriber/);
    expect(block!).not.toMatch(/IntelligenceVendor|IntelligencePillarScore|VendorRankingSnapshot/);
    // It must not relate to the anonymous Watchlist either.
    expect(block!).not.toMatch(/\bWatchlist\b(?!s")/);
  });

  it("no member module writes a vendor score or imports the score writer", () => {
    const files = [
      "lib/member/auth.ts",
      "lib/member/watchlist.ts",
      "app/api/auth/request/route.ts",
      "app/api/auth/callback/route.ts",
      "app/api/auth/signout/route.ts",
      "app/api/member/watchlist/route.ts",
    ];
    const SCORE_WRITE = /\.(intelligenceVendor|intelligencePillarScore)\.(update|upsert|create|updateMany|createMany)/;
    const SCORE_FIELD = /overallScore|confidenceScore|capabilityScore/;
    const SCORE_WRITER_IMPORT = /scores\/score-writer/;
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      expect(src, `${f} must not write a score`).not.toMatch(SCORE_WRITE);
      expect(src, `${f} must not touch a score field`).not.toMatch(SCORE_FIELD);
      expect(src, `${f} must not import the score writer`).not.toMatch(SCORE_WRITER_IMPORT);
    }
  });
});
