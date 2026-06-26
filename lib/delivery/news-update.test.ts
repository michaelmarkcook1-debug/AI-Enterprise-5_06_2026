import { describe, it, expect } from "vitest";
import {
  classifyDeliverySignal,
  applyDeliveryUpdate,
  type DeliveryExtraction,
  type DeliveryWriteDelegate,
} from "./news-update";

const NOW = new Date("2026-06-26T00:00:00.000Z");
const CITE = "https://www.example.com/accenture-openai-alliance";

const ex = (over: Partial<DeliveryExtraction> = {}): DeliveryExtraction => ({
  partnerId: "accenture",
  vendorId: "openai",
  partnershipTier: "direct_named",
  evidenceTier: "strong",
  action: "add",
  implication: "Accenture named as a delivery partner for OpenAI enterprise rollouts.",
  sourceUrl: CITE,
  ...over,
});

/** Minimal in-memory delegate recording writes (no DB, no LLM). */
function fakeDelegate(seed: Record<string, any> = {}) {
  const calls: { method: string; args: any }[] = [];
  const store = new Map<string, any>(Object.entries(seed));
  const keyOf = (w: any) => {
    const u = w.deliveryPartnerId_aiVendorId_partnershipTier;
    return `${u.deliveryPartnerId}|${u.aiVendorId}|${u.partnershipTier}`;
  };
  const matches = (v: any, where: any) =>
    v.deliveryPartnerId === where.deliveryPartnerId &&
    v.aiVendorId === where.aiVendorId &&
    (where.partnershipTier === undefined || v.partnershipTier === where.partnershipTier) &&
    (where.endedAt === null ? !v.endedAt : true);
  const delegate: DeliveryWriteDelegate = {
    async findUnique({ where }) {
      calls.push({ method: "findUnique", args: where });
      return store.get(keyOf(where)) ?? null;
    },
    async findFirst({ where }) {
      calls.push({ method: "findFirst", args: where });
      for (const v of store.values()) if (matches(v, where)) return v;
      return null;
    },
    async upsert({ where, create, update }) {
      calls.push({ method: "upsert", args: { where, create, update } });
      const k = keyOf(where);
      store.set(k, store.has(k) ? { ...store.get(k), ...update } : create);
      return store.get(k);
    },
    async update({ where, data }) {
      calls.push({ method: "update", args: { where, data } });
      return data;
    },
    async updateMany({ where, data }) {
      calls.push({ method: "updateMany", args: { where, data } });
      let count = 0;
      for (const [k, v] of store) {
        if (matches(v, where)) {
          store.set(k, { ...v, ...data });
          count += 1;
        }
      }
      return { count };
    },
  };
  return { delegate, calls, store };
}

describe("delivery self-update — classifier (stub)", () => {
  it("ignores non-AI / non-delivery news", async () => {
    const r = await classifyDeliverySignal({
      title: "Accenture reports quarterly earnings beat",
      snippet: "Revenue rose on consulting demand.",
      url: "https://x.com/a",
    });
    expect(r.data.isDeliverySignal).toBe(false);
    expect(r.data.partnerId).toBeNull();
  });

  it("flags a real SI×vendor delivery item and maps both ids", async () => {
    const r = await classifyDeliverySignal({
      title: "Accenture and OpenAI expand partnership to deploy agents",
      snippet: "The system integrator will implement OpenAI models for enterprise clients.",
      url: CITE,
    });
    expect(r.data.isDeliverySignal).toBe(true);
    expect(r.data.partnerId).toBe("accenture");
    expect(r.data.vendorId).toBe("openai");
  });
});

describe("delivery self-update — apply guards (no invention, citation required)", () => {
  it("rejects an unknown partner (no invented partners)", async () => {
    const { delegate, calls } = fakeDelegate();
    const r = await applyDeliveryUpdate(ex({ partnerId: "not-a-real-si" }), { delegate, now: NOW });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("unknown_partner");
    expect(calls.length).toBe(0); // no write attempted
  });

  it("rejects an unknown vendor", async () => {
    const { delegate } = fakeDelegate();
    const r = await applyDeliveryUpdate(ex({ vendorId: "not-a-vendor" }), { delegate, now: NOW });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("unknown_vendor");
  });

  it("rejects a write with NO real citation", async () => {
    const { delegate, calls } = fakeDelegate();
    const r = await applyDeliveryUpdate(ex({ sourceUrl: "" }), { delegate, now: NOW });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("no_citation");
    expect(calls.length).toBe(0);
    const r2 = await applyDeliveryUpdate(ex({ sourceUrl: "not a url" }), { delegate, now: NOW });
    expect(r2.applied).toBe(false);
    expect(r2.reason).toBe("no_citation");
  });

  it("ADDs a new partnership from a cited item as news_confirmed", async () => {
    const { delegate, store } = fakeDelegate();
    const r = await applyDeliveryUpdate(ex(), { delegate, now: NOW });
    expect(r.applied).toBe(true);
    const written = [...store.values()][0];
    expect(written.provenance).toBe("news_confirmed");
    expect(written.sourceUrls).toEqual([CITE]);
    expect(written.lastVerified).toEqual(NOW);
  });

  it("refuses an 'upgrade' that is not actually stronger than the existing row", async () => {
    const seed = {
      "accenture|openai|direct_named": {
        deliveryPartnerId: "accenture", aiVendorId: "openai", partnershipTier: "direct_named", evidenceTier: "strong", endedAt: null,
      },
    };
    const { delegate } = fakeDelegate(seed);
    const r = await applyDeliveryUpdate(ex({ action: "upgrade", evidenceTier: "moderate" }), { delegate, now: NOW });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe("not_an_upgrade");
  });

  it("mark_ended ends ONLY the cited tier, leaving other tiers of the pair active", async () => {
    const seed = {
      "ibm-consulting|openai|observed_implementer": {
        deliveryPartnerId: "ibm-consulting", aiVendorId: "openai", partnershipTier: "observed_implementer", evidenceTier: "moderate", endedAt: null,
      },
      "ibm-consulting|openai|direct_named": {
        deliveryPartnerId: "ibm-consulting", aiVendorId: "openai", partnershipTier: "direct_named", evidenceTier: "strong", endedAt: null,
      },
    };
    const { delegate, store } = fakeDelegate(seed);
    const r = await applyDeliveryUpdate(
      ex({ partnerId: "ibm-consulting", vendorId: "openai", action: "mark_ended", partnershipTier: "observed_implementer" }),
      { delegate, now: NOW },
    );
    expect(r.applied).toBe(true);
    expect(store.get("ibm-consulting|openai|observed_implementer").endedAt).toEqual(NOW); // cited tier ended
    expect(store.get("ibm-consulting|openai|direct_named").endedAt).toBeFalsy(); // other tier untouched
  });

  it("upgrade to a higher tier MOVES the tier (ends old row) — exactly one active row, no duplicate", async () => {
    const seed = {
      "accenture|openai|observed_implementer": {
        deliveryPartnerId: "accenture", aiVendorId: "openai", partnershipTier: "observed_implementer", evidenceTier: "moderate", endedAt: null,
      },
    };
    const { delegate, store } = fakeDelegate(seed);
    const r = await applyDeliveryUpdate(ex({ action: "upgrade", partnershipTier: "direct_named", evidenceTier: "strong" }), { delegate, now: NOW });
    expect(r.applied).toBe(true);
    const active = [...store.values()].filter((v) => !v.endedAt);
    expect(active).toHaveLength(1); // no parallel duplicate
    expect(active[0].partnershipTier).toBe("direct_named");
    expect(active[0].provenance).toBe("news_confirmed");
    const ended = [...store.values()].filter((v) => v.endedAt);
    expect(ended).toHaveLength(1);
    expect(ended[0].partnershipTier).toBe("observed_implementer"); // old tier ended, not deleted
  });

  it("mark_ended needs an active row; sets endedAt when one exists", async () => {
    const { delegate: empty } = fakeDelegate();
    const none = await applyDeliveryUpdate(ex({ action: "mark_ended" }), { delegate: empty, now: NOW });
    expect(none.applied).toBe(false);
    expect(none.reason).toBe("no_active_row_to_end");

    const seed = {
      "accenture|openai|direct_named": {
        deliveryPartnerId: "accenture", aiVendorId: "openai", partnershipTier: "direct_named", evidenceTier: "strong", endedAt: null,
      },
    };
    const { delegate, store } = fakeDelegate(seed);
    const ended = await applyDeliveryUpdate(ex({ action: "mark_ended" }), { delegate, now: NOW });
    expect(ended.applied).toBe(true);
    expect([...store.values()][0].endedAt).toEqual(NOW);
  });
});
