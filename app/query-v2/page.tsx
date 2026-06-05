import type { Metadata } from "next";
import { PageFrame } from "@/components/app-shell";
import { OwnershipLegend } from "@/components/ownership-indicator";
import QueryV2Client from "./QueryV2Client";

export const metadata: Metadata = {
  title: "Query V2 — AI Enterprise",
  description: "Role-aware enterprise AI market intelligence by platform, model, application, infrastructure, hardware, investor, and ecosystem layer.",
};

export const dynamic = "force-dynamic";

export default function QueryV2Page() {
  return (
    <PageFrame
      title="Query"
      kicker="Explore who matters in enterprise AI — by role, layer and momentum"
      description="AI Enterprise separates vendors by what they actually do: platforms, models, applications, infrastructure, investors, hardware and ecosystem dependencies."
    >
      <div className="mb-5">
        <OwnershipLegend />
      </div>
      <QueryV2Client />
    </PageFrame>
  );
}
