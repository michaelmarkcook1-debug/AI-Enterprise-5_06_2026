import { describe, it, expect } from "vitest";
import {
  migrationAlertSignature,
  shouldSendAlert,
  buildDriftAlertEmail,
} from "./migration-drift-alert";
import type { MigrationDriftResult } from "./migration-drift";

const behind: MigrationDriftResult = {
  status: "behind",
  ok: false,
  pending: ["20260626000003_add_delivery_partnership_layer", "20260626000000_phase2_member_identity"],
  unknown: [],
  expectedCount: 12,
  appliedCount: 10,
  latestExpected: "20260626000003_add_delivery_partnership_layer",
  latestApplied: "20260626000001_auth_token_requester_hash",
  message: "DB SCHEMA DRIFT: 2 migration(s)...",
};

describe("migrationAlertSignature", () => {
  it("is order-independent (sorted) so the same set dedups regardless of input order", () => {
    expect(migrationAlertSignature(["b", "a", "c"])).toBe(migrationAlertSignature(["c", "b", "a"]));
  });
});

describe("shouldSendAlert (dedup)", () => {
  const sig = migrationAlertSignature(behind.pending);
  it("alerts when never alerted before", () => {
    expect(shouldSendAlert(null, "2026-06-26", sig)).toBe(true);
  });
  it("suppresses a repeat on the same day for the same missing-set", () => {
    expect(shouldSendAlert({ date: "2026-06-26", signature: sig }, "2026-06-26", sig)).toBe(false);
  });
  it("re-alerts when the day rolls over", () => {
    expect(shouldSendAlert({ date: "2026-06-26", signature: sig }, "2026-06-27", sig)).toBe(true);
  });
  it("re-alerts when the missing-set changes (a new migration fell behind)", () => {
    const newSig = migrationAlertSignature([...behind.pending, "20260627000000_new"]);
    expect(shouldSendAlert({ date: "2026-06-26", signature: sig }, "2026-06-26", newSig)).toBe(true);
  });
});

describe("buildDriftAlertEmail", () => {
  const email = buildDriftAlertEmail(behind, {
    environment: "production",
    branch: "main",
    panelUrl: "https://example.com/admin/pipeline-health",
  });
  it("names the environment in the subject", () => {
    expect(email.subject).toContain("production");
    expect(email.subject).toContain("2 migration");
  });
  it("lists every missing migration in the body", () => {
    for (const m of behind.pending) expect(email.html).toContain(m);
  });
  it("includes the pipeline-health link", () => {
    expect(email.html).toContain("https://example.com/admin/pipeline-health");
  });
});
