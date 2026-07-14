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
      className="group rounded-xl border border-[#e6dcc3] bg-white dark:border-[#223a2e] dark:bg-[#081c30]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[#f6f8f3] dark:hover:bg-[#0d1f17] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-baseline gap-3">
          <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">{title}</span>
          {summary && (
            <span className="truncate font-mono text-xs text-[#5b6b7f] group-open:hidden dark:text-[#8fa5bb]">
              {summary}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {action}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden
            className="text-[#5b6b7f] transition-transform duration-200 group-open:rotate-180 dark:text-[#8fa5bb]"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-[#efe9d9] px-4 py-4 dark:border-[#223a2e]">{children}</div>
    </details>
  );
}
