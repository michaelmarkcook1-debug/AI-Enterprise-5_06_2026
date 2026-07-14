"use client";

// Implementation partners (IT-services / GSI delivery) for a vendor profile.
// ───────────────────────────────────────────────────────────────────────────
// Curated analyst data, shown WITH its provenance. The three partnership tiers
// are rendered as DISTINCT groups and NEVER merged. Every row carries tier +
// evidence + provenance + source. Observed/plausible never renders as confirmed
// direct. Filtering is local UI state only (no fetch/poll — lean public shell).

import { useMemo, useState } from "react";
import type { DeliveryPartnershipRow } from "@/lib/delivery/repository";
import type { PartnershipTier, EvidenceTierPartnership } from "@/lib/delivery/seed";

const MUTED = "text-[#54647a] dark:text-[#a7bacd]";

const TIER_META: Record<PartnershipTier, { label: string; blurb: string; tone: string }> = {
  direct_named: {
    label: "Direct named partner",
    blurb: "Formally named by the model company.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  cloud_certified: {
    label: "Cloud-certified integrator",
    blurb: "Validated through AWS, Azure or Google Cloud.",
    tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  },
  observed_implementer: {
    label: "Observed implementer",
    blurb: "Publicly deploying/integrating the model — not necessarily formally approved.",
    tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
};
const TIER_ORDER: PartnershipTier[] = ["direct_named", "cloud_certified", "observed_implementer"];

const EVIDENCE_META: Record<EvidenceTierPartnership, { label: string; tone: string }> = {
  strong: { label: "Strong evidence", tone: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  moderate: { label: "Moderate evidence", tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  plausible_unverified: { label: "Plausible (unverified)", tone: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300" },
};

function Chip({ label, tone }: { label: string; tone: string }) {
  return <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function ProvenanceChip({ provenance }: { provenance: DeliveryPartnershipRow["provenance"] }) {
  const live = provenance === "news_confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium ${
        live
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
      {live ? "News-confirmed" : "Analyst-curated"}
    </span>
  );
}

function MiniChips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className="rounded border border-[#e0d6ba] bg-[#faf6ec] px-1.5 py-0.5 text-xs text-[#475a72] dark:border-[#2a4a6b] dark:bg-[#143049] dark:text-[#c2d1e0]">
          {it}
        </span>
      ))}
    </div>
  );
}

export default function ImplementationPartnersPanel({
  vendorName,
  partnerships,
  industries,
  regions,
}: {
  vendorName: string;
  partnerships: DeliveryPartnershipRow[];
  industries: string[];
  regions: string[];
}) {
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");

  const filtered = useMemo(
    () =>
      partnerships.filter(
        (p) =>
          (!industry || p.industries.includes(industry)) &&
          (!region || p.regions.includes(region)),
      ),
    [partnerships, industry, region],
  );

  const selectCls =
    "rounded border border-[#e0d6ba] bg-white px-2 py-1 text-xs dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]";

  return (
    <div>
      <p className={`mb-3 text-xs leading-5 ${MUTED}`}>
        IT-services / GSI partners delivering {vendorName} in production. Source:{" "}
        <span className="font-medium">AnalystGenius curated, 2026-06-26</span>. The three categories below are
        kept <strong>distinct</strong> — an observed implementer is not a formally-named direct partner.
        Each row carries its tier, evidence strength and provenance; unconfirmed rows are analyst-curated,
        pending external confirmation.
      </p>

      {(industries.length > 0 || regions.length > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className={MUTED}>Filter:</span>
          {industries.length > 0 && (
            <select className={selectCls} value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Filter by industry">
              <option value="">All industries</option>
              {industries.map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
          )}
          {regions.length > 0 && (
            <select className={selectCls} value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region">
              <option value="">All regions</option>
              {regions.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          )}
          {(industry || region) && (
            <button type="button" onClick={() => { setIndustry(""); setRegion(""); }} className={`underline underline-offset-2 ${MUTED}`}>
              Clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>
          {partnerships.length === 0
            ? "No implementation partners on record yet."
            : "No partners match these filters."}
        </p>
      ) : (
        <div className="space-y-5">
          {TIER_ORDER.map((tier) => {
            const rows = filtered.filter((p) => p.partnershipTier === tier);
            if (rows.length === 0) return null;
            const meta = TIER_META[tier];
            return (
              <section key={tier}>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <Chip label={meta.label} tone={meta.tone} />
                  <span className={`text-xs ${MUTED}`}>{rows.length} · {meta.blurb}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rows.map((p) => (
                    <div key={`${p.deliveryPartnerId}-${p.partnershipTier}`} className="rounded-lg border border-[#e9e0c8] p-3 dark:border-[#223a2e]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">
                          {p.partnerName}
                          {p.platformHybrid && (
                            <span className="ml-1.5 rounded border border-fuchsia-300 bg-fuchsia-50 px-1 py-0.5 text-[9px] font-semibold text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                              platform-integrator hybrid
                            </span>
                          )}
                        </span>
                        <ProvenanceChip provenance={p.provenance} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip label={EVIDENCE_META[p.evidenceTier].label} tone={EVIDENCE_META[p.evidenceTier].tone} />
                      </div>
                      <MiniChips items={p.industries} />
                      <MiniChips items={p.regions} />
                      {p.source && (
                        <p className={`mt-2 text-xs ${MUTED}`}>
                          Source: {p.source}
                          {p.provenance === "analyst_curated_seed"
                            ? " — pending external confirmation"
                            : ""}
                          {p.sourceUrls[0] ? (
                            <>
                              {" · "}
                              <a href={p.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">citation</a>
                            </>
                          ) : null}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
