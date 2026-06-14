import { Panel, SeedDataBadge } from "@/components/intelligence-ui";
import {
  getAllVendorSummaries,
  getCommercialModels,
  getCommercialModelSources,
  getDashboardSummary,
} from "@/lib/model-inventory/repository";
import CommercialModelsClient from "./CommercialModelsClient";

/**
 * Dashboard card: "Commercial LLM Models by Vendor".
 *
 * Server component — fetches the model + summary inventory from the
 * repository and hands it to the interactive client component for filters,
 * expansion, and the detail table.
 */
export default function CommercialModelsCard() {
  const summary = getDashboardSummary();
  const vendors = getAllVendorSummaries();
  const models = getCommercialModels();
  const sources = getCommercialModelSources();

  return (
    <Panel
      title="Commercial LLM Models by Vendor"
      action={
        // Flip green once the inventory contains verified first-party rows
        // AND there are no stale entries. Mixed states stay seed-labelled so
        // operators see they need to refresh.
        <SeedDataBadge
          label={summary.vendorsWithFirstPartyModels > 0 && summary.staleInventoryCount === 0 ? "Source-backed verified" : "Source-backed seed inventory"}
          provenance={summary.vendorsWithFirstPartyModels > 0 && summary.staleInventoryCount === 0 ? "live" : "seed"}
          reason="Records cite official vendor docs; live API verification flips dataStatus to 'verified'."
        />
      }
    >
      <p className="mb-4 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">
        Source-backed model availability, separated by owned models, hosted third-party models, and uncertain entries.
        Hosted third-party models keep the original owner — never reattributed to the host platform.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <SummaryStat label="Tracked vendors" value={summary.totalTrackedVendors} />
        <SummaryStat label="With first-party" value={summary.vendorsWithFirstPartyModels} tone="ok" />
        <SummaryStat label="With hosted 3P" value={summary.vendorsWithHostedThirdPartyModels} tone="info" />
        <SummaryStat label="Unknown / unverified" value={summary.vendorsUnknownOrUnverified} tone="warn" />
        <SummaryStat label="Stale entries" value={summary.staleInventoryCount} tone="warn" />
        <SummaryStat label="Latest source date" value={summary.latestSourceRefresh ?? "—"} compact />
      </div>

      <CommercialModelsClient vendors={vendors} models={models} sources={sources} />
    </Panel>
  );
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "warn" | "info" | "neutral";
  compact?: boolean;
}) {
  const toneClass = tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
    : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      : tone === "info"
        ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300"
        : "border-[#e6dcc3] bg-[#faf6ec] text-[#475a72] dark:border-[#1d3a57] dark:bg-[#0c2238] dark:text-[#c2d1e0]";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className={`mt-0.5 ${compact ? "text-xs font-mono" : "text-lg font-semibold tabular-nums"}`}>{value}</div>
    </div>
  );
}
