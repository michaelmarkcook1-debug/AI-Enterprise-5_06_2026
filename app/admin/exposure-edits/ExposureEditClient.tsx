"use client";

import { useState } from "react";

interface NodeLite { id: string; label: string; side: "left" | "right" }
interface EdgeLite {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: string;
  summary: string;
}
interface ProposalRecord {
  timestamp: string;
  proposedBy: string;
  action: "add" | "update" | "remove";
  edgeId: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  strengthScore: number;
  confidence: string;
  estimatedValue?: string;
  summary: string;
  sourceUrls: string[];
  rationale: string;
}

export default function ExposureEditClient({
  nodes, edges, initialProposals,
}: {
  nodes: NodeLite[];
  edges: EdgeLite[];
  initialProposals: ProposalRecord[];
}) {
  const [proposals, setProposals] = useState<ProposalRecord[]>(initialProposals);
  const [token, setToken] = useState("");
  const [action, setAction] = useState<"add" | "update" | "remove">("add");
  const [edgeId, setEdgeId] = useState("");
  const [sourceId, setSourceId] = useState(nodes.find((n) => n.side === "left")?.id ?? "");
  const [targetId, setTargetId] = useState(nodes.find((n) => n.side === "right")?.id ?? "");
  const [relationshipType, setRelationshipType] = useState("investment");
  const [confidence, setConfidence] = useState("medium");
  const [strengthScore, setStrengthScore] = useState(0.6);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [rationale, setRationale] = useState("");
  const [proposedBy, setProposedBy] = useState("admin@local");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // When the user picks an existing edge for update/remove, pre-fill.
  function loadEdge(id: string) {
    setEdgeId(id);
    const e = edges.find((x) => x.id === id);
    if (!e) return;
    setSourceId(e.sourceId);
    setTargetId(e.targetId);
    setRelationshipType(e.relationshipType);
    setConfidence(e.confidence);
    setSummary(e.summary);
  }

  async function submit() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/admin/exposure-edits", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({
          action, edgeId, sourceId, targetId, relationshipType, confidence,
          strengthScore, estimatedValue: estimatedValue || undefined, summary,
          sourceUrls: sourceUrls.split(/[,\s]+/).filter(Boolean),
          rationale, proposedBy,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSuccess(`Proposal ${body.proposal.edgeId} recorded.`);
      setProposals((p) => [...p, body.proposal]);
      setSummary(""); setRationale(""); setEstimatedValue(""); setSourceUrls("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sourceOptions = nodes.filter((n) => n.side === "left");
  const targetOptions = nodes.filter((n) => n.side === "right");

  return (
    <div className="mt-6 space-y-8">
      {/* Form */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">Draft a proposal</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Action">
            <select value={action} onChange={(e) => setAction(e.target.value as "add" | "update" | "remove")} className={sel}>
              <option value="add">add — new edge</option>
              <option value="update">update — change existing</option>
              <option value="remove">remove — delete existing</option>
            </select>
          </Field>
          <Field label="Edge ID">
            {action === "add" ? (
              <input value={edgeId} onChange={(e) => setEdgeId(e.target.value)} placeholder="e.g. msft-deepseek" className={inp} />
            ) : (
              <select value={edgeId} onChange={(e) => loadEdge(e.target.value)} className={sel}>
                <option value="">— select existing —</option>
                {edges.map((e) => (
                  <option key={e.id} value={e.id}>{e.id} — {e.sourceId}→{e.targetId}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Proposed by">
            <input value={proposedBy} onChange={(e) => setProposedBy(e.target.value)} className={inp} />
          </Field>
          <Field label="Source (public ticker)">
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={sel}>
              {sourceOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </Field>
          <Field label="Target (AI lab / model owner)">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={sel}>
              {targetOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
          </Field>
          <Field label="Relationship type">
            <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} className={sel}>
              <option value="investment">investment</option>
              <option value="cloud">cloud</option>
              <option value="model_hosting">model_hosting</option>
              <option value="commercial_partnership">commercial_partnership</option>
              <option value="supply_chain">supply_chain</option>
              <option value="subsidiary">subsidiary</option>
            </select>
          </Field>
          <Field label="Confidence">
            <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className={sel}>
              <option value="high">high — independently verifiable</option>
              <option value="medium">medium — public partnership</option>
              <option value="seed">seed — plausible, unverified</option>
            </select>
          </Field>
          <Field label="Strength score (0..1)">
            <input type="number" min={0} max={1} step={0.05} value={strengthScore}
              onChange={(e) => setStrengthScore(Number(e.target.value))} className={inp} />
          </Field>
          <Field label="Estimated value (optional)">
            <input value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} placeholder="e.g. $4B / Bedrock catalog" className={inp} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Summary">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="One sentence describing the relationship." className={`${inp} font-normal`} />
          </Field>
          <Field label="Source URLs (whitespace or comma separated)">
            <textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} rows={2} placeholder="https://example.com/press-release" className={`${inp} font-mono text-[12px]`} />
          </Field>
          <Field label="Rationale (why this change matters)">
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} className={`${inp} font-normal`} />
          </Field>
          <Field label="x-admin-token (optional in dev)">
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inp} />
          </Field>
        </div>
        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">Error: {error}</div>}
        {success && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</div>}
        <div className="mt-4 flex items-center gap-2">
          <button onClick={submit} disabled={busy || !summary || !rationale || (action === "add" && !edgeId) || (action !== "add" && !edgeId)}
            className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-400">
            {busy ? "Recording…" : "Record proposal"}
          </button>
          <span className="text-xs text-zinc-500">
            Proposals are append-only. The live map only changes once a reviewer folds an approved proposal into the data file.
          </span>
        </div>
      </div>

      {/* Existing proposals */}
      <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">Recorded proposals ({proposals.length})</h2>
          <p className="mt-1 text-xs text-zinc-500">Sorted newest first. Append-only JSONL — nothing here is auto-applied.</p>
        </div>
        {proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No proposals recorded yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {[...proposals].reverse().map((p, i) => (
              <li key={`${p.timestamp}-${i}`} className="px-6 py-4">
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    p.action === "add"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : p.action === "update"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                  }`}>{p.action}</span>
                  <span className="font-mono text-sm font-semibold">{p.edgeId}</span>
                  <span className="text-zinc-500">{p.sourceId} → {p.targetId}</span>
                  <span className="ml-auto text-xs text-zinc-500">{new Date(p.timestamp).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {p.relationshipType} · {p.confidence} · strength {p.strengthScore.toFixed(2)}
                  {p.estimatedValue && ` · ${p.estimatedValue}`} · by {p.proposedBy}
                </div>
                <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{p.summary}</p>
                {p.rationale && <p className="mt-1 text-xs italic text-zinc-600 dark:text-zinc-400">Rationale: {p.rationale}</p>}
                {p.sourceUrls.length > 0 && (
                  <div className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                    {p.sourceUrls.map((u) => <span key={u} className="mr-2 truncate">{u}</span>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#071827]";
const sel = inp;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-zinc-500">{label}</div>
      {children}
    </label>
  );
}
