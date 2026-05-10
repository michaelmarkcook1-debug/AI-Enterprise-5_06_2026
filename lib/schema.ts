import { z } from "zod";

export const AssessmentInputSchema = z.object({
  industry: z.enum([
    "regulated_financial",
    "health_life_sciences",
    "legal_professional",
    "public_sector_education",
    "critical_infrastructure_defence",
    "enterprise_software",
    "industrial_physical_ops",
    "commercial_enterprise",
  ]),
  region: z.string().optional(),
  orgSize: z.enum(["smb", "mid_market", "enterprise", "global_enterprise"]),
  aiMaturity: z.enum(["exploring", "piloting", "scaling", "operating"]).optional(),
  primaryObjectives: z.array(z.string()).min(1),
  useCases: z.array(z.string()).min(1),
  dataSensitivity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  riskTolerance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  autonomyAppetite: z.enum(["advisory_only", "human_in_loop", "supervised_agent", "autonomous"]),
  ecosystem: z.array(z.string()),
  deploymentPreference: z.enum(["saas", "vpc", "on_prem", "sovereign", "hybrid"]),
  budgetSensitivity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  vendorIds: z.array(z.string()),
});

export type AssessmentInputDTO = z.infer<typeof AssessmentInputSchema>;
