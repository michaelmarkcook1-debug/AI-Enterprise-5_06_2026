import { PageFrame } from "@/components/app-shell";
import { WarningStrip } from "../investing-ui";
import ExposureMapHero from "@/components/dashboard/ExposureMapHero";

export const dynamic = "force-dynamic";

export default function ExposureMapPage() {
  return (
    <PageFrame
      title="Indirect exposure map"
      kicker="Public to private linkage"
      description="Hover a logo to highlight its dependencies. Click to pin (up to 3). Filter by relationship type or confidence. Every edge here is publicly source-backed — seed-confidence edges render dashed and require independent verification."
    >
      <WarningStrip />
      <ExposureMapHero />
    </PageFrame>
  );
}
