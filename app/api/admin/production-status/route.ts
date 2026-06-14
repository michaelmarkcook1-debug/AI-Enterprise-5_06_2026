import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { ENV_SPEC, getReadiness, hasDatabase, hasLLM } from "@/lib/env";
import { manifestSummary } from "@/lib/sourcing/manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Gate {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  remediation?: string;
  severity: "required" | "recommended";
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  const gates: Gate[] = [];
  const readiness = getReadiness();
  for (const r of readiness.reports) {
    if (r.spec.severity === "optional") continue;
    const sev = r.spec.severity === "required" ? "required" : "recommended";
    gates.push({
      id: `env_${r.spec.key}`,
      label: r.spec.key,
      ok: r.status === "set",
      detail: r.status === "set" ? `${r.displayValue}` : r.status === "invalid" ? `invalid: ${r.validationError}` : "missing",
      remediation: r.spec.remediation,
      severity: sev,
    });
  }

  // DB reachability
  if (hasDatabase()) {
    try {
      const { getPrisma } = await import("@/lib/prisma");
      const prisma = getPrisma();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendorCount = await (prisma as any).vendorProfile.count();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const verified = await (prisma as any).evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pending = await (prisma as any).evidenceProposal.count({ where: { status: "pending" } });
      gates.push({
        id: "database_reachable",
        label: "Database reachable + migrated",
        ok: true,
        detail: `vendor_profiles ${vendorCount} · verified ${verified} · pending ${pending}`,
        severity: "required",
      });
      gates.push({
        id: "evidence_live",
        label: "Live analyst-verified evidence",
        ok: verified > 0,
        detail: verified > 0 ? `${verified} verified rows feeding scoring` : "0 verified rows — dashboard remains in 'seed' mode",
        remediation: "Run npm run ingest, then approve a proposal at /admin/evidence.",
        severity: "recommended",
      });
    } catch (err) {
      gates.push({
        id: "database_reachable",
        label: "Database reachable + migrated",
        ok: false,
        detail: err instanceof Error ? err.message.split("\n")[0] : String(err),
        remediation: "Verify DATABASE_URL credentials and run `npx prisma migrate deploy`.",
        severity: "required",
      });
    }
  } else {
    gates.push({
      id: "database_reachable",
      label: "Database reachable + migrated",
      ok: false,
      detail: "DATABASE_URL not set",
      remediation: "Set DATABASE_URL.",
      severity: "required",
    });
  }

  gates.push({
    id: "llm_wired",
    label: "LLM extractor + classifier wired",
    ok: hasLLM(),
    detail: hasLLM() ? "ANTHROPIC_API_KEY valid" : "stub mode (agents return deterministic placeholders)",
    remediation: "Set ANTHROPIC_API_KEY (must start with sk-ant-).",
    severity: "required",
  });

  const summary = manifestSummary();
  gates.push({
    id: "manifest_sane",
    label: "Source manifest",
    ok: summary.totalSources > 0,
    detail: `${summary.totalSources} URLs · ${Object.keys(summary.byVendor).length} vendors · ${Object.entries(summary.byCategory).map(([k, v]) => `${k}:${v}`).join(", ")}`,
    severity: "required",
  });

  const requiredFails = gates.filter((g) => !g.ok && g.severity === "required");
  return Response.json({
    ready: requiredFails.length === 0,
    gates,
    summary: {
      requiredPassing: gates.filter((g) => g.severity === "required" && g.ok).length,
      requiredTotal: gates.filter((g) => g.severity === "required").length,
      recommendedPassing: gates.filter((g) => g.severity === "recommended" && g.ok).length,
      recommendedTotal: gates.filter((g) => g.severity === "recommended").length,
    },
    envSpec: ENV_SPEC.filter((s) => s.severity !== "optional").map(({ key, severity, description, enables }) => ({ key, severity, description, enables })),
    generatedAt: new Date().toISOString(),
  });
}
