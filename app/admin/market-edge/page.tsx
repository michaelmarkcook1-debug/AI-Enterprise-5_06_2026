// Admin — market edge: cited sightings of entities we do NOT track.
// ───────────────────────────────────────────────────────────────────────────
// The ingest guard rejects any vendorId outside the live roster ("vendors are
// never invented"). That guard stays. This is the visibility it was missing:
// every rejected-for-unknown-entity item is kept here with its citation, ranked
// by how often it recurs, so coverage gaps are answerable instead of silent.
//
// Nothing on this page is a vendor, a score, or evidence. Promotion into the
// roster remains a deliberate human act. Admin-gated per-page.
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { listMarketEdge } from "@/lib/ingest/market-edge";

export const dynamic = "force-dynamic";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

function fmt(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default async function MarketEdgePage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const rows = await listMarketEdge(200);
  const recurring = rows.filter((r) => r.mentionCount > 1).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-[#123d2c] dark:text-[#eef3f8]">
      <h1 className="text-2xl font-semibold tracking-tight">Market edge — untracked entities</h1>
      <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
        Entities named in cited articles that aren&apos;t in the vendor roster, so the ingest guard rejected
        the item. Each row is an <strong>unverified mention</strong>, not a vendor: it carries no score, feeds
        no ranking, and joins to no assessment. Recurring names are the signal that coverage is behind the
        market — promoting one into the roster is a deliberate decision, made here by hand.
      </p>

      {rows.length > 0 && (
        <p className={`mt-3 text-sm ${MUTED}`}>
          {rows.length} untracked {rows.length === 1 ? "entity" : "entities"}
          {recurring > 0 && <> · <strong>{recurring}</strong> seen more than once</>}
        </p>
      )}

      {rows.length === 0 ? (
        <p className={`mt-6 text-sm ${MUTED}`}>
          Nothing captured yet. Rows appear when the competitive-intel ingest receives a cited item about an
          entity outside the roster.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className={`border-b border-black/10 dark:border-white/10 ${MUTED}`}>
                <th className="p-3 font-medium">Entity (as named)</th>
                <th className="p-3 font-medium">Mentions</th>
                <th className="p-3 font-medium">First seen</th>
                <th className="p-3 font-medium">Latest story</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entityKey} className="border-b border-black/5 align-top dark:border-white/10">
                  <td className="p-3">
                    <span className="font-medium">{r.entityName}</span>
                    <div className={`font-mono text-[11px] ${MUTED}`}>{r.entityKey}</div>
                  </td>
                  <td className="p-3 tabular-nums">
                    <span className={r.mentionCount > 1 ? "font-semibold text-[#b08d2f]" : ""}>{r.mentionCount}</span>
                  </td>
                  <td className={`p-3 text-xs tabular-nums ${MUTED}`}>{fmt(r.firstSeenAt)}</td>
                  <td className="p-3 text-xs">
                    {r.lastTitle ?? "—"}
                    {r.lastSourceUrl && (
                      <>
                        {" "}
                        <a
                          href={r.lastSourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {r.lastSourceName ?? "source"} ↗
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
