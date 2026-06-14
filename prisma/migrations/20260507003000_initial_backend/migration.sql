-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('public', 'private', 'subsidiary');

-- CreateEnum
CREATE TYPE "DeploymentPreference" AS ENUM ('saas', 'vpc', 'on_prem', 'sovereign', 'hybrid');

-- CreateEnum
CREATE TYPE "IndustryArchetype" AS ENUM ('regulated_financial', 'health_life_sciences', 'legal_professional', 'public_sector_education', 'critical_infrastructure_defence', 'enterprise_software', 'industrial_physical_ops', 'commercial_enterprise');

-- CreateEnum
CREATE TYPE "DomainId" AS ENUM ('strategic_value', 'data_security_privacy', 'identity_access', 'model_reliability', 'governance_compliance', 'security_threat', 'integration_architecture', 'agentic_autonomy', 'cost_finops', 'workforce_adoption', 'vendor_maturity_lockin', 'capital_resilience', 'market_position');

-- CreateEnum
CREATE TYPE "EvidenceGrade" AS ENUM ('E0', 'E1', 'E2', 'E3', 'E4', 'E5');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('curated', 'agent_extracted', 'analyst_verified', 'rejected');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('fatal', 'severe', 'moderate', 'low');

-- CreateEnum
CREATE TYPE "RecommendationBand" AS ENUM ('not_recommended', 'pilot_only', 'controlled_deployment', 'enterprise_scale');

-- CreateEnum
CREATE TYPE "AssessmentRunStatus" AS ENUM ('created', 'scoring', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('vendor_docs', 'trust_center', 'pricing_page', 'status_page', 'changelog', 'public_filing', 'job_posting', 'review_platform', 'marketplace', 'github', 'analyst_report', 'press_release');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('queued', 'fetching', 'fetched', 'extracting', 'ready_for_review', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('pending', 'approved', 'rejected', 'superseded');

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "vendor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "website" TEXT,
    "hq" TEXT,
    "ownership" "Ownership" NOT NULL,
    "summary" TEXT NOT NULL,
    "supported_deployments" "DeploymentPreference"[] DEFAULT ARRAY[]::"DeploymentPreference"[],
    "ecosystem_fit" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "use_case_fit" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("vendor_id")
);

-- CreateTable
CREATE TABLE "vendor_products" (
    "product_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supported_use_cases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deployment_models" "DeploymentPreference"[] DEFAULT ARRAY[]::"DeploymentPreference"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "vendor_evidence_items" (
    "evidence_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "product_id" TEXT,
    "source_url" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "source_published_at" TIMESTAMP(3),
    "excerpt" TEXT NOT NULL,
    "domain" "DomainId" NOT NULL,
    "subfactor" TEXT NOT NULL,
    "evidence_grade" "EvidenceGrade" NOT NULL,
    "raw_score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "freshness_days" INTEGER,
    "review_status" "EvidenceReviewStatus" NOT NULL DEFAULT 'curated',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_evidence_items_pkey" PRIMARY KEY ("evidence_id")
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "risk_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "context_hash" TEXT,
    "severity" "RiskSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "domain" "DomainId" NOT NULL,
    "is_fatal_if_triggered" BOOLEAN NOT NULL DEFAULT false,
    "fatal_in_industries" "IndustryArchetype"[] DEFAULT ARRAY[]::"IndustryArchetype"[],
    "evidence_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "treatment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("risk_id")
);

-- CreateTable
CREATE TABLE "vendor_industry_adoption" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "industry" "IndustryArchetype" NOT NULL,
    "production_reference_count" INTEGER NOT NULL,
    "deployment_depth_score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_industry_adoption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_runs" (
    "run_id" TEXT NOT NULL,
    "engine_run_id" TEXT NOT NULL,
    "user_id" TEXT,
    "context_hash" TEXT NOT NULL,
    "scoring_rule_version" TEXT NOT NULL,
    "inputs_json" JSONB NOT NULL,
    "vendor_set" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "output_json" JSONB,
    "status" "AssessmentRunStatus" NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "assessment_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "vendor_scores" (
    "score_id" TEXT NOT NULL,
    "assessment_run_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "context_hash" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "pillar_scores_json" JSONB NOT NULL,
    "pillar_breakdown_json" JSONB NOT NULL,
    "final_score" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "recommendation_band" "RecommendationBand" NOT NULL,
    "top_strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "top_risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missing_evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validation_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industry_rationale" TEXT NOT NULL,
    "evidence_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risk_flags_triggered_json" JSONB NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excluded_reason" TEXT,
    "bonuses_json" JSONB NOT NULL,
    "penalties_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_scores_pkey" PRIMARY KEY ("score_id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "rule_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "trigger_condition" JSONB,
    "weight_changes" JSONB,
    "penalties" JSONB,
    "blockers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "vendor_sources" (
    "source_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "category" "SourceCategory" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_fetched_at" TIMESTAMP(3),
    "freshness_horizon_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_sources_pkey" PRIMARY KEY ("source_id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "job_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "source_id" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "raw_content" TEXT,
    "raw_content_hash" TEXT,
    "error" TEXT,
    "proposals_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "evidence_proposals" (
    "proposal_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "domain" "DomainId" NOT NULL,
    "subfactor" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "proposed_grade" "EvidenceGrade" NOT NULL,
    "proposed_raw_score" DOUBLE PRECISION NOT NULL,
    "source_url" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "classifier_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classifier_rationale" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'pending',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "promoted_evidence_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_proposals_pkey" PRIMARY KEY ("proposal_id")
);

-- CreateTable
CREATE TABLE "intelligence_vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "headquarters" TEXT,
    "ownership_type" TEXT NOT NULL,
    "supported_industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supported_use_cases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supported_ecosystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deployment_options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autonomy_level_max" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "market_position" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "product_capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enterprise_controls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agentic_capability" TEXT NOT NULL,
    "industry_strength" JSONB NOT NULL,
    "analyst_interpretation" TEXT NOT NULL,
    "risk_profile" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_updated" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_pillar_scores" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "capability_score" DOUBLE PRECISION NOT NULL,
    "evidence_grade" "EvidenceGrade" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missing_evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "vendor_pillar_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "market_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_share_estimates" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "reported_share" DOUBLE PRECISION,
    "estimated_share" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "source_date" TIMESTAMP(3) NOT NULL,
    "methodology" TEXT NOT NULL,
    "previous_estimate" DOUBLE PRECISION,
    "change_pct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "market_share_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_momentum" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "momentum_score" DOUBLE PRECISION NOT NULL,
    "news_velocity" DOUBLE PRECISION NOT NULL,
    "product_velocity" DOUBLE PRECISION NOT NULL,
    "adoption_signal" DOUBLE PRECISION NOT NULL,
    "hiring_signal" DOUBLE PRECISION NOT NULL,
    "customer_signal" DOUBLE PRECISION NOT NULL,
    "partner_signal" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "market_share_movement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk_signal" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "vendor_momentum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_news_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impact_score" DOUBLE PRECISION NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "affected_pillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "why_it_matters" TEXT NOT NULL,
    "suggested_score_impact" JSONB NOT NULL,
    "related_vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_capabilities" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maturity_score" DOUBLE PRECISION NOT NULL,
    "evidence_grade" "EvidenceGrade" NOT NULL,
    "last_verified" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "vendor_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alert_rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_sources" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "evidence_grade" "EvidenceGrade" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "evidence_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_profiles_category_idx" ON "vendor_profiles"("category");

-- CreateIndex
CREATE INDEX "vendor_profiles_active_idx" ON "vendor_profiles"("active");

-- CreateIndex
CREATE INDEX "vendor_products_vendor_id_idx" ON "vendor_products"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_products_vendor_id_product_name_key" ON "vendor_products"("vendor_id", "product_name");

-- CreateIndex
CREATE INDEX "vendor_evidence_items_vendor_id_domain_idx" ON "vendor_evidence_items"("vendor_id", "domain");

-- CreateIndex
CREATE INDEX "vendor_evidence_items_domain_evidence_grade_idx" ON "vendor_evidence_items"("domain", "evidence_grade");

-- CreateIndex
CREATE INDEX "vendor_evidence_items_captured_at_idx" ON "vendor_evidence_items"("captured_at");

-- CreateIndex
CREATE INDEX "risk_flags_vendor_id_severity_idx" ON "risk_flags"("vendor_id", "severity");

-- CreateIndex
CREATE INDEX "risk_flags_context_hash_idx" ON "risk_flags"("context_hash");

-- CreateIndex
CREATE INDEX "vendor_industry_adoption_industry_idx" ON "vendor_industry_adoption"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_industry_adoption_vendor_id_industry_key" ON "vendor_industry_adoption"("vendor_id", "industry");

-- CreateIndex
CREATE INDEX "assessment_runs_engine_run_id_idx" ON "assessment_runs"("engine_run_id");

-- CreateIndex
CREATE INDEX "assessment_runs_context_hash_scoring_rule_version_idx" ON "assessment_runs"("context_hash", "scoring_rule_version");

-- CreateIndex
CREATE INDEX "assessment_runs_created_at_idx" ON "assessment_runs"("created_at");

-- CreateIndex
CREATE INDEX "vendor_scores_assessment_run_id_rank_idx" ON "vendor_scores"("assessment_run_id", "rank");

-- CreateIndex
CREATE INDEX "vendor_scores_vendor_id_context_hash_idx" ON "vendor_scores"("vendor_id", "context_hash");

-- CreateIndex
CREATE INDEX "vendor_scores_generated_at_idx" ON "vendor_scores"("generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_version_key" ON "scoring_rules"("version");

-- CreateIndex
CREATE INDEX "scoring_rules_active_idx" ON "scoring_rules"("active");

-- CreateIndex
CREATE INDEX "vendor_sources_vendor_id_category_idx" ON "vendor_sources"("vendor_id", "category");

-- CreateIndex
CREATE INDEX "vendor_sources_active_last_fetched_at_idx" ON "vendor_sources"("active", "last_fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_sources_vendor_id_url_key" ON "vendor_sources"("vendor_id", "url");

-- CreateIndex
CREATE INDEX "ingestion_jobs_vendor_id_status_idx" ON "ingestion_jobs"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_created_at_idx" ON "ingestion_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "evidence_proposals_vendor_id_status_idx" ON "evidence_proposals"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "evidence_proposals_status_created_at_idx" ON "evidence_proposals"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_vendors_slug_key" ON "intelligence_vendors"("slug");

-- CreateIndex
CREATE INDEX "intelligence_vendors_category_idx" ON "intelligence_vendors"("category");

-- CreateIndex
CREATE INDEX "intelligence_vendors_overall_score_idx" ON "intelligence_vendors"("overall_score");

-- CreateIndex
CREATE INDEX "intelligence_vendors_confidence_score_idx" ON "intelligence_vendors"("confidence_score");

-- CreateIndex
CREATE INDEX "vendor_pillar_scores_pillar_idx" ON "vendor_pillar_scores"("pillar");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_pillar_scores_vendor_id_pillar_key" ON "vendor_pillar_scores"("vendor_id", "pillar");

-- CreateIndex
CREATE INDEX "market_share_estimates_category_id_estimated_share_idx" ON "market_share_estimates"("category_id", "estimated_share");

-- CreateIndex
CREATE INDEX "market_share_estimates_vendor_id_idx" ON "market_share_estimates"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_share_estimates_vendor_id_category_id_key" ON "market_share_estimates"("vendor_id", "category_id");

-- CreateIndex
CREATE INDEX "vendor_momentum_period_momentum_score_idx" ON "vendor_momentum"("period", "momentum_score");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_momentum_vendor_id_period_key" ON "vendor_momentum"("vendor_id", "period");

-- CreateIndex
CREATE INDEX "intelligence_news_items_published_at_idx" ON "intelligence_news_items"("published_at");

-- CreateIndex
CREATE INDEX "intelligence_news_items_impact_score_idx" ON "intelligence_news_items"("impact_score");

-- CreateIndex
CREATE INDEX "capabilities_category_idx" ON "capabilities"("category");

-- CreateIndex
CREATE INDEX "vendor_capabilities_capability_id_maturity_score_idx" ON "vendor_capabilities"("capability_id", "maturity_score");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_capabilities_vendor_id_capability_id_key" ON "vendor_capabilities"("vendor_id", "capability_id");

-- CreateIndex
CREATE INDEX "watchlists_created_at_idx" ON "watchlists"("created_at");

-- CreateIndex
CREATE INDEX "evidence_sources_entity_type_entity_id_idx" ON "evidence_sources"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "evidence_sources_evidence_grade_idx" ON "evidence_sources"("evidence_grade");

-- AddForeignKey
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("vendor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evidence_items" ADD CONSTRAINT "vendor_evidence_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("vendor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_evidence_items" ADD CONSTRAINT "vendor_evidence_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "vendor_products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("vendor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_industry_adoption" ADD CONSTRAINT "vendor_industry_adoption_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("vendor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_scores" ADD CONSTRAINT "vendor_scores_assessment_run_id_fkey" FOREIGN KEY ("assessment_run_id") REFERENCES "assessment_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_scores" ADD CONSTRAINT "vendor_scores_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("vendor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "vendor_sources"("source_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_proposals" ADD CONSTRAINT "evidence_proposals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ingestion_jobs"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_pillar_scores" ADD CONSTRAINT "vendor_pillar_scores_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_share_estimates" ADD CONSTRAINT "market_share_estimates_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_share_estimates" ADD CONSTRAINT "market_share_estimates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "market_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_momentum" ADD CONSTRAINT "vendor_momentum_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_capabilities" ADD CONSTRAINT "vendor_capabilities_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "intelligence_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_capabilities" ADD CONSTRAINT "vendor_capabilities_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
