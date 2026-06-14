// Enterprise Readiness — Pack 05.
// ────────────────────────────────
// Roles, workspaces, product editions, audit events, and saved
// artefacts for commercial enterprise deployment.

export type UserRole =
  | "owner"
  | "admin"
  | "executive"
  | "analyst"
  | "procurement"
  | "risk_legal"
  | "investor"
  | "viewer";

export type ProductPlan =
  | "explorer"
  | "professional"
  | "enterprise"
  | "investor"
  | "research";

export interface ProductEdition {
  plan: ProductPlan;
  label: string;
  description: string;
  features: string[];
  limits: Record<string, number | string>;
}

export const PRODUCT_EDITIONS: ProductEdition[] = [
  {
    plan: "explorer",
    label: "Explorer (Free)",
    description: "Query lite, limited Understand, public vendor profiles, limited Atlas.",
    features: ["Query lite", "Limited Understand", "Public vendor profiles", "Limited Atlas"],
    limits: { users: 1, assessments: 2, boardPacks: 0, watchlists: 1 },
  },
  {
    plan: "professional",
    label: "Professional",
    description: "Full Query, full Understand, Tier 1 Assess, basic Demonstrate, limited Monitor.",
    features: ["Full Query", "Full Understand", "AI Opportunity Assessment", "Basic Demonstrate", "Limited Monitor"],
    limits: { users: 5, assessments: 10, boardPacks: 3, watchlists: 5 },
  },
  {
    plan: "enterprise",
    label: "Enterprise",
    description: "All Assess tiers, full Demonstrate, Board Pack exports, Monitor, team workspaces, saved assessments, audit logs.",
    features: ["All assessment tiers", "Full Board Defence", "Board Pack exports", "Full Monitor", "Team workspaces", "Saved assessments", "Audit logs", "Admin approval workflow"],
    limits: { users: "Unlimited", assessments: "Unlimited", boardPacks: "Unlimited", watchlists: "Unlimited" },
  },
  {
    plan: "investor",
    label: "Investor",
    description: "Investor Tools, scenario simulator, exposure map, investor memo exports, category intelligence.",
    features: ["Investor Dashboard", "Scenario Simulator", "Exposure Map", "Investor Memo exports", "Category Intelligence"],
    limits: { users: 10, assessments: 0, boardPacks: 0, watchlists: 10 },
  },
  {
    plan: "research",
    label: "Analyst / Research",
    description: "Evidence queue, source registry, methodology tools, data approval workflow.",
    features: ["Evidence queue", "Source registry", "Methodology tools", "Data approval workflow", "Full data access"],
    limits: { users: 3, assessments: "Unlimited", boardPacks: "Unlimited", watchlists: "Unlimited" },
  },
];

export interface Workspace {
  id: string;
  name: string;
  organisationName: string;
  plan: ProductPlan;
  createdAt: string;
}

export interface SavedAssessment {
  id: string;
  workspaceId: string;
  title: string;
  tier: "opportunity" | "strategy" | "procurement";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "completed" | "sent_to_demonstrate" | "archived";
}

export interface SavedBoardPack {
  id: string;
  workspaceId: string;
  title: string;
  assessmentId?: string;
  createdBy: string;
  createdAt: string;
  format: "markdown" | "html" | "pdf" | "pptx";
  status: "draft" | "generated" | "shared";
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName?: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type AuditAction =
  | "assessment_created"
  | "assessment_completed"
  | "recommendation_generated"
  | "board_pack_generated"
  | "board_pack_downloaded"
  | "evidence_approved"
  | "evidence_rejected"
  | "source_added"
  | "user_invited"
  | "role_changed"
  | "monitor_alert_acknowledged"
  | "export_downloaded"
  | "watchlist_created"
  | "watchlist_updated";

/** Role display labels and descriptions. */
export const ROLE_LABELS: Record<UserRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access including billing and permissions" },
  admin: { label: "Admin", description: "Manage workspace, users, and data" },
  executive: { label: "CIO / Executive", description: "Create board packs, view Demonstrate and Monitor" },
  analyst: { label: "Analyst", description: "Create assessments, view evidence" },
  procurement: { label: "Procurement", description: "Access procurement assessment and reports" },
  risk_legal: { label: "Risk / Legal", description: "Access risk register and evidence" },
  investor: { label: "Investor", description: "Access Investor Tools" },
  viewer: { label: "Viewer", description: "Read-only access" },
};

/** Enterprise readiness checklist items. */
export const ENTERPRISE_READINESS_CHECKLIST = [
  { id: "auth", label: "Authentication exists or plan defined", status: "planned" as const },
  { id: "roles", label: "Roles defined", status: "done" as const },
  { id: "workspace", label: "Workspace concept defined", status: "done" as const },
  { id: "saved_assessments", label: "Saved assessments defined", status: "done" as const },
  { id: "saved_board_packs", label: "Saved board packs defined", status: "done" as const },
  { id: "audit_events", label: "Audit events defined", status: "done" as const },
  { id: "evidence_approval", label: "Evidence approval workflow exists", status: "done" as const },
  { id: "source_registry", label: "Source registry exists", status: "done" as const },
  { id: "data_licence_flags", label: "Data licence flags exist", status: "done" as const },
  { id: "export_history", label: "Export history exists", status: "planned" as const },
  { id: "legal_disclaimers", label: "Legal disclaimers visible", status: "done" as const },
  { id: "methodology_version", label: "Methodology version visible", status: "done" as const },
  { id: "stale_data_warnings", label: "Stale data warnings visible", status: "done" as const },
  { id: "admin_data_quality", label: "Admin can review data quality", status: "done" as const },
];
