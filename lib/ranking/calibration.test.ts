import { describe, it, expect } from "vitest";
import {
  calibrationBand,
  STRONG_COVERAGE,
  STRONG_CONFIDENCE,
  type CalibrationBand,
} from "./calibration";

describe("calibrationBand — within-category standing, gated by real evidence", () => {
  it("a well-evidenced category #1 is a Leader (Anthropic frontier: #1/14, 100% cov, 83 conf)", () => {
    const c = calibrationBand(1, 14, 1.0, 83);
    expect(c.band).toBe("Leader");
    expect(c.limitedEvidence).toBe(false);
    expect(c.standingLabel).toBe("#1 of 14");
  });

  it("the ONE thin-evidence #1 never reads as a confident Leader (Cerebras ai_silicon: #1/4, 67% cov, 60 conf)", () => {
    const c = calibrationBand(1, 4, 0.67, 60);
    expect(c.band).toBe("Emerging leader"); // leads its field, but the lead rests on thin evidence
    expect(c.band).not.toBe("Leader");
    expect(c.limitedEvidence).toBe(true);
  });

  it("evidence gate needs BOTH coverage AND confidence — either one short hedges the top badge", () => {
    expect(calibrationBand(1, 5, STRONG_COVERAGE, STRONG_CONFIDENCE - 1).band).toBe("Emerging leader"); // conf short
    expect(calibrationBand(1, 5, STRONG_COVERAGE - 0.01, STRONG_CONFIDENCE).band).toBe("Emerging leader"); // cov short
    expect(calibrationBand(1, 5, STRONG_COVERAGE, STRONG_CONFIDENCE).band).toBe("Leader"); // both exactly at the bar
  });

  it("descends Strong → Contender → Emerging by within-category percentile", () => {
    // n=14 so the cut-points land on distinct ranks.
    const bandAt = (rank: number): CalibrationBand => calibrationBand(rank, 14, 1.0, 80).band;
    expect(bandAt(2)).toBe("Leader"); // p=0.923 ≥ 0.85, well-evidenced
    expect(bandAt(4)).toBe("Strong"); // p=0.769
    expect(bandAt(8)).toBe("Contender"); // p=0.462
    expect(bandAt(13)).toBe("Emerging"); // p=0.077
    expect(bandAt(14)).toBe("Emerging"); // p=0
  });

  it("a sole ranked vendor is top of its field (percentile 1), gated on its own evidence", () => {
    expect(calibrationBand(1, 1, 1.0, 90).band).toBe("Leader");
    expect(calibrationBand(1, 1, 0.5, 50).band).toBe("Emerging leader"); // alone, but thin
  });

  it("is presentation only — identical rank/evidence in tiny vs large fields both label #1 sensibly", () => {
    // #1 of 3 (crm) and #1 of 14 (frontier) are both Leaders when well-evidenced —
    // the band never reorders anything; it only describes standing.
    expect(calibrationBand(1, 3, 1.0, 80).band).toBe("Leader");
    expect(calibrationBand(1, 14, 1.0, 80).band).toBe("Leader");
  });

  it("clamps a rank beyond the field / a zero count rather than dividing by zero", () => {
    expect(() => calibrationBand(9, 4, 1, 80)).not.toThrow();
    expect(calibrationBand(9, 4, 1, 80).standingLabel).toBe("#4 of 4"); // clamped
    expect(() => calibrationBand(1, 0, 1, 80)).not.toThrow();
    expect(calibrationBand(1, 0, 1, 80).percentile).toBe(1);
  });

  it("percentile is a pure function of rank/count, independent of the evidence gate", () => {
    const strong = calibrationBand(3, 5, 1.0, 90);
    const thin = calibrationBand(3, 5, 0.4, 40);
    expect(strong.percentile).toBe(thin.percentile); // same standing…
    expect(strong.limitedEvidence).toBe(false);
    expect(thin.limitedEvidence).toBe(true); // …different evidence flag
  });
});
