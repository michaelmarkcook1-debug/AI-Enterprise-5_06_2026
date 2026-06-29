"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  BatchReviewResult,
  BatchReviewFilters,
  BatchReviewPaging,
} from "@/lib/services/batch-review";

interface Props {
  result: BatchReviewResult;
  filters: BatchReviewFilters;
  paging: BatchReviewPaging;
  hasDatabase: boolean;
  adminToken?: string;
}

export default function BatchReview({ result, filters, paging, hasDatabase, adminToken }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [token, setToken] = useState(adminToken ?? "");
  const [reviewerId, setReviewerId] = useState("admin@local");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState<null | { action: "approve" | "reject" | "defer"; done: number; total: number; failed: number }>(null);

  function updateFilter(name: string, value: string | undefined) {
    const u = new URLSearchParams(window.location.search);
    if (!value) u.delete(name);
    else u.set(name, value);
    // Reset offset when filters change.
    if (name !== "offset") u.delete("offset");
    startTransition(() => router.replace(`/admin/evidence/batch?${u.toString()}`));
  }

  function setOffset(next: number) {
    const u = new URLSearchParams(window.location.search);
    if (next <= 0) u.delete("offset");
    else u.set("offset", String(next));
    startTransition(() => router.replace(`/admin/evidence/batch?${u.toString()}`));
  }

  async function singleAction(id: string, action: "approve" | "reject" | "defer"): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/admin/evidence/batch-action/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-admin-token": token } : {}),
      },
      body: JSON.stringify({ action, reviewerId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  }

  async function act(id: string, action: "approve" | "reject" | "defer") {
    setBusy(id);
    setError(null);
    try {
      const result = await singleAction(id, action);
      if (!result.ok) throw new Error(result.error);
      // Refresh the page to drop the row from the working set.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Run a bulk action across N proposal ids with limited concurrency.
   * Progress + failure count surfaced live; page refreshes once at the end
   * so the working set updates in one paint. */
  async function bulkAct(ids: string[], action: "approve" | "reject" | "defer") {
    if (ids.length === 0) return;
    setError(null);
    setBulkRunning({ action, done: 0, total: ids.length, failed: 0 });
    const concurrency = 5;
    let cursor = 0;
    let done = 0;
    let failed = 0;
    const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
      while (cursor < ids.length) {
        const idx = cursor++;
        const id = ids[idx];
        const result = await singleAction(id, action);
        done += 1;
        if (!result.ok) failed += 1;
        setBulkRunning({ action, done, total: ids.length, failed });
      }
    });
    await Promise.all(workers);
    setBulkRunning(null);
    if (failed > 0) setError(`Bulk ${action}: ${failed}/${ids.length} failed — see server logs.`);
    router.refresh();
  }

  function confirmAndBulk(action: "approve" | "reject" | "defer", ids: string[], scope: string) {
    if (ids.length === 0) {
      // Honest feedback instead of a silent no-op — e.g. nothing matched after
      // the factual-integrity floor excluded unverifiable rows on this lane.
      setError(`Nothing to ${action}: 0 rows matched (${scope}). Rows missing a source, E0, or in an unsafe category are excluded from bulk approval.`);
      return;
    }
    setError(null);
    // Small same-page approve batches stay one-click (operators asked for it).
    // Reject/Defer always confirm (irreversible per-row), and any LARGE blanket
    // approve (>20, i.e. an "auto-process all" / "all matching" run, including
    // the human_review lane) confirms too — so hundreds of rows are never
    // promoted to analyst_verified on an accidental click.
    if (action !== "approve") {
      const verb = action === "reject" ? "Reject" : "Defer";
      if (!window.confirm(`${verb} ${ids.length} proposal${ids.length === 1 ? "" : "s"} (${scope})?\n\nThis is irreversible. Continue?`)) return;
    } else if (ids.length > 20) {
      if (!window.confirm(`Approve ${ids.length} proposals (${scope})?\n\nThey will be promoted to analyst_verified evidence and feed vendor scores. Continue?`)) return;
    }
    void bulkAct(ids, action);
  }

  const { page, total, totalAfterFilter, facets } = result;
  const hasNext = paging.offset + paging.limit < totalAfterFilter;
  const hasPrev = paging.offset > 0;

  return (
    <div className="min-h-screen bg-[#f6f1e3] dark:bg-[#071827] text-[#15263c] dark:text-[#eef3f8]">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/admin/evidence" className="text-sm text-[#4c5d75] hover:underline">← Single review</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Batch review — {filters.lane ?? "recommend_approve"}
        </h1>
        <p className="mt-2 text-sm text-[#3f5068] dark:text-[#a7bacd]">
          {totalAfterFilter} of {total} pending proposals after filters. Showing rows {totalAfterFilter === 0 ? 0 : paging.offset + 1}–
          {Math.min(paging.offset + paging.limit, totalAfterFilter)}.
        </p>

        {/* Lane selector — primary navigation. The 34 fresh proposals
            could be in any of these lanes; default lands on
            recommend_approve, but if it's empty the operator needs to
            see human_review_required (where unsafe-category rows sit). */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75]">Lane:</span>
          {(["recommend_approve", "human_review_required", "recommend_reject", "all"] as const).map((laneKey) => {
            const active = (filters.lane ?? "recommend_approve") === laneKey;
            const count =
              laneKey === "all"
                ? facets.byLane.reduce((s, f) => s + f.count, 0)
                : facets.byLane.find((f) => f.lane === laneKey)?.count ?? 0;
            return (
              <button
                key={laneKey}
                type="button"
                onClick={() => updateFilter("lane", laneKey === "recommend_approve" ? undefined : laneKey)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : "border-[#d6c9a8] bg-white text-[#2e3f57] hover:border-emerald-400 dark:border-[#2a4a6b] dark:bg-[#0c2238] dark:text-[#d8e2ec]"
                }`}
              >
                {laneKey} ({count})
              </button>
            );
          })}
        </div>

        {!hasDatabase && (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            DATABASE_URL is not set. Batch review is read-only and empty until persistence is configured.
          </div>
        )}

        {/* Reviewer row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-[#4c5d75]">Reviewer ID</div>
            <input value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}
              className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </label>
        </div>

        {/* Filter bar */}
        <div className="mt-6 rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#4c5d75]">Filters</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <FilterSelect
              label="Vendor"
              value={filters.vendorId}
              onChange={(v) => updateFilter("vendor", v)}
              options={[{ value: "", label: `All (${facets.byVendor.reduce((s, v) => s + v.count, 0)})` },
                ...facets.byVendor.slice(0, 30).map((v) => ({ value: v.vendorId, label: `${v.vendorId} (${v.count})` }))]}
            />
            <FilterSelect
              label="Confidence"
              value={filters.confidenceBand}
              onChange={(v) => updateFilter("confidence", v)}
              options={[{ value: "", label: "All" },
                ...facets.byConfidenceBand.map((b) => ({ value: b.band, label: `${b.band} (${b.count})` }))]}
            />
            <FilterSelect
              label="Grade"
              value={filters.grade}
              onChange={(v) => updateFilter("grade", v)}
              options={[{ value: "", label: "All" },
                ...facets.byGrade.map((g) => ({ value: g.grade, label: `${g.grade} (${g.count})` }))]}
            />
            <FilterSelect
              label="Linkage status"
              value={filters.linkageStatus}
              onChange={(v) => updateFilter("linkage", v)}
              options={[{ value: "", label: "All" },
                ...facets.byLinkageStatus.map((l) => ({ value: l.status, label: `${l.status} (${l.count})` }))]}
            />
            <label className="block">
              <div className="mb-1 text-xs font-medium text-[#4c5d75]">Source URL contains</div>
              <input
                defaultValue={filters.sourceUrlContains ?? ""}
                onBlur={(e) => updateFilter("source", e.target.value || undefined)}
                placeholder="e.g. trust.openai.com"
                className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <input
              id="includeDeferred"
              type="checkbox"
              defaultChecked={Boolean(filters.includeDeferred)}
              onChange={(e) => updateFilter("includeDeferred", e.target.checked ? "1" : undefined)}
            />
            <label htmlFor="includeDeferred" className="text-[#4c5d75]">
              Include deferred rows ({facets.deferredCount} deferred)
            </label>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-700 dark:text-red-300">Error: {error}</div>}

        {/* Bulk actions toolbar */}
        {page.length > 0 && !bulkRunning && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
              Bulk actions
            </span>
            {/* One-click auto-process for the whole cohort. Skips confirm
                dialog and approves every row matching current filters. */}
            {totalAfterFilter > 0 && (
              <BulkAllMatchingButton
                totalAfterFilter={totalAfterFilter}
                filters={filters}
                token={token}
                onIdsResolved={(ids) => confirmAndBulk("approve", ids, `auto-process · ${ids.length} rows`)}
                label={`⚡ Auto-process all ${totalAfterFilter} pending`}
                tone="primary"
              />
            )}
            <button
              type="button"
              onClick={() => confirmAndBulk("approve", page.map((p) => p.proposalId), `this page · ${page.length} rows`)}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >Approve page ({page.length})</button>
            {totalAfterFilter > page.length && (
              <span className="text-xs text-emerald-900/70 dark:text-emerald-300/70">
                or
              </span>
            )}
            {totalAfterFilter > page.length && (
              <BulkAllMatchingButton
                totalAfterFilter={totalAfterFilter}
                filters={filters}
                token={token}
                onIdsResolved={(ids) => confirmAndBulk("approve", ids, `all matching filters · ${ids.length} rows`)}
              />
            )}
            <span className="ml-auto text-xs text-emerald-900/70 dark:text-emerald-300/70">
              Defer and Reject are per-row to keep audit at proposal granularity.
            </span>
          </div>
        )}

        {bulkRunning && (
          <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
            <div className="font-semibold uppercase tracking-wider text-xs">
              Bulk {bulkRunning.action} in progress
            </div>
            <div className="mt-1 font-mono">
              {bulkRunning.done} / {bulkRunning.total} processed{bulkRunning.failed > 0 ? ` · ${bulkRunning.failed} failed` : ""}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900">
              <div
                className="h-full bg-sky-600 transition-all"
                style={{ width: `${(bulkRunning.done / Math.max(1, bulkRunning.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Row cards */}
        <div className="mt-6 space-y-3">
          {page.length === 0 && (
            <div className="rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] p-8 text-center text-sm text-[#4c5d75]">
              No rows match the current filters.
            </div>
          )}
          {page.map((p) => (
            <div key={p.proposalId} className="rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white dark:bg-[#0c2238] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-[#4c5d75]">{p.proposalId} · {p.vendorId}</div>
                  <div className="mt-1 font-semibold">
                    {p.subfactor} <span className="text-xs font-normal text-[#4c5d75]">· {p.domain}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm">{p.proposedGrade}</div>
                  <div className="text-xs text-[#4c5d75]">conf {(p.classifierConfidence * 100).toFixed(0)}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-[#6b7d93]">{p.dataStatus}</div>
                </div>
              </div>

              {/* Triage reasons */}
              {p.triageReasons.length > 0 && (
                <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
                  <div className="font-semibold uppercase tracking-wide">{p.triageLane}</div>
                  <ul className="mt-1 list-disc pl-5 space-y-0.5">
                    {p.triageReasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              <blockquote className="mt-3 rounded-lg bg-[#f6f1e3] dark:bg-[#071827] px-3 py-2 text-sm border-l-2 border-[#d6c9a8] dark:border-[#2a4a6b]">
                {p.excerpt}
              </blockquote>

              {p.sourceUrl && (
                <div className="mt-2 text-xs text-[#4c5d75] truncate">
                  <strong>Source:</strong> {p.sourceUrl}
                </div>
              )}

              {/* Inline product-linkage picker — same component used on
                  the single-row /admin/evidence screen. */}
              <BatchRowLinkagePicker
                proposalId={p.proposalId}
                vendorId={p.vendorId}
                availableProducts={p.availableProducts ?? []}
                suggestions={p.linkageSuggestions ?? []}
                initialScopeIds={p.linkedProductIds}
                initialIsVendorWide={p.isVendorWide ?? false}
                linkageStatus={p.linkageStatus}
                token={token}
                onError={setError}
              />

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy === p.proposalId}
                  onClick={() => act(p.proposalId, "approve")}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >Approve → promote</button>
                <button
                  disabled={busy === p.proposalId}
                  onClick={() => act(p.proposalId, "defer")}
                  className="rounded-full border border-amber-400 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                >Defer</button>
                <button
                  disabled={busy === p.proposalId}
                  onClick={() => act(p.proposalId, "reject")}
                  className="rounded-full border border-[#d6c9a8] dark:border-[#2a4a6b] px-4 py-1.5 text-xs font-medium disabled:opacity-50"
                >Reject</button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalAfterFilter > paging.limit && (
          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              disabled={!hasPrev}
              onClick={() => setOffset(paging.offset - paging.limit)}
              className="rounded-full border border-[#d6c9a8] dark:border-[#2a4a6b] px-4 py-1.5 disabled:opacity-40"
            >← Prev 20</button>
            <span className="text-[#4c5d75]">
              {paging.offset + 1}–{Math.min(paging.offset + paging.limit, totalAfterFilter)} of {totalAfterFilter}
            </span>
            <button
              disabled={!hasNext}
              onClick={() => setOffset(paging.offset + paging.limit)}
              className="rounded-full border border-[#d6c9a8] dark:border-[#2a4a6b] px-4 py-1.5 disabled:opacity-40"
            >Next 20 →</button>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-[#4c5d75]">{label}</div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-[#d6c9a8] dark:border-[#2a4a6b] bg-white dark:bg-[#071827] px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/** Resolve every proposal id matching the current filter set (across all
 * pages) by asking the server for the full list, then call onIdsResolved.
 * The batch page already pulls up to 5000 rows server-side; we just hit
 * it with limit=0 to get the full set in one round-trip.
 *
 * Falls back to a single-page action if the server lookup fails. */
function BulkAllMatchingButton({
  totalAfterFilter,
  filters,
  token,
  onIdsResolved,
  label,
  tone = "secondary",
}: {
  totalAfterFilter: number;
  filters: BatchReviewFilters;
  token?: string;
  onIdsResolved: (ids: string[]) => void;
  /** Custom label override. Defaults to "Approve all matching filters (N)". */
  label?: string;
  /** Visual emphasis. "primary" = filled emerald, "secondary" = outline. */
  tone?: "primary" | "secondary";
}) {
  const [loading, setLoading] = useState(false);
  const primaryCls = "rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50";
  const secondaryCls = "rounded-full border border-emerald-600 px-4 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-950";
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const u = new URLSearchParams();
          if (filters.vendorId) u.set("vendor", filters.vendorId);
          if (filters.confidenceBand) u.set("confidence", filters.confidenceBand);
          if (filters.grade) u.set("grade", filters.grade);
          if (filters.linkageStatus) u.set("linkage", filters.linkageStatus);
          if (filters.sourceUrlContains) u.set("source", filters.sourceUrlContains);
          if (filters.includeDeferred) u.set("includeDeferred", "1");
          if (filters.lane) u.set("lane", filters.lane); // resolve the lane the operator is viewing
          u.set("ids", "1"); // tell the server to return just ids
          const res = await fetch(`/api/admin/evidence/batch-action/ids?${u.toString()}`, {
            headers: token ? { "x-admin-token": token } : {},
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { ids: string[] };
          onIdsResolved(body.ids);
        } catch (e) {
          alert(`Failed to resolve ids: ${(e as Error).message}`);
        } finally {
          setLoading(false);
        }
      }}
      className={tone === "primary" ? primaryCls : secondaryCls}
    >
      {loading ? "Resolving…" : (label ?? `Approve all matching filters (${totalAfterFilter})`)}
    </button>
  );
}

interface BatchAvailableProduct { id: string; name: string; category: string }
interface BatchSuggestion { productScopeId: string; productName: string; confidence: number; reason: string; safeToApply: boolean }

/** Inline picker reused on the batch row. Same shape as the single-row
 * /admin/evidence picker — multi-select checkboxes with the vendor's
 * full catalogue, suggestions pinned at top, "Select all (vendor-wide)"
 * preset, save calls PATCH /api/admin/proposals/<id>/linkage. */
function BatchRowLinkagePicker({
  proposalId,
  vendorId,
  availableProducts,
  suggestions,
  initialScopeIds,
  initialIsVendorWide,
  linkageStatus,
  token,
  onError,
}: {
  proposalId: string;
  vendorId: string;
  availableProducts: BatchAvailableProduct[];
  suggestions: BatchSuggestion[];
  initialScopeIds: string[];
  initialIsVendorWide: boolean;
  linkageStatus: string;
  token: string;
  onError: (msg: string | null) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialScopeIds));
  const [isVendorWide, setIsVendorWide] = useState(initialIsVendorWide);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (availableProducts.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>Linkage:</strong> vendor <code className="font-mono">{vendorId}</code> has no product
        scopes registered. Add to <code className="font-mono">PRODUCT_SCOPES</code> first.
      </div>
    );
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(availableProducts.map((p) => p.id)) : new Set());
    setIsVendorWide(on);
  }
  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setIsVendorWide(next.size === availableProducts.length);
      return next;
    });
  }
  async function save() {
    setSaving(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${encodeURIComponent(proposalId)}/linkage`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify({ productScopeIds: [...selected], isVendorWide }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const suggestionIds = new Set(suggestions.map((s) => s.productScopeId));
  const ordered = [
    ...suggestions
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .map((s) => availableProducts.find((p) => p.id === s.productScopeId))
      .filter((p): p is BatchAvailableProduct => Boolean(p)),
    ...availableProducts
      .filter((p) => !suggestionIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const dirty =
    selected.size !== initialScopeIds.length ||
    [...selected].some((id) => !initialScopeIds.includes(id));

  return (
    <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs dark:border-sky-900/60 dark:bg-sky-950/30">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sky-900 dark:text-sky-200">
          Product linkage
          <span className="ml-2 rounded bg-sky-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
            {linkageStatus.replace(/_/g, " ")}
          </span>
          {selected.size > 0 && (
            <span className="ml-2 text-sky-700 dark:text-sky-300">
              · {selected.size} of {availableProducts.length} linked
              {isVendorWide && " (vendor-wide)"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-sky-700 hover:underline dark:text-sky-300"
        >
          {expanded ? "Hide picker" : "Edit linkage"}
        </button>
      </div>
      {expanded && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => toggleAll(true)}
              className="rounded-full border border-sky-400 px-2 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:text-sky-200 dark:hover:bg-sky-950">
              Select all (vendor-wide)
            </button>
            <button type="button" onClick={() => toggleAll(false)}
              className="rounded-full border border-[#d6c9a8] px-2 py-0.5 text-[11px] text-[#2e3f57] hover:bg-[#ece3cb] dark:border-[#2a4a6b] dark:text-[#c2d1e0] dark:hover:bg-[#0c2238]">
              Clear
            </button>
            {suggestions.length > 0 && (
              <button type="button" onClick={() => {
                setSelected(new Set(suggestions.map((s) => s.productScopeId)));
                setIsVendorWide(false);
              }} className="rounded-full border border-emerald-500 px-2 py-0.5 text-[11px] text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950">
                Apply top suggestions ({suggestions.length})
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded border border-sky-200 bg-white p-2 dark:border-sky-900/60 dark:bg-[#0c2238]">
            {ordered.map((prod) => {
              const sug = suggestions.find((s) => s.productScopeId === prod.id);
              return (
                <li key={prod.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-950/40">
                    <input type="checkbox" checked={selected.has(prod.id)} onChange={() => toggle(prod.id)} className="accent-sky-600" />
                    <span className="font-medium text-[#15263c] dark:text-[#eef3f8]">{prod.name}</span>
                    <span className="text-[10px] text-[#4c5d75]">· {prod.category}</span>
                    {sug && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                        <span className="font-mono">{(sug.confidence * 100).toFixed(0)}%</span>
                        {sug.safeToApply && <span className="rounded bg-emerald-200 px-1 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">safe</span>}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={save} disabled={saving || !dirty}
              className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50">
              {saving ? "Saving…" : dirty ? `Save linkage (${selected.size})` : "No changes"}
            </button>
            {savedAt && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">✓ saved {savedAt}</span>}
          </div>
        </>
      )}
    </div>
  );
}
