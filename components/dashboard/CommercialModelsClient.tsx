"use client";

import { useMemo, useState } from "react";
import { EvidenceBadge } from "@/components/intelligence-ui";
import type {
  AvailabilityStage,
  CommercialAvailability,
  CommercialModel,
  CommercialModelSource,
  ModelCategory,
  ModelDataStatus,
  OwnershipType,
  VendorModelSummary,
} from "@/lib/model-inventory/types";

type Props = {
  vendors: VendorModelSummary[];
  models: CommercialModel[];
  sources: CommercialModelSource[];
};

const OWNERSHIP_OPTIONS: (OwnershipType | "all")[] = [
  "all", "first_party", "hosted_third_party", "marketplace", "byollm", "open_weight", "underlying_product_model", "unknown",
];
const STAGE_OPTIONS: (AvailabilityStage | "all")[] = ["all", "ga", "preview", "beta", "deprecated", "retired", "unknown"];
const CATEGORY_OPTIONS: (ModelCategory | "all")[] = [
  "all", "llm_text", "multimodal", "reasoning", "coding", "embedding", "reranking", "guardrail_safety",
  "speech_audio", "image_generation", "video_generation", "ocr_document_ai", "time_series", "domain_specific", "unknown",
];
const COMMERCIAL_OPTIONS: (CommercialAvailability | "all")[] = [
  "all", "commercially_available", "commercially_available_preview", "enterprise_only", "api_available",
  "hosted_on_marketplace", "underlying_product_model", "not_commercially_available", "unknown",
];
const EVIDENCE_OPTIONS = ["all", "E0", "E1", "E2", "E3", "E4", "E5"] as const;
const DATA_STATUS_OPTIONS: (ModelDataStatus | "all")[] = [
  "all", "verified", "documented", "estimated", "inferred", "seed", "stale", "unknown", "disputed",
];

export default function CommercialModelsClient({ vendors, models, sources }: Props) {
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [ownership, setOwnership] = useState<(typeof OWNERSHIP_OPTIONS)[number]>("all");
  const [stage, setStage] = useState<(typeof STAGE_OPTIONS)[number]>("all");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>("all");
  const [commercial, setCommercial] = useState<(typeof COMMERCIAL_OPTIONS)[number]>("all");
  const [evidence, setEvidence] = useState<(typeof EVIDENCE_OPTIONS)[number]>("all");
  const [dataStatus, setDataStatus] = useState<(typeof DATA_STATUS_OPTIONS)[number]>("all");
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const visibleVendors = useMemo(() => {
    if (vendorFilter === "all") return vendors;
    return vendors.filter((v) => v.vendorId === vendorFilter);
  }, [vendors, vendorFilter]);

  function visibleModelsForVendor(vendorId: string): CommercialModel[] {
    return models
      .filter((m) => m.vendorId === vendorId)
      .filter((m) => ownership === "all" || m.ownershipType === ownership)
      .filter((m) => stage === "all" || m.availabilityStage === stage)
      .filter((m) => category === "all" || m.modelCategory === category)
      .filter((m) => commercial === "all" || m.commercialAvailability === commercial)
      .filter((m) => evidence === "all" || m.evidenceGrade === evidence)
      .filter((m) => dataStatus === "all" || m.dataStatus === dataStatus);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <FilterSelect label="Vendor" value={vendorFilter} onChange={setVendorFilter} options={[{ value: "all", label: "All vendors" }, ...vendors.map((v) => ({ value: v.vendorId, label: v.vendorName }))]} />
        <FilterSelect label="Ownership" value={ownership} onChange={(v) => setOwnership(v as typeof ownership)} options={OWNERSHIP_OPTIONS.map((v) => ({ value: v, label: labelize(v) }))} />
        <FilterSelect label="Stage" value={stage} onChange={(v) => setStage(v as typeof stage)} options={STAGE_OPTIONS.map((v) => ({ value: v, label: labelize(v) }))} />
        <FilterSelect label="Category" value={category} onChange={(v) => setCategory(v as typeof category)} options={CATEGORY_OPTIONS.map((v) => ({ value: v, label: labelize(v) }))} />
        <FilterSelect label="Commercial" value={commercial} onChange={(v) => setCommercial(v as typeof commercial)} options={COMMERCIAL_OPTIONS.map((v) => ({ value: v, label: labelize(v) }))} />
        <FilterSelect label="Evidence" value={evidence} onChange={(v) => setEvidence(v as typeof evidence)} options={EVIDENCE_OPTIONS.map((v) => ({ value: v, label: v.toUpperCase() }))} />
        <FilterSelect label="Data status" value={dataStatus} onChange={(v) => setDataStatus(v as typeof dataStatus)} options={DATA_STATUS_OPTIONS.map((v) => ({ value: v, label: labelize(v) }))} />
      </div>

      {/* Vendor cards */}
      <div className="space-y-2">
        {visibleVendors.map((v) => {
          const vendorModels = visibleModelsForVendor(v.vendorId);
          const isExpanded = expandedVendor === v.vendorId;
          return (
            <article key={v.vendorId} className="rounded-md border border-[#e6dcc3] bg-white dark:border-[#223a2e] dark:bg-[#081410]">
              <button
                type="button"
                onClick={() => setExpandedVendor(isExpanded ? null : v.vendorId)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-[#faf6ec] dark:hover:bg-[#0d1f17]"
                aria-expanded={isExpanded}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">{v.vendorName}</span>
                    {v.isInfrastructureOnly && (
                      <span className="rounded-full border border-[#d6c9a8] bg-[#f6f1e3] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#2e3f57] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#c2d1e0]">Infrastructure / investment exposure</span>
                    )}
                    {v.refreshRequired && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">Source refresh required</span>
                    )}
                    {!v.isInfrastructureOnly && !v.refreshRequired && v.uncertaintyBadge && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">{v.uncertaintyBadge}</span>
                    )}
                    <span className="rounded-full border border-[#e6dcc3] bg-[#faf6ec] px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#a7bacd]">{labelize(v.dataStatus)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">
                    <span><strong className="text-[#123d2c] dark:text-[#d8e2ec] tabular-nums">{v.firstPartyActiveCount}</strong> first-party</span>
                    <span><strong className="text-[#123d2c] dark:text-[#d8e2ec] tabular-nums">{v.hostedThirdPartyCount}</strong> hosted 3P</span>
                    {v.previewBetaCount > 0 && <span>{v.previewBetaCount} preview/beta</span>}
                    {v.deprecatedRetiredCount > 0 && <span className="text-rose-700 dark:text-rose-300">{v.deprecatedRetiredCount} deprecated/retired</span>}
                    {v.primaryModelFamilies.length > 0 && (
                      <span>Families: {v.primaryModelFamilies.join(", ")}</span>
                    )}
                    <span>Last verified {v.lastVerifiedAt ?? "—"}</span>
                  </div>
                </div>
                <span aria-hidden className="text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{isExpanded ? "Hide" : "Expand"} ▾</span>
              </button>

              {isExpanded && (
                <div className="border-t border-[#e6dcc3] bg-[#faf6ec] p-3 dark:border-[#223a2e] dark:bg-[#081c30]/40">
                  {vendorModels.length === 0 ? (
                    <EmptyVendorState summary={v} />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1080px] text-left text-xs">
                        <thead className="text-xs uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">
                          <tr>
                            <th className="py-2 pr-3">Model</th>
                            <th className="py-2 pr-3">Model ID</th>
                            <th className="py-2 pr-3">Owner</th>
                            <th className="py-2 pr-3">Hosted by</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3">Modality</th>
                            <th className="py-2 pr-3">Stage</th>
                            <th className="py-2 pr-3">Commercial</th>
                            <th className="py-2 pr-3">Evidence</th>
                            <th className="py-2 pr-3">Confidence</th>
                            <th className="py-2 pr-3">Source</th>
                            <th className="py-2">Uncertainty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ece4d0] dark:divide-[#223a2e]">
                          {vendorModels.map((m) => (
                            <tr key={m.id}>
                              <td className="py-2 pr-3 font-medium text-[#123d2c] dark:text-[#eef3f8]">
                                {m.modelName}
                                {m.ownershipType === "hosted_third_party" && (
                                  <span className="ml-2 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">Hosted third-party — not vendor-owned</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs text-[#5b6b7f] dark:text-[#8fa5bb]">{m.modelId ?? "—"}</td>
                              <td className="py-2 pr-3">{m.ownerVendorName}</td>
                              <td className="py-2 pr-3">{m.hostingVendorName ?? "—"}</td>
                              <td className="py-2 pr-3 capitalize">{m.modelCategory.replace(/_/g, " ")}</td>
                              <td className="py-2 pr-3 capitalize">{m.modality.join(", ")}</td>
                              <td className="py-2 pr-3"><StageBadge stage={m.availabilityStage} /></td>
                              <td className="py-2 pr-3 capitalize">{m.commercialAvailability.replace(/_/g, " ")}</td>
                              <td className="py-2 pr-3"><EvidenceBadge grade={m.evidenceGrade} /></td>
                              <td className="py-2 pr-3 tabular-nums">{m.confidenceScore}/100</td>
                              <td className="py-2 pr-3">
                                {m.sourceUrls[0] ? (
                                  <a href={m.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="text-[#b08d2f] underline hover:text-[#1f3f37] dark:text-emerald-300 dark:hover:text-emerald-200">
                                    {sourceShortName(m.sourceUrls[0])}
                                  </a>
                                ) : (
                                  <span className="text-[#5b6b7f] dark:text-[#8fa5bb]">—</span>
                                )}
                              </td>
                              <td className="py-2 text-[#54647a] dark:text-[#a7bacd]">{m.uncertaintyNote.slice(0, 110)}{m.uncertaintyNote.length > 110 ? "…" : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {visibleVendors.length === 0 && (
          <div className="rounded-md border border-dashed border-[#e6dcc3] p-4 text-sm text-[#5b6b7f] dark:border-[#2a4a6b] dark:text-[#8fa5bb]">
            No vendors match these filters.
          </div>
        )}
      </div>

      {/* Sources footer */}
      <details className="rounded-md border border-[#e6dcc3] bg-[#faf6ec] p-3 text-xs dark:border-[#223a2e] dark:bg-[#0d1f17]">
        <summary className="cursor-pointer font-semibold text-[#123d2c] dark:text-[#d8e2ec]">Source registry ({sources.length})</summary>
        <ul className="mt-2 space-y-1">
          {sources.map((s) => (
            <li key={s.id} className="text-xs text-[#54647a] dark:text-[#a7bacd]">
              <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#b08d2f] underline dark:text-emerald-300">{s.sourceName}</a>
              {" "}· {s.sourceType.replace(/_/g, " ")} · {s.evidenceGrade} · captured {s.sourceDate}
              {s.notes && <span className="ml-1 italic">— {s.notes}</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function EmptyVendorState({ summary }: { summary: VendorModelSummary }) {
  if (summary.isInfrastructureOnly) {
    return (
      <p className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
        Infrastructure / investment-exposure vendor. No first-party commercial LLM model is recorded — exposure is via semiconductor, hardware, or platform supply chain.
      </p>
    );
  }
  if (summary.refreshRequired) {
    return (
      <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
        Model inventory unavailable — source validation required.
      </p>
    );
  }
  if (!summary.hasSourceBackedFirstParty && summary.hostedThirdPartyCount === 0) {
    return (
      <p className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
        No source-backed first-party commercial LLM model currently recorded.
      </p>
    );
  }
  return <p className="text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">No models match the active filters.</p>;
}

function StageBadge({ stage }: { stage: AvailabilityStage }) {
  const tone = stage === "ga" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : stage === "preview" || stage === "beta" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    : stage === "deprecated" || stage === "retired" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
    : "bg-[#ece3cb] text-[#2e3f57] dark:bg-[#143049] dark:text-[#c2d1e0]";
  return <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>{stage}</span>;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#5b6b7f] dark:text-[#8fa5bb]">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-[#e0d6ba] bg-white px-2 py-1.5 text-xs dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function sourceShortName(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}
