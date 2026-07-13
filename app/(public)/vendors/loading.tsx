import { Shimmer, SkeletonHeader, SkeletonRows } from "@/components/ui/Skeleton";

// Instant structured placeholder while the force-dynamic vendor rankings render.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label="Loading vendor rankings">
      <Shimmer>
        <SkeletonHeader />
        <SkeletonRows n={8} h="h-20" />
      </Shimmer>
    </main>
  );
}
