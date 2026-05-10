import { describe, expect, it } from "vitest";
import {
  getIpoForecastRow,
  isMonthLevelIpoForecastEnabled,
  listIpoForecastRows,
  postIpoModelDisabledReason,
} from "./intelligence";
import { IPO_FORECASTS, POST_IPO_FLUCTUATION_BANDS } from "./seed";

describe("IPO forecast truthfulness model", () => {
  it("labels every IPO forecast with data status, evidence, confidence, and model warning", () => {
    expect(IPO_FORECASTS.length).toBeGreaterThanOrEqual(13);
    expect(IPO_FORECASTS.every((forecast) => forecast.dataStatus)).toBe(true);
    expect(IPO_FORECASTS.every((forecast) => forecast.evidenceGrade)).toBe(true);
    expect(IPO_FORECASTS.every((forecast) => forecast.confidenceScore > 0)).toBe(true);
    expect(IPO_FORECASTS.every((forecast) => forecast.warning.includes("modelled IPO forecast"))).toBe(true);
  });

  it("does not output dollar share-price paths without a verified offer price", () => {
    expect(IPO_FORECASTS.every((forecast) => forecast.hasVerifiedOfferPrice === false)).toBe(true);
    expect(POST_IPO_FLUCTUATION_BANDS.every((band) => band.relativeTo === "ipo_offer_price")).toBe(true);
  });

  it("disables no-reliable-month and non-standalone IPO forecasts", () => {
    const hebbia = getIpoForecastRow("hebbia");
    const rogo = getIpoForecastRow("rogo");
    const xai = getIpoForecastRow("xai");

    expect(hebbia).toBeTruthy();
    expect(rogo).toBeTruthy();
    expect(xai).toBeTruthy();
    expect(isMonthLevelIpoForecastEnabled(hebbia!.forecast)).toBe(false);
    expect(isMonthLevelIpoForecastEnabled(rogo!.forecast)).toBe(false);
    expect(xai!.forecast.forecastStatus).toBe("not_modelled_standalone");
    expect(postIpoModelDisabledReason(xai!.forecast)).toContain("xAI standalone IPO is not modelled");
  });
});

describe("post-IPO fluctuation bands", () => {
  it("gives each active band provider a complete M1-M10 percentage band", () => {
    const rows = listIpoForecastRows();
    const activeRows = rows.filter((row) => row.bands.length > 0);

    expect(activeRows.length).toBeGreaterThan(5);
    activeRows.forEach((row) => {
      expect(row.bands).toHaveLength(10);
      expect(row.bands.map((band) => band.monthNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  it("keeps every band ordered and explicitly estimated", () => {
    POST_IPO_FLUCTUATION_BANDS.forEach((band) => {
      expect(band.lowPct).toBeLessThanOrEqual(band.highPct);
      expect(band.dataStatus).toBe("estimated");
      expect(band.uncertaintyNote).toContain("not a share-price prediction");
    });
  });

  it("keeps disabled providers without post-IPO bands", () => {
    expect(getIpoForecastRow("hebbia")?.bands).toEqual([]);
    expect(getIpoForecastRow("rogo")?.bands).toEqual([]);
    expect(getIpoForecastRow("xai")?.bands).toEqual([]);
  });
});
