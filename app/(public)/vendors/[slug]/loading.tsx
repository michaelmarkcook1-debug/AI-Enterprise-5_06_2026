import { Shimmer, Bar, Card, SkeletonRows } from "@/components/ui/Skeleton";

// Vendor profile placeholder — header, verdict card, then the 12-domain scorecard.
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10" role="status" aria-label="Loading vendor profile">
      <Shimmer>
        <div className="mb-8 space-y-3">
          <Bar className="h-9 w-64" />
          <Bar className="h-3 w-full max-w-lg" />
        </div>
        <Card className="mb-6 h-32" />
        <Bar className="mb-3 h-5 w-48" />
        <SkeletonRows n={6} h="h-14" />
      </Shimmer>
    </main>
  );
}
