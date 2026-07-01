// Independence-firewall guard (static).
// ──────────────────────────────────────
// Fails CI if a vendor SCORE field is written anywhere except the sanctioned
// set. This is the enforcement behind the brief's non-negotiable: "no
// commercial process can ever write a score." It scans the real source tree, so
// the day someone wires a paid/commercial code path into a score, this test
// goes red before it ships.
//
// What counts as a "score write": a Prisma write call on a score model
// (IntelligenceVendor / IntelligencePillarScore) whose payload references a
// score field (overallScore / confidenceScore / capabilityScore). Writes to
// OTHER fields of those models (e.g. roleTags) and writes to OTHER tables (e.g.
// VendorRankingSnapshot history) are intentionally not flagged.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();
const SCAN_DIRS = ["lib", "app/api"];
const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".next",
  "generated",
  "ranking-engine", // the .vercelignore'd nested artifact tree
]);

// Files allowed to write score fields. Keep this list SHORT and obvious — every
// entry is an evidence/rubric/seed path, NONE is commercial. A new entry here
// is a deliberate, reviewable decision; an *un-listed* writer fails the build.
const SANCTIONED = new Set<string>([
  "lib/scores/score-writer.ts", // the sanctioned chokepoint (rubric_derive / evidence_projection)
  "app/api/admin/seed-missing-vendors/route.ts", // init-only, admin-gated seed
  "lib/intelligence/load-universe.ts", // idempotent deterministic-seed universe loader
  "lib/system/elo-scores.ts", // Arena ELO (openlm.ai public benchmark) → model_quality pillar; a benchmark/rubric path, never commercial
]);

// Score models + the fields that make a write a "score write".
const SCORE_WRITE_RE =
  /\.(intelligenceVendor|intelligencePillarScore)\.(update|upsert|create|updateMany|createMany)\s*\(/g;
const SCORE_FIELD_RE =
  /overallScore|confidenceScore|capabilityScore|overall_score|confidence_score|capability_score/;
// Window (chars) after a write call in which we look for a score field.
const WINDOW = 600;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIR_SEGMENTS.has(entry)) continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function toRel(full: string): string {
  return relative(ROOT, full).split(sep).join("/");
}

interface ScoreWrite {
  file: string;
  index: number;
}

function findScoreWrites(): ScoreWrite[] {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  const hits: ScoreWrite[] = [];
  for (const full of files) {
    const rel = toRel(full);
    const src = readFileSync(full, "utf8");
    SCORE_WRITE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SCORE_WRITE_RE.exec(src)) !== null) {
      const window = src.slice(m.index, m.index + WINDOW);
      if (SCORE_FIELD_RE.test(window)) {
        hits.push({ file: rel, index: m.index });
      }
    }
  }
  return hits;
}

describe("independence firewall — score writes are sanctioned-only", () => {
  it("no module outside the sanctioned set writes a vendor score field", () => {
    const writes = findScoreWrites();
    const offenders = [...new Set(writes.map((w) => w.file))].filter((f) => !SANCTIONED.has(f));
    expect(
      offenders,
      `Unsanctioned score writes found in:\n${offenders.join("\n")}\n` +
        "If this is a legitimate evidence/rubric path, route it through " +
        "lib/scores/score-writer.ts. A COMMERCIAL path must never write a score.",
    ).toEqual([]);
  });

  it("no file that touches commercial data also writes a score (firewall is structural)", () => {
    const scoreFiles = new Set(findScoreWrites().map((w) => w.file));
    const offenders: string[] = [];
    // "Touches commercial data" = an actual Prisma accessor on the commercial
    // model (`.vendorCommercial.`) or a raw reference to its table — NOT a prose
    // mention in a comment (the chokepoint legitimately documents the firewall).
    const COMMERCIAL_USE_RE = /\.vendorCommercial\.|"vendor_commercial"|'vendor_commercial'/;
    for (const file of scoreFiles) {
      const src = readFileSync(join(ROOT, file), "utf8");
      if (COMMERCIAL_USE_RE.test(src)) offenders.push(file);
    }
    expect(
      offenders,
      `These files write a score AND use commercial data — the firewall ` +
        `forbids that overlap:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the sanctioned chokepoint actually exists and writes scores", () => {
    const writes = findScoreWrites();
    const chokepoint = writes.some((w) => w.file === "lib/scores/score-writer.ts");
    expect(chokepoint, "lib/scores/score-writer.ts should be the sanctioned score writer").toBe(true);
  });

  // Phase 3 Assessment domain scores are computed-at-read (deterministic rubric
  // over verified evidence), never persisted — so there must be no writer to
  // compromise. Pin the assessment modules as read-only + commercial-free; if a
  // future change persists domain scores, route it through score-writer.ts and
  // update this guard deliberately.
  it("assessment domain-score modules never write a score field or touch commercial data", () => {
    const files = [
      "lib/assessment/domain-rubric.ts",
      "lib/assessment/domain-scores.ts",
      "lib/assessment/domain-labels.ts",
      "lib/assessment/composite.ts",
      // Wave-3 Interrogate: the LLM context→weight lens and the pure session-lens
      // builder. A buyer's context is a personal lens — weights + prose only. These
      // must never write a canonical score or touch commercial data.
      "lib/assessment/session-lens.ts",
      "lib/agents/composite-lens.ts",
      // Wave-4 prep kit: the LLM question generator + the pure assembler. Both
      // read the scorecard and emit questions/templates — never a score or
      // commercial data.
      "lib/assessment/prep-kit.ts",
      "lib/agents/prep-kit.ts",
    ];
    const COMMERCIAL_USE_RE = /\.vendorCommercial\.|"vendor_commercial"|'vendor_commercial'/;
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      SCORE_WRITE_RE.lastIndex = 0;
      const writesScore = (() => {
        let m: RegExpExecArray | null;
        while ((m = SCORE_WRITE_RE.exec(src)) !== null) {
          if (SCORE_FIELD_RE.test(src.slice(m.index, m.index + WINDOW))) return true;
        }
        return false;
      })();
      expect(writesScore, `${f} must not write a stored score field`).toBe(false);
      expect(COMMERCIAL_USE_RE.test(src), `${f} must not read commercial data`).toBe(false);
    }
  });
});
