// Shared evidence-grade chip — extracted from WeightedScorecard so both it
// and EvidenceTrail (Prompt 2) render grades identically, from one place.
export default function GradeChip({ grade }: { grade: string }) {
  const label = grade === "E5" || grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred";
  const cls =
    grade === "E5" || grade === "E4"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : grade === "E3"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-[#ece3cb] text-[#3f5068] dark:bg-[#143049] dark:text-[#a7bacd]";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{grade} {label}</span>;
}
