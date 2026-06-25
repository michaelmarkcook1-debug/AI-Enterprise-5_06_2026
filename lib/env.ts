// Environment-variable contract for AI Enterprise.
//
// Single source of truth for which env vars exist, what they mean, and what
// "production-ready" requires. Every other module should call into this rather
// than touching `process.env` directly so we get one place to audit + validate.
//
// Use cases:
//   - production-check CLI runs `inspectEnv()` to print a green/red checklist
//   - /admin/production-status page renders the same checklist live
//   - assertProductionReady() throws with a precise list of missing things
//   - feature flags (`hasDatabase`, `hasLLM`, `hasAdminAuth`) used by routes

export type EnvKey =
  | "DATABASE_URL"
  | "ANTHROPIC_API_KEY"
  | "ANTHROPIC_MODEL"
  | "ANTHROPIC_EXTRACT_MODEL"
  | "ANTHROPIC_ANALYST_MODEL"
  | "ADMIN_API_TOKEN"
  | "ADMIN_API_OPEN"
  | "CRON_SECRET"
  | "REFRESH_KILL_SWITCH"
  | "REFRESH_CYCLE_CAP_USD"
  | "REFRESH_DAY_CAP_USD"
  | "SOURCING_LOG_DIR"
  | "NODE_ENV"
  | "VERCEL_ENV";

export type EnvSeverity = "required" | "recommended" | "optional";

export interface EnvVarSpec {
  key: EnvKey;
  description: string;
  severity: EnvSeverity;
  // What product capability this controls — surfaced in the readiness UI.
  enables: string[];
  // Hint shown when missing.
  remediation: string;
  // For DATABASE_URL etc. — pattern check before we trust the value.
  validate?: (value: string) => string | null;
  // When true, the value is sensitive — never echoed in logs/UI.
  secret: boolean;
}

const isUrlish = (v: string): string | null => /^[a-z][a-z0-9+\-.]*:\/\//i.test(v) ? null : "must look like a URL (scheme://…)";

export const ENV_SPEC: EnvVarSpec[] = [
  {
    key: "DATABASE_URL",
    description: "Postgres connection string (Neon, Supabase, RDS, etc).",
    severity: "required",
    enables: [
      "Persistence for assessment runs + scoring results",
      "Evidence ingestion job queue + proposals",
      "Promotion of approved proposals → live evidence",
      "Investor watchlist + saved portfolios survive across nodes",
    ],
    remediation: "Provision a Postgres instance (Vercel Marketplace → Neon / Supabase) and set DATABASE_URL. Then run `npx prisma migrate deploy && npm run db:seed`.",
    validate: isUrlish,
    secret: true,
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Anthropic API key for the LLM evidence extractor + classifier agents.",
    severity: "required",
    enables: [
      "Real LLM extraction from fetched source content (vs deterministic stubs)",
      "Real evidence classification + risk-flag generation",
      "Live scoring pipeline against the 51-source manifest",
    ],
    remediation: "Get a key from console.anthropic.com and set ANTHROPIC_API_KEY. While unset the agents return labelled stub output and the dashboard stays in 'seed' mode.",
    validate: (v) => (v.startsWith("sk-ant-") ? null : "expected to start with 'sk-ant-'"),
    secret: true,
  },
  {
    key: "ANTHROPIC_MODEL",
    description: "Override which Claude model the extractor + classifier use.",
    severity: "optional",
    enables: ["Pin to a specific model version for reproducibility"],
    remediation: "Defaults to claude-sonnet-4-6. Override only if you need a specific model.",
    secret: false,
  },
  {
    key: "ANTHROPIC_EXTRACT_MODEL",
    description: "Override the model used for structured evidence extraction/classification.",
    severity: "optional",
    enables: ["Tune the bulk-extraction model independently of the default"],
    remediation: "Defaults to claude-haiku-4-5 (cheap bulk tier). Override only if extraction needs more.",
    secret: false,
  },
  {
    key: "ANTHROPIC_ANALYST_MODEL",
    description: "Override the model used for analyst-grade synthesis (Stage 3).",
    severity: "optional",
    enables: ["Pin the analyst-synthesis model"],
    remediation: "Defaults to claude-opus-4-8. Override only for reproducibility.",
    secret: false,
  },
  {
    key: "CRON_SECRET",
    description: "Bearer secret the Vercel cron sends to /api/cron/* so only the scheduler can trigger the shared refresh.",
    severity: "recommended",
    enables: [
      "Authenticate the scheduled daily refresh (vs. open trigger)",
      "Keep the only LLM-spending pipeline gated to the scheduler + admins",
    ],
    remediation: "Generate with `openssl rand -hex 32`, set CRON_SECRET in Vercel; the cron sends it as `Authorization: Bearer …`.",
    secret: true,
  },
  {
    key: "REFRESH_KILL_SWITCH",
    description: "Hard stop for the shared market refresh. Set to '1' to halt ALL LLM spend.",
    severity: "optional",
    enables: ["Emergency, redeploy-safe stop on the only pipeline that spends Anthropic credits"],
    remediation: "Leave unset normally. Set to '1' in Vercel to freeze the refresh without a code change.",
    secret: false,
  },
  {
    key: "REFRESH_CYCLE_CAP_USD",
    description: "Hard per-run spend cap for the shared refresh (USD).",
    severity: "optional",
    enables: ["Bounds the cost of any single refresh cycle"],
    remediation: "Defaults to $5. Lower it to tighten the per-run ceiling; raise deliberately.",
    secret: false,
  },
  {
    key: "REFRESH_DAY_CAP_USD",
    description: "Hard per-UTC-day spend cap across all refresh runs (USD).",
    severity: "optional",
    enables: ["Bounds total daily Anthropic spend even if the refresh is triggered repeatedly"],
    remediation: "Defaults to $25. Lower it to tighten the daily ceiling; raise deliberately.",
    secret: false,
  },
  {
    key: "ADMIN_API_TOKEN",
    description: "Bearer token required for /api/admin/* mutating routes.",
    severity: "required",
    enables: [
      "Trigger evidence ingestion runs",
      "Approve/reject evidence proposals",
      "Run sourcing pipeline against the manifest",
    ],
    remediation: "Generate with `openssl rand -hex 32` and set ADMIN_API_TOKEN. Send via the `x-admin-token` header.",
    secret: true,
  },
  {
    key: "ADMIN_API_OPEN",
    description: "Set to '1' in dev to bypass the admin token check.",
    severity: "optional",
    enables: ["Frictionless local development of admin tools"],
    remediation: "Optional. Never set in production — bypasses authentication.",
    secret: false,
  },
  {
    key: "SOURCING_LOG_DIR",
    description: "Directory for NDJSON ingestion logs.",
    severity: "optional",
    enables: ["Forensic tail of every fetch/extract/classify/promote step"],
    remediation: "Optional. Defaults to <cwd>/logs/sourcing. On Vercel, point to /tmp or ship logs via OTel.",
    secret: false,
  },
  {
    key: "NODE_ENV",
    description: "Standard Node environment marker.",
    severity: "optional",
    enables: ["Production optimisations + warning suppression"],
    remediation: "Set automatically by `next build` / `next start`.",
    secret: false,
  },
  {
    key: "VERCEL_ENV",
    description: "Set by Vercel to one of: production | preview | development.",
    severity: "optional",
    enables: ["Differentiate preview deployments from production"],
    remediation: "Set automatically on Vercel.",
    secret: false,
  },
];

export type EnvStatus = "set" | "missing" | "invalid";

export interface EnvVarReport {
  spec: EnvVarSpec;
  status: EnvStatus;
  // Sanitised display value: secrets become "••••" + first 4 chars of redacted hash.
  displayValue: string;
  validationError?: string;
}

function getValue(key: EnvKey): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

function maskSecret(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-2)}`;
}

export function inspectEnv(): EnvVarReport[] {
  return ENV_SPEC.map((spec) => {
    const raw = getValue(spec.key);
    if (!raw) {
      return { spec, status: "missing", displayValue: "—" };
    }
    const validationError = spec.validate ? spec.validate(raw) : null;
    if (validationError) {
      return {
        spec, status: "invalid",
        displayValue: spec.secret ? maskSecret(raw) : raw,
        validationError,
      };
    }
    return {
      spec, status: "set",
      displayValue: spec.secret ? maskSecret(raw) : raw,
    };
  });
}

export interface ReadinessSummary {
  ready: boolean;
  requiredMissing: EnvVarReport[];
  requiredInvalid: EnvVarReport[];
  recommendedMissing: EnvVarReport[];
  reports: EnvVarReport[];
}

export function getReadiness(): ReadinessSummary {
  const reports = inspectEnv();
  const requiredMissing = reports.filter((r) => r.spec.severity === "required" && r.status === "missing");
  const requiredInvalid = reports.filter((r) => r.spec.severity === "required" && r.status === "invalid");
  const recommendedMissing = reports.filter((r) => r.spec.severity === "recommended" && r.status === "missing");
  return {
    ready: requiredMissing.length === 0 && requiredInvalid.length === 0,
    requiredMissing, requiredInvalid, recommendedMissing,
    reports,
  };
}

export function assertProductionReady(): void {
  const summary = getReadiness();
  if (summary.ready) return;
  const lines: string[] = ["AI Enterprise is not production-ready:"];
  for (const r of summary.requiredMissing) {
    lines.push(`  ✗ ${r.spec.key} missing — ${r.spec.remediation}`);
  }
  for (const r of summary.requiredInvalid) {
    lines.push(`  ✗ ${r.spec.key} invalid (${r.validationError}) — ${r.spec.remediation}`);
  }
  throw new Error(lines.join("\n"));
}

// Capability flags consumed by routes/components.
export const hasDatabase = (): boolean => Boolean(getValue("DATABASE_URL"));
export const hasLLM = (): boolean => {
  const k = getValue("ANTHROPIC_API_KEY");
  return Boolean(k && k.startsWith("sk-ant-"));
};
export const hasAdminAuth = (): boolean => Boolean(getValue("ADMIN_API_TOKEN")) || getValue("ADMIN_API_OPEN") === "1";
export const isProduction = (): boolean => getValue("NODE_ENV") === "production" || getValue("VERCEL_ENV") === "production";
