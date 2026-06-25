// Batch-runner request-builder guard.
// Pure unit tests (no LLM, no DB): the Batch API request we submit must be the
// SAME shape as the synchronous extraction call — forced tool, cached system
// prompt — or the two paths would silently diverge.

import { describe, it, expect } from "vitest";
import { buildExtractionRequest } from "./batch-runner";
import { parseExtraction, type ExtractedProposal } from "../agents/evidence-extractor";
import type { SourceManifestEntry } from "./manifest";

const ENTRY: SourceManifestEntry = {
  vendorId: "vendor_openai",
  category: "trust_center",
  url: "https://trust.example.com/",
  label: "Example Trust Portal",
  expectedDomains: ["data_security_privacy"],
  freshnessHorizonDays: 30,
};

describe("buildExtractionRequest", () => {
  const req = buildExtractionRequest("s0", ENTRY, "Some raw source content about security controls.");

  it("sets the custom_id used to correlate unordered batch results", () => {
    expect(req.custom_id).toBe("s0");
  });

  it("forces the extractor tool (matches the synchronous path)", () => {
    expect(req.params.tool_choice).toEqual({ type: "tool", name: "emit_evidence_proposals" });
  });

  it("prompt-caches the system prompt as an ephemeral text block", () => {
    const system = req.params.system;
    expect(Array.isArray(system)).toBe(true);
    const block = (system as Array<{ type: string; cache_control?: { type: string } }>)[0];
    expect(block.type).toBe("text");
    expect(block.cache_control?.type).toBe("ephemeral");
  });

  it("embeds the vendor + source URL in the user prompt", () => {
    const content = req.params.messages[0].content as string;
    expect(content).toContain("vendor_openai");
    expect(content).toContain("https://trust.example.com/");
  });
});

describe("parseExtraction", () => {
  it("accepts a well-formed extraction payload", () => {
    const proposal: ExtractedProposal = {
      domain: "data_security_privacy",
      subfactor: "Subprocessor disclosure",
      excerpt: "The trust centre lists all subprocessors and data residency regions.",
      proposedGrade: "E2",
      proposedRawScore: 70,
      rationale: "Public trust-centre listing — E2 absent an independent audit.",
    };
    expect(parseExtraction({ proposals: [proposal] }).proposals).toHaveLength(1);
  });

  it("rejects a malformed payload", () => {
    expect(() => parseExtraction({ proposals: [{ domain: "not_a_domain" }] })).toThrow();
  });
});
