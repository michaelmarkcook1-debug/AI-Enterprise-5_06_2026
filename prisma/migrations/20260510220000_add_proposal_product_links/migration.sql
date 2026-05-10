-- Operator-confirmable product linkage on evidence proposals.
-- product_scope_ids is the list of products this evidence applies to;
-- is_vendor_wide=true is set when the linkage covers every product the
-- vendor sells (e.g. trust-centre / pricing / security pages).
ALTER TABLE "evidence_proposals"
  ADD COLUMN "product_scope_ids" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "is_vendor_wide"    BOOLEAN NOT NULL DEFAULT false;
