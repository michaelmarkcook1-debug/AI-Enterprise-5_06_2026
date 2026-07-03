// Accredited-certification grade floor — a rubric-calibration correction.
// ─────────────────────────────────────────────────────────────────────────────
// The 2026-07 ranking audit found the LLM classifier graded certification
// evidence by its SURFACE ("it's a web page" → E2 public documentation) instead
// of its SOURCE TYPE. But the rubric's own scale (domain-rubric.ts) defines
// E5 = "independent audit / verified benchmark" — and an ISO 27001 / SOC 2
// Type II / ISO 42001 / FedRAMP / CSA-STAR certification IS, by definition, an
// accredited independent third-party audit. Grading it E2 is a mis-measurement,
// not a judgment call.
//
// This module floors the grade of evidence whose source is a genuine accredited-
// certification or independent-registry page. CONSERVATIVE: floor at E4, not E5 —
// a public cert/attestation page evidences that the audit occurred; the full
// audit REPORT (SOC 2 Type II) is typically NDA-gated, so E5 is reserved for an
// analyst who has obtained it. SYMMETRIC by construction: it matches the source,
// not the vendor — Google's SOC 2 page floors exactly like Anthropic's.
//
// This is a transparent, deterministic, reviewable allow-list — NOT a per-vendor
// override and NOT fabricated evidence: every affected row is a real, cited row
// that already exists; only its (mis-assigned) grade is corrected.

import type { EvidenceGrade } from "../types";

/** Grade an accredited-certification source cannot fall below. */
export const ACCREDITED_GRADE_FLOOR: EvidenceGrade = "E4";

const GRADE_RANK: Record<EvidenceGrade, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

// Tight allow-list: ONLY pages that genuinely document an accredited third-party
// certification / attestation, or an INDEPENDENT certification registry. Generic
// compliance overviews, marketing, docs, status, and pricing pages are excluded
// on purpose — they are not the certification itself. Matched as case-insensitive
// substrings against the full source URL.
const ACCREDITED_PATTERNS: readonly string[] = [
  // Official cloud/vendor certification & attestation pages (any host)
  "/security/compliance/iso-27001",
  "/security/compliance/iso-42001",
  "/security/compliance/iso/",
  "/security/compliance/soc-2",
  "/security/compliance/soc-3",
  "/security/compliance/soc/",
  "/security/compliance/fedramp",
  "iso-42001-certification", // e.g. anthropic.com/news/anthropic-achieves-iso-42001-certification-...
  "/fedramp-high",
  "-fedramp-high", // e.g. claude-in-amazon-bedrock-fedramp-high
  // Vendor Trust Centers that host the actual certificate artifacts
  "trust.anthropic.com",
  "://trust.", // generic Trust Center host prefix (Vanta/SafeBase-style)
  // Public "what certifications do we hold" attestation articles
  "articles/10015870", // Anthropic's certifications article (support./privacy.claude.com)
  // Independent third-party certification registries (not vendor-published)
  "cloudsecurityalliance.org/star/registry",
  "trustlists.org/company",
];

/** True when `sourceUrl` is an accredited-certification / independent-registry page. */
export function isAccreditedCertSource(sourceUrl: string | null | undefined): boolean {
  if (!sourceUrl) return false;
  const u = sourceUrl.toLowerCase();
  return ACCREDITED_PATTERNS.some((p) => u.includes(p));
}

/**
 * The corrected grade for a row: max(storedGrade, E4) when the source is an
 * accredited certification, else the stored grade unchanged. Never LOWERS a
 * grade (E5 stays E5). Pure.
 */
export function accreditedCorrectedGrade(grade: EvidenceGrade, sourceUrl: string | null | undefined): EvidenceGrade {
  if (!isAccreditedCertSource(sourceUrl)) return grade;
  return GRADE_RANK[grade] >= GRADE_RANK[ACCREDITED_GRADE_FLOOR] ? grade : ACCREDITED_GRADE_FLOOR;
}
