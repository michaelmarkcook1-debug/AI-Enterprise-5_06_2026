-- AlterTable: explicit classifier-failure metadata on evidence proposals.
ALTER TABLE "evidence_proposals"
  ADD COLUMN "classification_failed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "classification_failure_code" TEXT,
  ADD COLUMN "classification_failure_reason" TEXT,
  ADD COLUMN "confidence_is_fallback" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing rows with classifier_confidence = 0.5 are documented
-- runner fallbacks (see TRIAGE_POLICY_TUNING_REPORT.md). Mark them
-- explicitly so the legacy 0.5 heuristic in lib/services/triage-runner.ts
-- can be retired.
UPDATE "evidence_proposals"
SET "confidence_is_fallback" = true,
    "classification_failed" = true,
    "classification_failure_code" = 'legacy_fallback_0_5',
    "classification_failure_reason" = 'Pre-fix runner stamped 0.5 default on classifier failure; original cause not recorded. Likely zod_too_big_rationale (304/312) or credit_balance (8/312) per logs/sourcing/.'
WHERE "classifier_confidence" = 0.5
  AND "classifier_rationale" IS NULL;

-- Rows that already have a real classifier rationale are not fallbacks.
