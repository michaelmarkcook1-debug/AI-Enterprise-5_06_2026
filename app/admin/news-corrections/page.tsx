// Admin — pending news→vendor classification corrections (C12).
// Visitor-suggested corrections land here and are applied by hand — nothing about
// the news mapping or any score changes automatically. Admin-gated per-page.
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { listPendingCorrections } from "@/lib/news-bridge/corrections";

export const dynamic = "force-dynamic";

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function fmt(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default async function NewsCorrectionsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const corrections = await listPendingCorrections(200);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-[#15263c] dark:text-[#eef3f8]">
      <h1 className="text-2xl font-semibold tracking-tight">News classification corrections</h1>
      <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
        Visitor-suggested corrections to the news→vendor mapping on the public feed. Nothing here is applied
        automatically — review each, then fix the underlying item / classifier by hand. {corrections.length} pending.
      </p>

      {corrections.length === 0 ? (
        <p className={`mt-6 text-sm ${MUTED}`}>No pending corrections.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className={`border-b border-black/10 dark:border-white/10 ${MUTED}`}>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">News item</th>
                <th className="p-3 font-medium">Kind</th>
                <th className="p-3 font-medium">Vendor</th>
                <th className="p-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={c.id} className="border-b border-black/5 align-top dark:border-white/10">
                  <td className={`p-3 text-xs tabular-nums ${MUTED}`}>{fmt(c.createdAt)}</td>
                  <td className="p-3 font-mono text-xs">{c.newsItemId}</td>
                  <td className="p-3 text-xs">{c.kind}</td>
                  <td className="p-3 text-xs">{c.vendorSlug ?? "—"}</td>
                  <td className={`p-3 text-xs ${MUTED}`}>{c.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
