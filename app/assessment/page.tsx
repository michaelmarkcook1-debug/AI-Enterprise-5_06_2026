import { INDUSTRIES } from "@/lib/industries";
import { USE_CASES, PRIMARY_OBJECTIVES, ECOSYSTEMS } from "@/lib/use-cases";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import AssessForm from "../assess/AssessForm";
import TierBar from "./TierBar";
import { PageFrame } from "@/components/app-shell";
import { parseTier } from "@/lib/assessment/tiers";

export const dynamic = "force-dynamic";

interface PageProps {
  // Next 16 typed-route hint: searchParams is async.
  searchParams: Promise<{ tier?: string }>;
}

export default async function AssessmentPage({ searchParams }: PageProps) {
  const { tier: tierParam } = await searchParams;
  const tier = parseTier(tierParam);
  const vendors = await listVendorProfiles();
  return (
    <PageFrame
      title="AI platform fit assessment"
      kicker="One module inside AI Enterprise"
      description="Source-cited, evidence-graded AI vendor fit. Pick a depth tier — Quick for fast triage, Guided for decision-shaping detail, Advanced for procurement-grade output."
    >
      <TierBar current={tier} />
      <AssessForm
        tier={tier}
        industries={Object.values(INDUSTRIES).map((i) => ({ id: i.id, name: i.name }))}
        useCases={USE_CASES.map((u) => ({ id: u.id, label: u.label }))}
        objectives={PRIMARY_OBJECTIVES}
        ecosystems={ECOSYSTEMS}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, ownershipType: v.ownership }))}
      />
    </PageFrame>
  );
}
