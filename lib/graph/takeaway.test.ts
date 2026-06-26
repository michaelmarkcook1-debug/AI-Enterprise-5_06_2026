import { describe, it, expect } from "vitest";
import { deriveGraphTakeaway } from "./takeaway";
import { projectExposureToDependencyEdges } from "./dependency-projection";
import { EXPOSURE_NODES } from "../investing/exposure-map-data";

const labelById = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
const label = (id: string) => labelById.get(id) ?? id;

describe("deriveGraphTakeaway", () => {
  const edges = projectExposureToDependencyEdges();
  const t = deriveGraphTakeaway(edges, label);

  it("returns both a chokepoint and a ubiquity signal", () => {
    expect(t).not.toBeNull();
    expect(t!.chokepoints.length).toBeGreaterThan(0);
    expect(t!.ubiquity).toBeTruthy();
  });

  it("chokepoints reflect compute/cloud/capital leverage (silicon/cloud), NOT open-weight model in-degree", () => {
    // TSMC / NVIDIA are the silicon chokepoints labs depend on.
    expect(t!.chokepoints).toMatch(/TSMC|NVIDIA/);
    // Open-weight model providers must NOT be named as pricing-power chokepoints.
    expect(t!.chokepoints).not.toMatch(/Meta|Mistral/);
  });

  it("the 'pricing power' claim lives ONLY on the chokepoint line", () => {
    expect(t!.chokepoints.toLowerCase()).toContain("pricing power");
    expect(t!.ubiquity!.toLowerCase()).toContain("not pricing power");
  });

  it("ubiquity surfaces widely-integrated models, framed as ubiquity not leverage", () => {
    expect(t!.ubiquity!).toMatch(/Meta|Mistral/);
    expect(t!.ubiquity!.toLowerCase()).toMatch(/ubiquity|switching exposure/);
  });
});
