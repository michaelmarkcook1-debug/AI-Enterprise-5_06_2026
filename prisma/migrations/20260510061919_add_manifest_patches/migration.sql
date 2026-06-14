-- CreateEnum
CREATE TYPE "PatchStatus" AS ENUM ('pending', 'approved', 'rejected', 'applied', 'superseded');

-- CreateTable
CREATE TABLE "manifest_patches" (
    "patch_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dead_url" TEXT NOT NULL,
    "http_status" INTEGER NOT NULL,
    "candidate_url" TEXT NOT NULL,
    "candidate_title" TEXT NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "citations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "llm_source" TEXT NOT NULL,
    "searches_used" INTEGER NOT NULL,
    "status" "PatchStatus" NOT NULL DEFAULT 'pending',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "applied_at" TIMESTAMP(3),
    "retry_attempted" BOOLEAN NOT NULL DEFAULT false,
    "retry_ok" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manifest_patches_pkey" PRIMARY KEY ("patch_id")
);

-- CreateIndex
CREATE INDEX "manifest_patches_vendor_id_status_idx" ON "manifest_patches"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "manifest_patches_status_created_at_idx" ON "manifest_patches"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "manifest_patches_vendor_id_dead_url_status_key" ON "manifest_patches"("vendor_id", "dead_url", "status");
