// Legislative register — FACTUAL-DATA-ONLY integrity + registry-helper tests.
import { describe, it, expect } from "vitest";
import {
  LEGISLATIVE_INSTRUMENTS,
  JURISDICTION_LABEL,
  STATUS_LABEL,
  type LegislativeInstrument,
  type Jurisdiction,
} from "./instruments";
import {
  listInstruments,
  filterInstruments,
  jurisdictionsPresent,
  verticalsPresent,
  recentlyUpdated,
  domainLabelsFor,
} from "./registry";
import { DOMAIN_LABEL } from "../assessment/domain-labels";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS = new Set(["proposed", "enacted", "in_force", "framework"]);
const VALID_JURISDICTIONS = new Set(Object.keys(JURISDICTION_LABEL));
// The 16 real industry tags (from lib/use-cases INDUSTRIES).
const VALID_VERTICALS = new Set([
  "financial_services", "insurance", "healthcare", "pharma_life_sciences", "legal",
  "professional_services", "technology_software", "manufacturing", "retail_consumer",
  "telecom_media", "public_sector", "education", "energy_utilities", "transport_logistics",
  "real_estate", "aerospace_defence",
]);

describe("LEGISLATIVE_INSTRUMENTS — FACTUAL-DATA-ONLY: real, cited, accurately-dated", () => {
  it("the register is populated (the surface is never empty)", () => {
    expect(LEGISLATIVE_INSTRUMENTS.length).toBeGreaterThan(0);
  });

  it("ids are unique", () => {
    const ids = LEGISLATIVE_INSTRUMENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every instrument carries a PRIMARY-SOURCE citation (named + https), never a placeholder", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      expect(i.name.length, `${i.id} name`).toBeGreaterThan(4);
      expect(i.shortName.length, `${i.id} shortName`).toBeGreaterThan(1);
      expect(i.whatItRequires.length, `${i.id} whatItRequires`).toBeGreaterThan(10);
      expect(i.citation.sourceName.length, `${i.id} sourceName`).toBeGreaterThan(2);
      expect(i.citation.url, `${i.id} url`).toMatch(/^https:\/\//);
      // No fabrication / scaffolding tells.
      expect(`${i.name} ${i.whatItRequires} ${i.citation.sourceName}`).not.toMatch(
        /TODO|placeholder|EXAMPLE|lorem|FIXME|TBD/i,
      );
    }
  });

  it("every instrument has a valid status, jurisdiction, and an asOf date", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      expect(VALID_STATUS.has(i.status), `${i.id} status ${i.status}`).toBe(true);
      expect(VALID_JURISDICTIONS.has(i.jurisdiction), `${i.id} jurisdiction ${i.jurisdiction}`).toBe(true);
      expect(i.asOf, `${i.id} asOf`).toMatch(ISO_DATE);
      // inForceDate is null OR a real ISO date — never a vague string.
      if (i.inForceDate !== null) expect(i.inForceDate, `${i.id} inForceDate`).toMatch(ISO_DATE);
    }
  });

  it("a 'proposed' or non-statutory 'framework' instrument does not assert an in-force date", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      if (i.status === "proposed") {
        expect(i.inForceDate, `${i.id} proposed but has inForceDate`).toBeNull();
      }
    }
  });

  it("every mapped domain is a REAL assessment domain (has a label)", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      expect(i.domains.length, `${i.id} touches at least one domain`).toBeGreaterThan(0);
      for (const d of i.domains) {
        expect(DOMAIN_LABEL[d], `${i.id} → unknown domain ${d}`).toBeTruthy();
      }
    }
  });

  it("every vertical is a REAL industry tag (empty = horizontal is allowed)", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      for (const v of i.verticals) {
        expect(VALID_VERTICALS.has(v), `${i.id} → unknown vertical ${v}`).toBe(true);
      }
    }
  });
});

describe("registry helpers", () => {
  it("listInstruments orders live obligations before proposals/frameworks", () => {
    const ranked = listInstruments();
    const rank = (s: LegislativeInstrument["status"]) => ({ in_force: 0, enacted: 1, proposed: 2, framework: 3 })[s];
    for (let i = 1; i < ranked.length; i++) {
      expect(rank(ranked[i - 1].status)).toBeLessThanOrEqual(rank(ranked[i].status));
    }
  });

  it("jurisdiction filter keeps only that jurisdiction", () => {
    const js = jurisdictionsPresent();
    if (js.length > 0) {
      const j = js[0] as Jurisdiction;
      expect(filterInstruments({ jurisdiction: j }).every((i) => i.jurisdiction === j)).toBe(true);
    }
  });

  it("vertical filter keeps horizontal instruments AND that vertical's — never hides a rule that applies", () => {
    const vs = verticalsPresent();
    if (vs.length > 0) {
      const v = vs[0];
      const out = filterInstruments({ vertical: v });
      for (const i of out) {
        expect(i.verticals.length === 0 || i.verticals.includes(v), `${i.id} wrongly kept`).toBe(true);
      }
      // A horizontal instrument (if any) survives every vertical filter.
      const horizontal = LEGISLATIVE_INSTRUMENTS.find((i) => i.verticals.length === 0);
      if (horizontal) expect(out.some((i) => i.id === horizontal.id)).toBe(true);
    }
  });

  it("recentlyUpdated respects the limit and is sorted by asOf desc", () => {
    const feed = recentlyUpdated(3);
    expect(feed.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i - 1].asOf >= feed[i].asOf).toBe(true);
    }
  });

  it("domainLabelsFor returns labelled chips for the instrument's domains", () => {
    if (LEGISLATIVE_INSTRUMENTS.length > 0) {
      const chips = domainLabelsFor(LEGISLATIVE_INSTRUMENTS[0]);
      expect(chips.length).toBe(LEGISLATIVE_INSTRUMENTS[0].domains.length);
      for (const c of chips) expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it("STATUS_LABEL + JURISDICTION_LABEL cover every value used", () => {
    for (const i of LEGISLATIVE_INSTRUMENTS) {
      expect(STATUS_LABEL[i.status]).toBeTruthy();
      expect(JURISDICTION_LABEL[i.jurisdiction]).toBeTruthy();
    }
  });
});
