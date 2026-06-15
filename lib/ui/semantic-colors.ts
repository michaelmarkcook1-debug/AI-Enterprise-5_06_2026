// Shared semantic colour coding for critical information.
// ─────────────────────────────────────────────────────────
// The app previously had ~5 uncoordinated colour systems and several
// surfaces (news categories, evidence grades) that rendered everything in one
// muted colour. This module is the single source of truth for "colour = meaning"
// chips so critical info is highlighted consistently and is dark-mode safe.
//
// Convention (semantic, not decorative):
//   emerald = good / verified / positive      amber  = caution / watch / documented
//   rose    = risk / blocked / negative        sky    = informational / commercial
//   violet  = relationship / strategy          slate  = neutral / inferred / unknown
//
// Every token ships light + dark variants so it reads on both themes.

import type { EvidenceGrade } from "@/lib/types";
import type { NewsCategory } from "@/lib/intelligence/types";

/** Tailwind chip classes (bg + text + border) for a named semantic tone. */
const TONE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  amber:   "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  rose:    "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
  sky:     "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900",
  violet:  "bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900",
  indigo:  "bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
  teal:    "bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900",
  blue:    "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
  slate:   "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  orange:  "bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
};

export type SemanticTone = keyof typeof TONE;

/** Raw chip classes for a tone (use when you need the classes directly). */
export function toneClasses(tone: SemanticTone): string {
  return TONE[tone] ?? TONE.slate;
}

/* ─── News categories ─────────────────────────────────────────────────── */

const NEWS_CATEGORY_TONE: Record<NewsCategory, SemanticTone> = {
  "Risk event": "rose",
  "Regulation": "amber",
  "Pricing": "sky",
  "Partnership": "violet",
  "Product launch": "emerald",
  "Agentic AI": "teal",
  "Infrastructure": "slate",
  "Market movement": "blue",
  "Enterprise control": "indigo",
  "Strategy signal": "orange",
};

export function newsCategoryTone(category: NewsCategory): SemanticTone {
  return NEWS_CATEGORY_TONE[category] ?? "slate";
}
export function newsCategoryClasses(category: NewsCategory): string {
  return toneClasses(newsCategoryTone(category));
}

/* ─── Evidence grades (E0 inferred → E5 independently verified) ───────── */

const EVIDENCE_GRADE_TONE: Record<EvidenceGrade, SemanticTone> = {
  E5: "emerald", // independently verified
  E4: "emerald", // verified
  E3: "sky",     // tested
  E2: "amber",   // documented
  E1: "orange",  // weak / single-source
  E0: "slate",   // inferred / none
};

export function evidenceGradeTone(grade: EvidenceGrade): SemanticTone {
  return EVIDENCE_GRADE_TONE[grade] ?? "slate";
}
export function evidenceGradeClasses(grade: EvidenceGrade): string {
  return toneClasses(evidenceGradeTone(grade));
}

/* ─── Impact / severity scores (0–100) ────────────────────────────────── */

/** Market-impact / severity tone. rose ≥80, amber ≥65, else sky. */
export function impactTone(score: number): SemanticTone {
  if (score >= 80) return "rose";
  if (score >= 65) return "amber";
  return "sky";
}
export function impactClasses(score: number): string {
  return toneClasses(impactTone(score));
}
