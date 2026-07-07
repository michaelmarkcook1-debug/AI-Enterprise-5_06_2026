-- Sovereignty & Data Residency: a distinct, evidence-graded assessment domain
-- (13th framework domain, universal across every category). Additive-only —
-- one new enum value on the existing DomainId type, no table changes. Existing
-- EvidenceRecord rows are entirely unaffected.
ALTER TYPE "DomainId" ADD VALUE IF NOT EXISTS 'sovereignty_residency';
