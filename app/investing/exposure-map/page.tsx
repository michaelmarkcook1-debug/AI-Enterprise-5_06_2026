import { PageFrame } from "@/components/app-shell";
import { getInvestmentProvider, listIndirectExposureScores } from "@/lib/investing/intelligence";
import { WarningStrip } from "../investing-ui";
import ExposureMapHero, { type ExposureEdge } from "@/components/dashboard/ExposureMapHero";

export const dynamic = "force-dynamic";

export default function ExposureMapPage() {
  const edges: ExposureEdge[] = listIndirectExposureScores().map((e) => ({
    privateProviderId: e.privateProviderId,
    privateProviderName: getInvestmentProvider(e.privateProviderId)?.name ?? e.privateProviderId,
    publicTicker: e.publicTicker,
    exposureType: e.exposureType,
    exposureStrength: e.exposureStrength,
    revenueLinkage: e.revenueLinkage,
    confidence: e.confidence,
    dilutionPenalty: e.dilutionPenalty,
    indirectExposureScore: e.indirectExposureScore ?? 0,
  }));

  return (
    <PageFrame
      title="Indirect exposure map"
      kicker="Public to private linkage"
      description="How public companies provide indirect exposure to private AI providers. Hover or click a logo to highlight its dependencies. Edge thickness ∝ strength × revenue linkage; opacity ∝ confidence."
    >
      <WarningStrip />
      <ExposureMapHero edges={edges} />
    </PageFrame>
  );
}
