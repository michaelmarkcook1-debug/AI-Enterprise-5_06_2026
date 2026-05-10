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

export default function EvidenceReview({ initialProposals, hasDatabase }: { initialProposals: Proposal[]; hasDatabase: boolean }) {
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
              {p.linkageSuggestions && p.linkageSuggestions.length > 0 && (
                <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs dark:border-sky-900/60 dark:bg-sky-950/30">
                  <div className="font-semibold text-sky-900 dark:text-sky-200">
                    Suggested product linkage{p.linkageStatus ? ` · ${p.linkageStatus}` : ""}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-sky-900 dark:text-sky-200">
                    {p.linkageSuggestions.map((s) => (
                      <li key={s.productScopeId}>
                        <span className="font-mono">{(s.confidence * 100).toFixed(0)}%</span>{" "}
                        <strong>{s.productName}</strong>
                        {s.safeToApply && (
                          <span className="ml-1 rounded bg-emerald-200 px-1 text-[10px] text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                            safe
                          </span>
                        )}
                        <span className="ml-1 text-zinc-500">— {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.linkageSuggestions && p.linkageSuggestions.length === 0 && p.linkageStatus && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <strong>Linkage:</strong> {p.linkageStatus.replace(/_/g, " ")} — operator must select product manually.
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy === p.id || isUnsafeToApprove(p)}
                  onClick={() => act(p.id, "approve")}
                  title={isUnsafeToApprove(p) ? approveBlockReason(p) : undefined}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >Approve → promote</button>
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
