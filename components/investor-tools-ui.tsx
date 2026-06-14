// Shared Investor Tools UI helpers — moved here from the deprecated
// `app/investing/investing-ui.tsx` during the /investing → /investor-tools
// consolidation. Pure presentational; no client state.

import { INVESTING_WARNING, PRIVATE_ACCESS_WARNING, INDIRECT_EXPOSURE_WARNING } from "@/lib/investing/intelligence";

export function WarningStrip() {
  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">Hypothetical scenario modelling — not financial advice.</p>
      <p>{INVESTING_WARNING}</p>
      <p className="mt-1">{PRIVATE_ACCESS_WARNING}</p>
      <p>{INDIRECT_EXPOSURE_WARNING}</p>
    </div>
  );
}

// Convert snake_case enum-ish strings into a presentable label.
// Example: "core_public_ai_platform" → "Core public ai platform"
export function label(value: string): string {
  if (!value) return "—";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
