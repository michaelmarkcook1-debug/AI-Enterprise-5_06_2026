# Pack 05 — Roles, Workspaces and Audit

## Objective

Add enterprise-readiness foundations.

## Organisation Workspace

Create concepts for:

- organisation
- workspace
- users
- roles
- saved assessments
- saved recommendations
- saved board packs
- monitor watchlists

## Suggested Types

```ts
export type UserRole =
  | "owner"
  | "admin"
  | "executive"
  | "analyst"
  | "procurement"
  | "risk_legal"
  | "investor"
  | "viewer";

export interface Workspace {
  id: string;
  name: string;
  organisationName: string;
  plan: "explorer" | "professional" | "enterprise" | "investor" | "research";
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

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
```

## Audit Events To Track

- assessment created
- assessment completed
- recommendation generated
- board pack generated
- evidence approved
- evidence rejected
- source added
- user invited
- role changed
- monitor alert acknowledged
- export downloaded

## Role-Based Access

Examples:

- Viewer: read only
- Analyst: create assessments, view evidence
- CIO/Executive: create board packs, view Demonstrate
- Procurement: access procurement assessment and reports
- Risk/Legal: access risk register and evidence
- Investor: access Investor Tools
- Admin: manage workspace
- Owner: billing and permissions

## Acceptance Criteria

- Role model exists.
- Workspace model exists or is stubbed.
- Audit event model exists or is stubbed.
- UI can display role-aware navigation later.
