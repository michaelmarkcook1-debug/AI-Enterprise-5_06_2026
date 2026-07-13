"use client";

// ClickToSource — turns any figure into a provable one.
// ──────────────────────────────────────────────────────────────────────
// Wraps a value with a quiet source affordance: hover/focus raises the
// house-style card (title · publisher · date · evidence grade), and clicking
// deep-links to the cited source in a new tab. This is the anti-fabrication
// primitive — every number on a decision surface can carry, and prove, its
// origin. When there is no real source, it renders the value plainly (no dead
// link, no false affordance) — honest absence.

import { useState } from "react";
import GradeChip from "../assessment/GradeChip";

export interface SourceRef {
  title?: string;
  publisher?: string;
  /** Human date string, e.g. "2026-07-13" or "as of 2026-07". */
  date?: string;
  /** Evidence grade, e.g. "E4" — rendered via the shared GradeChip. */
  grade?: string;
}

export interface ClickToSourceProps {
  /** The figure/value to annotate. */
  children: React.ReactNode;
  /** The cited source URL. Omit → render children plainly (honest, no dead link). */
  href?: string;
  source?: SourceRef;
  /** Accessible name for the source link, e.g. "Enterprise-control score source". */
  label?: string;
  className?: string;
}

export default function ClickToSource({ children, href, source, label = "source", className = "" }: ClickToSourceProps) {
  const [open, setOpen] = useState(false);

  // No real source → no affordance. Under-claim rather than imply provenance.
  if (!href) return <span className={className}>{children}</span>;

  const hasCard = Boolean(source?.title || source?.publisher || source?.date || source?.grade);

  return (
    <span
      className={`relative inline-flex items-baseline gap-0.5 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded text-[#b08d2f] transition-colors hover:text-[#8a6d1f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b08d2f] dark:text-[#c9a84a] dark:hover:text-[#e8c95c]"
      >
        <sup className="font-mono text-[9px] leading-none">↗</sup>
      </a>

      {open && hasCard && (
        <span
          role="tooltip"
          className="absolute top-full left-0 z-30 mt-1.5 w-56 rounded-lg border border-[#e6dcc3] bg-white p-2.5 text-left shadow-lg dark:border-[#2a4a6b] dark:bg-[#0c2238]"
        >
          {source?.title && (
            <span className="block text-xs font-medium leading-snug text-[#13294b] dark:text-[#eef3f8]">
              {source.title}
            </span>
          )}
          <span className="mt-1 flex items-center gap-1.5">
            {source?.publisher && (
              <span className="text-xs text-[#5b6b7f] dark:text-[#a7bacd]">{source.publisher}</span>
            )}
            {source?.grade && <GradeChip grade={source.grade} />}
          </span>
          {source?.date && (
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-[#7e8a99] dark:text-[#8fa5bb]">
              {source.date}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
