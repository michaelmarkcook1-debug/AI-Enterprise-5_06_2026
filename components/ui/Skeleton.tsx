// Loading skeletons for force-dynamic pages — so navigation never lands on a
// blank screen while the server renders. The only motion is a subtle pulse,
// disabled under prefers-reduced-motion. Pure render, no client JS; aria-hidden
// because it carries no information (route-level loading.tsx supplies the role).

import type { ReactNode } from "react";

export function Shimmer({ children }: { children: ReactNode }) {
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-hidden>
      {children}
    </div>
  );
}

export function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-[#123d2c]/[0.08] dark:bg-white/[0.09] ${className}`} />;
}

export function Card({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-black/5 bg-[#123d2c]/[0.03] dark:border-white/10 dark:bg-white/[0.03] ${className}`} />
  );
}

/** Title + subtitle stand-in matching the page header rhythm. */
export function SkeletonHeader() {
  return (
    <div className="mb-8 space-y-3">
      <Bar className="h-8 w-2/3 max-w-md" />
      <Bar className="h-3 w-full max-w-xl" />
    </div>
  );
}

/** A stack of card rows — the shape of a ranked list / scorecard. */
export function SkeletonRows({ n = 6, h = "h-16" }: { n?: number; h?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i} className={h} />
      ))}
    </div>
  );
}
