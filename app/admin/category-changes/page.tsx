import CategoryChangeReview from "./CategoryChangeReview";
import { listCategoryChangeProposals } from "@/lib/services/category-change";
import { hasDatabase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Admin queue for auto-detected vendor category / role-tag changes (Phase 2).
export default async function CategoryChangesPage() {
  const proposals = hasDatabase() ? await listCategoryChangeProposals("pending") : [];
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-[#13294b] dark:text-[#eef3f8]">
        Vendor category / role change proposals
      </h1>
      <p className="mt-1 text-sm leading-6 text-[#56657b] dark:text-[#a7bacd]">
        Auto-detected from ingested evidence: when a vendor gains a capability tied to a role it does not yet hold
        (e.g. a model lab shipping a vertical application), the engine raises a proposal here. Approving applies the
        role / category change to the vendor and moves it in the rankings, quadrant and &quot;who wins each layer&quot;.
        Changes are <strong>never auto-applied</strong> — review each one first.
      </p>
      <div className="mt-6">
        <CategoryChangeReview initial={proposals} />
      </div>
    </main>
  );
}
