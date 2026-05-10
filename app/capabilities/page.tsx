import { PageFrame } from "@/components/app-shell";
import { EvidenceBadge, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import { listCapabilities, listIntelligenceVendors, listVendorCapabilities } from "@/lib/intelligence/repository";

export const dynamic = "force-dynamic";

export default async function CapabilitiesPage() {
  const [capabilities, vendorCapabilities, vendors] = await Promise.all([
    listCapabilities(),
    listVendorCapabilities(),
    listIntelligenceVendors(),
  ]);
  const vendorsToShow = vendors.sort((a, b) => b.overallScore - a.overallScore).slice(0, 10);
  const byKey = new Map(vendorCapabilities.map((item) => [`${item.vendorId}_${item.capabilityId}`, item]));

  return (
    <PageFrame title="Capability tracker" kicker="Current capability and recent change" description="Track maturity across models, assistants, RAG, agents, governance, security, integrations, cost controls, deployment, and portability.">
      <Panel title="Capability matrix">
        <div className="mb-4">
          <OwnershipLegend />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#dfe4da] text-xs uppercase tracking-wide text-[#697362]">
                <th className="w-44 py-3 pr-4">Vendor</th>
                {capabilities.map((capability) => <th key={capability.id} className="min-w-32 px-3 py-3">{capability.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {vendorsToShow.map((vendor) => (
                <tr key={vendor.id} className="border-b border-[#edf0ea]">
                  <td className="py-3 pr-4 font-medium">
                    <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
                  </td>
                  {capabilities.map((capability) => {
                    const row = byKey.get(`${vendor.id}_${capability.id}`);
                    return (
                      <td key={capability.id} className="px-3 py-3 align-top">
                        {row ? (
                          <div className="space-y-2">
                            <ScoreBar value={row.maturityScore} />
                            <EvidenceBadge grade={row.evidenceGrade} />
                          </div>
                        ) : <span className="text-xs text-[#9aa193]">No signal</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageFrame>
  );
}
