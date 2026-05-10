import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/app-shell";
import { Confidence, EvidenceBadge, Panel, ScoreBar } from "@/components/intelligence-ui";
import { OwnershipBadge } from "@/components/ownership-indicator";
import {
  getIntelligenceVendor,
  listCapabilities,
  listMarketCategories,
  listMarketShareEstimates,
  listNewsItems,
  listVendorCapabilities,
  listVendorPillarScores,
} from "@/lib/intelligence/repository";
import { PILLARS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await getIntelligenceVendor(slug);
  if (!vendor) notFound();

  const [pillarScores, vendorCapabilities, capabilities, news, marketShares, categories] = await Promise.all([
    listVendorPillarScores(),
    listVendorCapabilities(),
    listCapabilities(),
    listNewsItems(),
    listMarketShareEstimates(),
    listMarketCategories(),
  ]);
  const scores = pillarScores.filter((score) => score.vendorId === vendor.id);
  const caps = vendorCapabilities.filter((capability) => capability.vendorId === vendor.id);
  const capById = new Map(capabilities.map((capability) => [capability.id, capability]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const vendorNews = news.filter((item) => item.vendors.includes(vendor.id));
  const vendorShares = marketShares.filter((share) => share.vendorId === vendor.id);

  return (
    <PageFrame title={vendor.name} kicker={vendor.category} description={vendor.description}>
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <Panel title="Overview">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-[#697362]">Ownership</div>
              <div className="mt-1"><OwnershipBadge ownershipType={vendor.ownershipType} compact={false} /></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[#697362]">Market position</div>
              <div className="mt-1 text-lg font-semibold">{vendor.marketPosition}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[#697362]">Overall score</div>
              <div className="mt-1 text-lg font-semibold">{vendor.overallScore}/100</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-[#697362]">Evidence</div>
              <div className="mt-1"><Confidence value={vendor.confidenceScore} /></div>
            </div>
          </div>
          <div className="mt-5 text-sm leading-6 text-[#4d574b]">{vendor.analystInterpretation}</div>
        </Panel>

        <Panel title="Strategy">
          <p className="text-sm leading-6 text-[#4d574b]">{vendor.strategy}</p>
          <div className="mt-4 text-xs uppercase tracking-wide text-[#697362]">Deployment</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {vendor.deploymentOptions.map((option) => <span key={option} className="rounded border border-[#d8ded0] px-2 py-1 text-xs">{option}</span>)}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Six-pillar intelligence">
          <div className="space-y-4">
            {PILLARS.map((pillar) => {
              const score = scores.find((item) => item.pillar === pillar.id);
              if (!score) return null;
              return (
                <div key={pillar.id}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{pillar.label}</span>
                    <EvidenceBadge grade={score.evidenceGrade} />
                  </div>
                  <ScoreBar value={score.capabilityScore} />
                  <div className="mt-1 text-xs text-[#66705f]">{score.strengths[0]}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Capability tracker">
          <div className="divide-y divide-[#edf0ea]">
            {caps.slice(0, 10).map((capability) => (
              <div key={capability.capabilityId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{capById.get(capability.capabilityId)?.name ?? capability.capabilityId}</div>
                  <EvidenceBadge grade={capability.evidenceGrade} />
                </div>
                <ScoreBar value={capability.maturityScore} />
                <div className="mt-1 text-xs leading-5 text-[#66705f]">{capability.notes}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Industry strength">
          <div className="space-y-3">
            {vendor.industryStrength.map((item) => (
              <div key={item.industry}>
                <ScoreBar label={item.industry} value={item.score} />
                <div className="mt-1 text-xs text-[#66705f]">{item.note}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Market share by category">
          <div className="space-y-3">
            {vendorShares.slice(0, 6).map((share) => (
              <div key={share.categoryId} className="flex items-center justify-between gap-3 text-sm">
                <span>{categoryById.get(share.categoryId)?.name ?? share.categoryId}</span>
                <span className="font-mono">{share.estimatedShare}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Risk profile">
          <div className="space-y-2">
            {vendor.riskProfile.map((risk) => (
              <div key={risk} className="rounded-md bg-[#faf8f1] px-3 py-2 text-xs leading-5 text-[#5f665a]">{risk}</div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="News timeline">
          <div className="divide-y divide-[#edf0ea]">
            {vendorNews.length === 0 && <div className="text-sm text-[#66705f]">No current seeded news for this vendor.</div>}
            {vendorNews.map((item) => (
              <Link key={item.id} href="/news" className="block py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="font-mono text-xs">{item.impactScore}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-[#66705f]">{item.whyItMatters}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}
