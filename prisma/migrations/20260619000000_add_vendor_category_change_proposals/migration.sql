-- Admin-reviewed vendor category / role-tag change proposals (Phase 2).
-- Purely additive: a brand-new table reusing the existing "ProposalStatus" enum.
-- IF NOT EXISTS keeps it non-destructive and re-runnable; cannot touch existing data.

CREATE TABLE IF NOT EXISTS "vendor_category_change_proposals" (
    "proposal_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "current_category" TEXT NOT NULL,
    "proposed_category" TEXT,
    "current_role_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "proposed_role_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rationale" TEXT NOT NULL,
    "trigger_capability_id" TEXT,
    "trigger_maturity" DOUBLE PRECISION,
    "source_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_category_change_proposals_pkey" PRIMARY KEY ("proposal_id")
);

CREATE INDEX IF NOT EXISTS "vendor_category_change_proposals_status_created_at_idx" ON "vendor_category_change_proposals"("status", "created_at");
CREATE INDEX IF NOT EXISTS "vendor_category_change_proposals_vendor_id_status_idx" ON "vendor_category_change_proposals"("vendor_id", "status");
