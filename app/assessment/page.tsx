import { INDUSTRIES } from "@/lib/industries";
import { USE_CASES, PRIMARY_OBJECTIVES, ECOSYSTEMS } from "@/lib/use-cases";
import { listVendorProfiles } from "@/lib/repositories/vendor-profiles";
import AssessForm from "../assess/AssessForm";
import { PageFrame } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const vendors = await listVendorProfiles();
  return (
    <PageFrame
      title="AI platform fit assessment"
      kicker="One module inside AI Enterpise"
      description="Complete the core fit assessment in under two minutes. The wider portal remains market intelligence first; this workflow is for contextual shortlisting and validation planning."
    >
      <AssessForm
        industries={Object.values(INDUSTRIES).map((i) => ({ id: i.id, name: i.name }))}
        useCases={USE_CASES.map((u) => ({ id: u.id, label: u.label }))}
        objectives={PRIMARY_OBJECTIVES}
        ecosystems={ECOSYSTEMS}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, ownershipType: v.ownership }))}
      />
    </PageFrame>
  );
}
