import type { Metadata } from "next";
import { PageFrame } from "@/components/app-shell";
import { OwnershipLegend } from "@/components/ownership-indicator";
import { getEntities, computeWinningByLayer } from "@/lib/intelligence/entities-adapter";
import QueryV2Client from "./QueryV2Client";
import AnalystInsight from "@/components/analyst-insight";
import { queryInsight } from "@/lib/insights/tab-insights";

export const metadata: Metadata = {
  title: "Query V2 — AI Enterprise",
  description: "Role-aware enterprise AI market intelligence by platform, model, application, infrastructure, hardware, investor, and ecosystem layer.",
};

export const dynamic = "force-dynamic";

export default async function QueryV2Page() {
  // Single source of truth: the live database spine. Numbers are derived from
  // live ingestion (scores, momentum, pillars, market share, ranking snapshots).
  const entities = await getEntities();
  const winningByLayer = computeWinningByLayer(entities);

  // Analyst insight — derived from the same entities the tab renders
  const byRole = (role: string) => entities.filter((e) => e.primaryRole === role).length;
  const insightParagraph = queryInsight({
    totalEntities: entities.length,
    platforms: byRole("Platform Vendor"),
    models: byRole("Model Provider"),
    applications: byRole("Application Vendor"),
    avgLeadership: entities.length > 0 ? Math.round(entities.reduce((s, e) => s + e.leadershipScore, 0) / entities.length) : 0,
    evidenceConfidence: entities.length > 0 ? Math.round(entities.reduce((s, e) => s + e.confidence, 0) / entities.length) : 0,
    highRisk: entities.filter((e) => e.risk === "high").length,
  });

  return (
    <PageFrame
      title="Query"
      kicker="Explore who matters in enterprise AI — by role, layer and momentum"
      description="AI Enterprise separates vendors by what they actually do: platforms, models, applications, infrastructure, investors, hardware and ecosystem dependencies."
    >
      <AnalystInsight paragraph={insightParagraph} />
      <div className="mb-5">
        <OwnershipLegend />
      </div>
      <QueryV2Client entities={entities} winningByLayer={winningByLayer} />
    </PageFrame>
  );
}
