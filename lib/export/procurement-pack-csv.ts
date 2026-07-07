// Procurement-pack CSV — one row per (vendor × domain). PURE string builder,
// no I/O. An insufficient-evidence domain prints the literal string
// "insufficient evidence" in every evidence-derived column — never a blank
// cell, never a zero standing in for "unscored" (0 would misread as a real
// score of 0/5, which is not what "insufficient evidence" means).

import type { ProcurementPackData } from "./procurement-pack";

const COLUMNS = [
  "vendor",
  "domain",
  "score",
  "band",
  "weight_pct",
  "evidence_count",
  "top_source",
  "evidence_grade",
  "confidence",
  "low_confidence",
  "insufficient_evidence",
] as const;

const INSUFFICIENT = "insufficient evidence";

function csvField(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: (string | number | boolean)[]): string {
  return values.map(csvField).join(",");
}

/** Deterministic — same ProcurementPackData in, byte-identical CSV out. */
export function procurementPackToCsv(pack: ProcurementPackData): string {
  const lines: string[] = [csvRow([...COLUMNS])];

  for (const v of pack.vendors) {
    for (const d of v.domains) {
      if (d.state === "insufficient_evidence") {
        lines.push(
          csvRow([
            v.vendorName,
            d.label,
            INSUFFICIENT,
            INSUFFICIENT,
            d.weightPct,
            0,
            INSUFFICIENT,
            INSUFFICIENT,
            INSUFFICIENT,
            false,
            true,
          ]),
        );
        continue;
      }
      lines.push(
        csvRow([
          v.vendorName,
          d.label,
          d.score!.toFixed(1),
          d.bandText!,
          d.weightPct,
          d.evidenceCount,
          d.topSource ?? INSUFFICIENT,
          d.bestGrade!,
          d.confidence!,
          d.lowConfidence,
          false,
        ]),
      );
    }
  }

  return lines.join("\r\n") + "\r\n";
}
