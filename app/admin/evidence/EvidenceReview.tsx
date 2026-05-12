"use client";

import Link from "next/link";
import { useState } from "react";

interface LinkageSuggestion {
  productScopeId: string;
  productName: string;
  confidence: number;
  reason: string;
  safeToApply: boolean;
}

interface AvailableProduct {
  id: string;
  name: string;
  category: string;
}

interface Proposal {
  id: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  proposedGrade: string;
  proposedRawScore: number;
  sourceUrl?: string;
  capturedAt: string;
  classifierConfidence: number;
  classifierRationale?: string;
  classificationFailed?: boolean;
  classificationFailureCode?: string;
  confidenceIsFallback?: boolean;
  triageLane?: "auto_approve" | "recommend_approve" | "recommend_reject" | "human_review_required";
  triageReasons?: string[];
  triageUnsafeCategory?: string;
  linkageStatus?: string;
  linkageSuggestions?: LinkageSuggestion[];
  availableProducts?: AvailableProduct[];
  currentProductScopeIds?: string[];
  currentIsVendorWide?: boolean;
}

const LANE_LABEL: Record<NonNullable<Proposal["triageLane"]>, { label: string; classes: string }> = {
  auto_approve: {
    label: "AUTO-APPROVE eligible",
    classes: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
  },
  recommend_approve: {
    label: "Recommend approve",
    classes: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
  },
  recommend_reject: {
    label: "Recommend REJECT",
    classes: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800",
  },
  human_review_required: {
    label: "Human review required",
    classes: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
  },
};

/** Approve button is disabled when the row is fundamentally unsafe to
 * promote — classifier-fallback rows (confidence is the runner default,
 * not real output), unsafe-category triages (market share / valuation /
 * IPO timing / disputed), and recommend-reject lane. Reject still works
 * in every state. */
function isUnsafeToApprove(p: Proposal): boolean {
  if (p.confidenceIsFallback) return true;
  if (p.classificationFailed) return true;
  if (p.triageUnsafeCategory) return true;
  if (p.triageLane === "recommend_reject") return true;
  return false;
}

function approveBlockReason(p: Proposal): string {
  if (p.confidenceIsFallback || p.classificationFailed) {
    return "Reclassify required — confidence is the runner's fallback default, not real classifier output.";
  }
  if (p.triageUnsafeCategory) {
    return `Unsafe category (${p.triageUnsafeCategory.replace(/_/g, " ")}) — must go through human review.`;
  }
  if (p.triageLane === "recommend_reject") {
    return "Triage flagged this row for reject. Use Reject, or escalate to human review.";
  }
  return "Approve blocked.";
}

interface QueueHealth {
  totalPending: number;
  deferredCount: number;
  staleCount: number;
  freshActionableCount: number;
}

export default function EvidenceReview({
  initialProposals,
  hasDatabase,
  queueHealth,
  staleThresholdDays = 30,
}: {
  initialProposals: Proposal[];
  hasDatabase: boolean;
  queueHealth?: QueueHealth;
  staleThresholdDays?: number;
}) {
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [token, setToken] = useState("");
  const [reviewerId, setReviewerId] = useState("admin@local");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/proposals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify({ action, reviewerId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setProposals((cur) => cur.filter((p) => p.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">← Admin</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Evidence review</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Review extractor + classifier output before it can affect production scoring.
        </p>
        <div className="mt-4 text-sm">
          <Link
            href="/admin/evidence/batch"
            className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-700 bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:border-emerald-400 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
          >
            <span aria-hidden>📋</span>
            Batch review — recommend_approve cohort (20 at a time)
            <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Queue health summary — total / fresh / deferred / stale */}
        {queueHealth && queueHealth.totalPending > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QueueStat
              label="Pending total"
              value={queueHealth.totalPending}
              tone="neutral"
            />
            <QueueStat
              label="Fresh & actionable"
              value={queueHealth.freshActionableCount}
              tone="green"
              hint={`Captured within ${staleThresholdDays} days, not deferred`}
            />
            <QueueStat
              label="Deferred"
              value={queueHealth.deferredCount}
              tone="amber"
              hint="Set aside by an operator — view with ?includeDeferred=1 on the batch screen"
              href={queueHealth.deferredCount > 0 ? "/admin/evidence/batch?includeDeferred=1" : undefined}
            />
            <QueueStat
              label="Stale pending"
              value={queueHealth.staleCount}
              tone={queueHealth.staleCount > 0 ? "red" : "neutral"}
              hint={`Captured > ${staleThresholdDays} days ago and not deferred`}
            />
          </div>
        )}

        {!hasDatabase && (
          <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            DATABASE_URL is not set. The reviewer is read-only and the queue is empty until persistence is configured.
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-zinc-500">Reviewer ID</div>
            <input value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-medium text-zinc-500">x-admin-token (if not in dev mode)</div>
            <input value={token} onChange={(e) => setToken(e.target.value)} type="password"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm" />
          </label>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-700 dark:text-red-300">Error: {error}</div>}

        <div className="mt-8 space-y-3">
          {proposals.length === 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-sm text-zinc-500">
              No pending proposals.
            </div>
          )}
          {proposals.map((p) => (
            <div key={p.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-zinc-500">{p.id} · {p.vendorId}</div>
                  <div className="mt-1 font-semibold">{p.subfactor} <span className="text-xs font-normal text-zinc-500">· {p.domain}</span></div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm">{p.proposedGrade} · raw {p.proposedRawScore.toFixed(0)}</div>
                  <div className="text-xs text-zinc-500">classifier conf {(p.classifierConfidence * 100).toFixed(0)}%</div>
                </div>
              </div>
              {p.triageLane && (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${LANE_LABEL[p.triageLane].classes}`}>
                  <div className="font-semibold uppercase tracking-wide">
                    {LANE_LABEL[p.triageLane].label}
                    {p.triageUnsafeCategory && (
                      <span className="ml-2 rounded bg-red-200 px-1.5 py-0.5 text-[10px] text-red-900 dark:bg-red-900/40 dark:text-red-200">
                        unsafe: {p.triageUnsafeCategory.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {p.triageReasons && p.triageReasons.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {p.triageReasons.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {p.confidenceIsFallback && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                  <strong>Classifier unavailable.</strong> The {(p.classifierConfidence * 100).toFixed(0)}% confidence is the runner&apos;s fallback default — not real classifier output.
                  {p.classificationFailureCode && (
                    <span className="ml-1 font-mono text-[11px]">code: {p.classificationFailureCode}</span>
                  )}{" "}
                  Reclassify before approving.
                </div>
              )}
              <blockquote className="mt-3 rounded-lg bg-zinc-50 dark:bg-[#071827] px-3 py-2 text-sm border-l-2 border-zinc-300 dark:border-zinc-700">
                {p.excerpt}
              </blockquote>
              {p.classifierRationale && (
                <div className="mt-2 text-xs text-zinc-500"><strong>Rationale:</strong> {p.classifierRationale}</div>
              )}
              {p.sourceUrl && (
                <div className="mt-1 text-xs text-zinc-500 truncate">
                  <strong>Source:</strong> {p.sourceUrl}
                </div>
              )}
              {/* Product linkage — picker + suggestions all in one block.
                  Replaces the previous dead-end "operator must select
                  manually" message with a working multi-select. */}
              <ProductLinkagePicker
                proposalId={p.id}
                vendorId={p.vendorId}
                availableProducts={p.availableProducts ?? []}
                suggestions={p.linkageSuggestions ?? []}
                initialScopeIds={p.currentProductScopeIds ?? []}
                initialIsVendorWide={p.currentIsVendorWide ?? false}
                linkageStatus={p.linkageStatus}
                token={token}
                onError={setError}
              />
              <div className="mt-3 flex gap-2">
                {(() => {
                  const unsafe = isUnsafeToApprove(p);
                  const onClick = () => {
                    if (unsafe) {
                      const ok = window.confirm(
                        `This row was flagged as risky:\n\n${approveBlockReason(p)}\n\nApprove anyway?`,
                      );
                      if (!ok) return;
                    }
                    act(p.id, "approve");
                  };
                  return (
                    <button
                      disabled={busy === p.id}
                      onClick={onClick}
                      title={unsafe ? `Risky: ${approveBlockReason(p)} — click to override` : undefined}
                      className={
                        unsafe
                          // Amber "approve anyway" — still clickable, but visually warns.
                          ? "rounded-full border-2 border-amber-500 bg-amber-50 px-4 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
                          : "rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      }
                    >
                      {unsafe ? "⚠ Approve anyway →" : "Approve → promote"}
                    </button>
                  );
                })()}
                <button
                  disabled={busy === p.id}
                  onClick={() => act(p.id, "reject")}
                  className="rounded-full border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-xs font-medium disabled:opacity-50"
                >Reject</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const STAT_TONE: Record<"neutral" | "green" | "amber" | "red", string> = {
  neutral:
    "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
  green:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  amber:
    "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  red:
    "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
};

const STAT_TEXT_TONE: Record<"neutral" | "green" | "amber" | "red", string> = {
  neutral: "text-zinc-900 dark:text-zinc-100",
  green: "text-emerald-900 dark:text-emerald-200",
  amber: "text-amber-900 dark:text-amber-200",
  red: "text-red-900 dark:text-red-200",
};

function QueueStat({
  label,
  value,
  tone,
  hint,
  href,
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "amber" | "red";
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className={`rounded-xl border px-4 py-3 ${STAT_TONE[tone]} ${href ? "transition-colors hover:brightness-95" : ""}`} title={hint}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${STAT_TEXT_TONE[tone]}`}>{value.toLocaleString()}</div>
      {hint && <div className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block no-underline">{body}</Link> : body;
}

/** Inline product-linkage picker.
 *
 * Replaces the prior "operator must select product manually" dead-end.
 * Shows the vendor's full product catalogue as checkboxes (top suggestions
 * pinned at top with a "safe" tag when applicable), plus a "vendor-wide
 * claim" preset that selects every product at once. Save calls
 * PATCH /api/admin/proposals/:id/linkage which validates that every
 * selected id belongs to the vendor's catalogue and persists.
 */
function ProductLinkagePicker({
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
  availableProducts: AvailableProduct[];
  suggestions: LinkageSuggestion[];
  initialScopeIds: string[];
  initialIsVendorWide: boolean;
  linkageStatus?: string;
  token: string;
  onError: (msg: string | null) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialScopeIds));
  const [isVendorWide, setIsVendorWide] = useState(initialIsVendorWide);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(initialScopeIds.length === 0);

  // No catalogue → vendor not in registry. Surface a clear note.
  if (availableProducts.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <strong>Linkage:</strong> vendor <code className="font-mono">{vendorId}</code> has no product
        scopes registered. Add the vendor to <code className="font-mono">PRODUCT_SCOPES</code> in code
        first, then re-run the linkage suggester.
      </div>
    );
  }

  function toggleAll(on: boolean) {
    if (on) setSelected(new Set(availableProducts.map((p) => p.id)));
    else setSelected(new Set());
    setIsVendorWide(on);
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Vendor-wide flag becomes false the moment the operator
      // unchecks any product.
      if (next.size !== availableProducts.length) setIsVendorWide(false);
      else setIsVendorWide(true);
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
        body: JSON.stringify({
          productScopeIds: [...selected],
          isVendorWide,
        }),
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
  // Render order: suggestions first (highest confidence at top), then the
  // rest of the catalogue alphabetically.
  const ordered = [
    ...suggestions
      .slice()
      .sort((a, b) => b.confidence - a.confidence)
      .map((s) => availableProducts.find((p) => p.id === s.productScopeId))
      .filter((p): p is AvailableProduct => Boolean(p)),
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
          {linkageStatus && (
            <span className="ml-2 rounded bg-sky-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
              {linkageStatus.replace(/_/g, " ")}
            </span>
          )}
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
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="rounded-full border border-sky-400 px-2 py-0.5 text-[11px] font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:text-sky-200 dark:hover:bg-sky-950"
            >Select all (vendor-wide)</button>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >Clear</button>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set(suggestions.map((s) => s.productScopeId)));
                  setIsVendorWide(false);
                }}
                className="rounded-full border border-emerald-500 px-2 py-0.5 text-[11px] text-emerald-900 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950"
              >Apply top suggestions ({suggestions.length})</button>
            )}
          </div>

          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded border border-sky-200 bg-white p-2 dark:border-sky-900/60 dark:bg-zinc-900">
            {ordered.map((p) => {
              const suggestion = suggestions.find((s) => s.productScopeId === p.id);
              return (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-sky-50 dark:hover:bg-sky-950/40">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="accent-sky-600"
                    />
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                    <span className="text-[10px] text-zinc-500">· {p.category}</span>
                    {suggestion && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                        <span className="font-mono">{(suggestion.confidence * 100).toFixed(0)}%</span>
                        {suggestion.safeToApply && (
                          <span className="rounded bg-emerald-200 px-1 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">safe</span>
                        )}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : dirty ? `Save linkage (${selected.size})` : "No changes"}
            </button>
            {savedAt && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">✓ saved {savedAt}</span>}
            {!dirty && initialScopeIds.length > 0 && (
              <span className="text-[11px] text-zinc-500">{initialScopeIds.length} product{initialScopeIds.length === 1 ? "" : "s"} currently linked</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
