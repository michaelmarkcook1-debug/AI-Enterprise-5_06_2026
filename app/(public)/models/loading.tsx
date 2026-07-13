import { Shimmer, Card, SkeletonHeader } from "@/components/ui/Skeleton";

// Models placeholder — face-off card, the value scatter, stat tiles, then the table.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label="Loading model inventory">
      <Shimmer>
        <SkeletonHeader />
        <Card className="mb-8 h-52" />
        <Card className="mb-8 h-[400px]" />
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-20" />
          ))}
        </div>
        <Card className="h-64" />
      </Shimmer>
    </main>
  );
}
