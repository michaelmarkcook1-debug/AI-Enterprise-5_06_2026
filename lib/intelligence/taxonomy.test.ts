// C13 taxonomy — mapping + "investors/sovereign are lenses, not vendors" tests.
import { describe, it, expect } from "vitest";
import type { Role } from "./entities";
import {
  roleToLayer,
  roleToLens,
  roleToTag,
  isRankableRole,
  isRankableVendor,
  layersForRoles,
  lensesForRoles,
  tagsForRoles,
  primaryLayerForRoles,
  STANDARD_LAYERS,
} from "./taxonomy";

describe("role → taxonomy mapping", () => {
  it("maps vendor roles to standard layers", () => {
    expect(roleToLayer("Hardware Provider")).toBe("hardware");
    expect(roleToLayer("Infrastructure Player")).toBe("infra");
    expect(roleToLayer("Cloud / Hosting Provider")).toBe("infra");
    expect(roleToLayer("Data & Services Provider")).toBe("infra");
    expect(roleToLayer("Platform Vendor")).toBe("platform");
    expect(roleToLayer("Model Provider")).toBe("model");
    expect(roleToLayer("Application Vendor")).toBe("application");
  });

  it("maps Investor / Sovereign / Regulator to LENSES (never a layer)", () => {
    for (const r of ["Investor", "Sovereign / Regional AI", "Regulator / Policy Actor"] as Role[]) {
      expect(roleToLayer(r)).toBeNull();
      expect(roleToLens(r)).not.toBeNull();
      expect(isRankableRole(r)).toBe(false);
    }
  });

  it("maps Vertical / Open-Source to TAGS (not rankable layers)", () => {
    expect(roleToTag("Vertical Specialist")).toBe("vertical");
    expect(roleToTag("Open-Source Ecosystem")).toBe("open_source");
    expect(roleToLayer("Vertical Specialist")).toBeNull();
  });
});

describe("isRankableVendor — investors/sovereigns drop out of rankings", () => {
  it("a PURE investor (only the Investor role) is NOT a rankable vendor", () => {
    expect(isRankableVendor(["Investor"])).toBe(false);
  });
  it("a pure sovereign / regulator is NOT rankable", () => {
    expect(isRankableVendor(["Sovereign / Regional AI"])).toBe(false);
    expect(isRankableVendor(["Regulator / Policy Actor"])).toBe(false);
  });
  it("a vendor that ALSO carries the Investor lens (Microsoft-like) IS rankable", () => {
    const roles: Role[] = ["Platform Vendor", "Model Provider", "Investor", "Infrastructure Player"];
    expect(isRankableVendor(roles)).toBe(true);
  });
});

describe("multi-membership across the standard stack", () => {
  const microsoftRoles: Role[] = ["Platform Vendor", "Application Vendor", "Investor", "Infrastructure Player", "Model Provider", "Cloud / Hosting Provider"];

  it("resolves to multiple standard layers, deduped, in canonical stack order", () => {
    const layers = layersForRoles(microsoftRoles);
    expect(layers).toEqual(["infra", "platform", "model", "application"]);
    // canonical order is the STANDARD_LAYERS order
    expect(layers).toEqual(STANDARD_LAYERS.filter((l) => layers.includes(l)));
    // Cloud/Hosting + Infrastructure both → infra, deduped to one entry
    expect(layers.filter((l) => l === "infra")).toHaveLength(1);
  });

  it("surfaces the Investor lens separately (a capital axis, not a layer)", () => {
    expect(lensesForRoles(microsoftRoles)).toContain("investor");
  });

  it("primary layer follows the primary role", () => {
    expect(primaryLayerForRoles("Model Provider", ["Investor"])).toBe("model");
    // a pure-investor primary → no layer
    expect(primaryLayerForRoles("Investor", [])).toBeNull();
  });

  it("tagsForRoles picks up vertical / open-source tags", () => {
    expect(tagsForRoles(["Application Vendor", "Vertical Specialist"])).toContain("vertical");
  });
});
