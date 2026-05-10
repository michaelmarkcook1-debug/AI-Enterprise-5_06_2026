import ResultsView from "./ResultsView";

export default async function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <ResultsView runId={decodeURIComponent(runId)} />;
}
