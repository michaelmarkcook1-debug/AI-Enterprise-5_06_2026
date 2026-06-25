import Link from "next/link";
import { getIntentDemand, type IntentTop } from "@/lib/intent/aggregate";
import { listIntelligenceVendors, listMarketCategories } from "@/lib/intelligence/repository";

// Internal demand dashboard — the aggregated, anonymous buyer-intent signal.
// Read-only, always fresh. NOTE: like the other /admin pages, page-level auth is
// not enforced here (the app gates mutating /api/admin/* routes, not admin
// pages); a proper admin-auth gate across /admin is a recommended follow-up.
export const dynamic = "force-dynamic";

const PANEL = "rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#4c5d75] dark:text-[#8fa5bb]";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e3d9c0] dark:border-[#1d3a57] px-4 py-3">
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${MUTED}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      {hint && <div className={`mt-1 text-[10px] ${MUTED}`}>{hint}</div>}
    </div>
  );
}

function TopTable({ title, rows, label }: { title: string; rows: IntentTop[]; label: (id: string) => string }) {
  return (
    <div className={PANEL}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className={`text-xs ${MUTED}`}>No events in this window yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.targetId} className="border-t border-[#e3d9c0]/60 dark:border-[#1d3a57]/60">
                <td className="py-1.5 pr-4">{label(r.targetId)}</td>
                <td className="py-1.5 text-right tabular-nums">{r.views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function IntentDemandPage() {
  const [demand, vendors, categories] = await Promise.all([
    getIntentDemand(30),
    listIntelligenceVendors().catch(() => []),
    listMarketCategories().catch(() => []),
  ]);

  const vendorName = new Map<string, string>(vendors.map((v) => [v.slug, v.name]));
  const categoryName = new Map<string, string>(categories.map((c) => [c.id, c.name]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-[#15263c] dark:text-[#eef3f8]">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/admin" className="underline underline-offset-2">Admin</Link> · Buyer-intent demand
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Buyer-intent demand</h1>
        <p className={`mt-1 text-sm ${MUTED}`}>
          Aggregated anonymous signal over the last {demand?.windowDays ?? 30} days. Sessions are
          counted by salted hash — no PII. This is the data asset forming.
        </p>
      </header>

      {!demand ? (
        <div className={PANEL}>
          <p className="text-sm">No database configured — intent events aren&apos;t being recorded.</p>
        </div>
      ) : (
        <>
          <section className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Total events" value={demand.totalEvents} />
            <Stat label="Unique sessions" value={demand.uniqueSessions} hint="salted hash" />
            <Stat label="Vendor views" value={demand.vendorsViewed} />
            <Stat label="Comparisons run" value={demand.comparisonsRun} />
            <Stat label="Category browses" value={demand.categoriesBrowsed} />
            <Stat label="Article reads" value={demand.articleReads} />
            <Stat label="Page views" value={demand.pageViews} />
          </section>
          <p className={`mb-6 text-[10px] ${MUTED}`}>
            The five event-type counts (vendor views + comparisons + category browses + article reads
            + page views) sum to total events — no event type is omitted.
          </p>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TopTable title="Most-viewed vendors" rows={demand.topVendors} label={(id) => vendorName.get(id) ?? id} />
            <TopTable title="Most-browsed categories" rows={demand.topCategories} label={(id) => categoryName.get(id) ?? id} />
            <TopTable title="Most-run comparisons" rows={demand.topComparisons} label={(id) => id.replace(/-vs-/g, " vs ")} />
          </section>
        </>
      )}
    </main>
  );
}
