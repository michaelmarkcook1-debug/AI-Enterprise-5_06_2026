// Reusable demo-status badge. Renders one of Live / Mixed / Seed fallback
// with the brand colour scheme. Hover title surfaces the per-module
// reason + live/seed signal counts so the audience can drill in.
//
// Source-of-truth label (never claims "verified" for seed):
//   live          → "Live"
//   mixed         → "Mixed"
//   seed_fallback → "Seed fallback"

import type { DemoModuleStatus } from "@/lib/demo/source-first";
import { DEMO_MODULE_STATUS_LABEL } from "@/lib/demo/source-first";

interface Props {
  status: DemoModuleStatus;
  /** Title attribute — surfaces breakdown on hover. */
  title?: string;
  /** Optional click-through href; if set, badge renders as a link. */
  href?: string;
  /** Visual size — defaults to "sm" for in-card placement. */
  size?: "xs" | "sm" | "md";
}

const STATUS_CLASS: Record<DemoModuleStatus, string> = {
  live: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
  mixed: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
  seed_fallback: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

const DOT_CLASS: Record<DemoModuleStatus, string> = {
  live: "bg-emerald-500",
  mixed: "bg-sky-500",
  seed_fallback: "bg-amber-500",
};

export default function DemoStatusBadge({ status, title, href, size = "sm" }: Props) {
  const label = DEMO_MODULE_STATUS_LABEL[status];
  const body = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${STATUS_CLASS[status]} ${SIZE_CLASS[size]}`}
      title={title}
      aria-label={`Demo status: ${label}${title ? ` — ${title}` : ""}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} aria-hidden />
      {label}
    </span>
  );
  if (!href) return body;
  return (
    <a href={href} className="no-underline">
      {body}
    </a>
  );
}
