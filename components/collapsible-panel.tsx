// CollapsiblePanel — Panel's visual language on a native <details>.
// ───────────────────────────────────────────────────────────────────
// Part of the density redesign (10 Jun 2026): heavy below-fold sections
// default to collapsed, but a collapsed section is never a dead end —
// the `summary` prop carries one derived stat so the closed state still
// informs. Native details/summary keeps it zero-JS, keyboard-accessible
// and crawlable.

import type { ReactNode } from "react";

export default function CollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  action,
  children,
}: {
  title: string;
  /** One derived stat shown while collapsed, e.g. "12 vendors · avg 70". */
  summary?: string;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-[#dfe4da] bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[#f6f8f3] dark:hover:bg-zinc-900 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{title}</span>
          {summary && (
            <span className="truncate font-mono text-[11px] text-[#697362] group-open:hidden dark:text-zinc-500">
              {summary}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {action}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className="text-[#697362] transition-transform duration-200 group-open:rotate-180 dark:text-zinc-500"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-[#edf0ea] px-4 py-4 dark:border-zinc-800">{children}</div>
    </details>
  );
}
