// Routine-intel GitHub inbox — the honest-skip guarantee: with no token
// configured, pullRoutineInbox is a safe, side-effect-free no-op (never
// throws, never hits the network, never touches the database).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("pullRoutineInbox — honest no-op when unconfigured", () => {
  const savedToken = process.env.GITHUB_INBOX_TOKEN;
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GITHUB_INBOX_TOKEN;
  });
  afterEach(() => {
    if (savedToken !== undefined) process.env.GITHUB_INBOX_TOKEN = savedToken;
    vi.resetModules();
  });

  it(
    "returns configured:false and does nothing when GITHUB_INBOX_TOKEN is unset",
    async () => {
      const { pullRoutineInbox, isInboxConfigured } = await import("./github-inbox");
      expect(isInboxConfigured()).toBe(false);
      const r = await pullRoutineInbox();
      expect(r.configured).toBe(false);
      expect(r.filesProcessed).toBe(0);
      expect(r.findingsAccepted).toBe(0);
      expect(r.proposalsAccepted).toBe(0);
      expect(r.error).toBeUndefined();
    },
    20_000,
  );
});
