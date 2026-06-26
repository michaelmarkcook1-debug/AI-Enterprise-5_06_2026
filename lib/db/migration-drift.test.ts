import { describe, it, expect } from "vitest";
import { diffMigrations } from "./migration-drift";
import { EXPECTED_MIGRATIONS, LATEST_EXPECTED_MIGRATION } from "./expected-migrations";

const A = "20260507003000_initial_backend";
const B = "20260626000002_watchlists_email_userid_drift";
const C = "20260626000003_add_delivery_partnership_layer";

describe("diffMigrations (pure)", () => {
  it("ok when DB has exactly the expected migrations", () => {
    const r = diffMigrations([A, B, C], [A, B, C]);
    expect(r.status).toBe("ok");
    expect(r.ok).toBe(true);
    expect(r.pending).toEqual([]);
    expect(r.unknown).toEqual([]);
  });

  it("behind (the dangerous case): expected migrations missing from the DB", () => {
    // This is the exact bug we shipped — prod DB stuck before the last 2.
    const r = diffMigrations([A, B, C], [A]);
    expect(r.status).toBe("behind");
    expect(r.ok).toBe(false);
    expect(r.pending).toEqual([B, C]);
    expect(r.unknown).toEqual([]);
  });

  it("preserves chronological order of pending migrations", () => {
    const r = diffMigrations([A, B, C], []);
    expect(r.pending).toEqual([A, B, C]); // not reordered
  });

  it("ahead: DB has migrations the code doesn't know about (informational, still ok)", () => {
    const future = "20270101000000_future_change";
    const r = diffMigrations([A, B], [A, B, future]);
    expect(r.status).toBe("ahead");
    expect(r.ok).toBe(true); // ahead does not, by itself, fail the run
    expect(r.unknown).toEqual([future]);
    expect(r.pending).toEqual([]);
  });

  it("behind takes precedence over ahead when both are true", () => {
    const future = "20270101000000_future_change";
    const r = diffMigrations([A, B, C], [A, future]);
    expect(r.status).toBe("behind");
    expect(r.pending).toEqual([B, C]);
    expect(r.unknown).toEqual([future]);
  });

  it("empty DB against empty expected is ok (degenerate)", () => {
    const r = diffMigrations([], []);
    expect(r.status).toBe("ok");
    expect(r.ok).toBe(true);
  });
});

describe("expected-migrations snapshot (generated)", () => {
  it("is non-empty and the latest matches the last entry", () => {
    expect(EXPECTED_MIGRATIONS.length).toBeGreaterThan(0);
    expect(LATEST_EXPECTED_MIGRATION).toBe(EXPECTED_MIGRATIONS[EXPECTED_MIGRATIONS.length - 1]);
  });

  it("is sorted chronologically (timestamp-prefixed names → lexical order)", () => {
    const sorted = [...EXPECTED_MIGRATIONS].sort();
    expect([...EXPECTED_MIGRATIONS]).toEqual(sorted);
  });

  it("has no duplicate migration names", () => {
    expect(new Set(EXPECTED_MIGRATIONS).size).toBe(EXPECTED_MIGRATIONS.length);
  });
});
