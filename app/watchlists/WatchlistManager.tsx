"use client";

import { useState } from "react";
import type { Watchlist } from "@/lib/intelligence/types";
import { OwnershipLegend, VendorNameWithOwnership, ownershipChipClassName } from "@/components/ownership-indicator";

type VendorOption = { id: string; name: string; ownershipType: string };

export function WatchlistManager({ initialWatchlists, vendorOptions }: { initialWatchlists: Watchlist[]; vendorOptions: VendorOption[] }) {
  const [watchlists, setWatchlists] = useState(initialWatchlists);
  const [name, setName] = useState("Board AI risk watch");
  const [selectedVendors, setSelectedVendors] = useState<string[]>(vendorOptions.slice(0, 4).map((vendor) => vendor.id));
  const [saving, setSaving] = useState(false);
  const vendorById = new Map(vendorOptions.map((vendor) => [vendor.id, vendor]));

  async function save() {
    setSaving(true);
    const response = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        vendors: selectedVendors,
        categories: ["Risk event", "Enterprise control", "Agentic AI"],
        industries: ["Financial services", "Public sector"],
        alertRules: { riskThreshold: 70, momentumChangePct: 10, categories: ["Risk event", "Enterprise control"] },
      }),
    });
    const data = await response.json();
    if (response.ok) setWatchlists([data.watchlist, ...watchlists]);
    setSaving(false);
  }

  function toggleVendor(id: string) {
    setSelectedVendors((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
      <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
        <h2 className="text-sm font-semibold">Create watchlist</h2>
        <div className="mt-3">
          <OwnershipLegend />
        </div>
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[#697362]">Name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-md border border-[#d8ded0] px-3 py-2 text-sm" />
        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-[#697362]">Vendors</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {vendorOptions.map((vendor) => {
            const active = selectedVendors.includes(vendor.id);
            return (
              <button key={vendor.id} onClick={() => toggleVendor(vendor.id)} className={`rounded-md border px-2 py-1 text-xs ${ownershipChipClassName(vendor.ownershipType, active)}`}>
                <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
              </button>
            );
          })}
        </div>
        <button onClick={save} disabled={saving} className="mt-5 rounded-md bg-[#192319] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Saving" : "Save watchlist"}
        </button>
      </section>
      <section className="rounded-lg border border-[#dfe4da] bg-white p-4">
        <h2 className="text-sm font-semibold">Active watchlists</h2>
        <div className="mt-3 divide-y divide-[#edf0ea]">
          {watchlists.map((watchlist) => (
            <div key={watchlist.id} className="py-3">
              <div className="font-medium">{watchlist.name}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs leading-5 text-[#66705f]">
                {watchlist.vendors.map((id) => {
                  const vendor = vendorById.get(id);
                  return (
                    <span key={id} className="rounded border border-[#d8ded0] px-2 py-1">
                      {vendor ? <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} /> : id}
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 text-xs leading-5 text-[#66705f]">
                Categories: {watchlist.categories.join(", ")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
