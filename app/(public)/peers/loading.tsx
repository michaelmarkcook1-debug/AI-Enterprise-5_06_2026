import { Shimmer, Bar, Card } from "@/components/ui/Skeleton";

// Peers placeholder — the aggregate usage overview, then the cohort explorer.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label="Loading peer benchmark">
      <Shimmer>
        <div className="mb-6 space-y-3">
          <Bar className="h-4 w-52" />
          <Bar className="h-10 w-3/4 max-w-2xl" />
          <Bar className="h-3 w-full max-w-xl" />
        </div>
        <Card className="mb-8 h-80" />
        <Bar className="mb-3 h-5 w-56" />
        <Card className="h-64" />
      </Shimmer>
    </main>
  );
}
