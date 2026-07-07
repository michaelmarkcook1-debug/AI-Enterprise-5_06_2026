import type { Metadata } from "next";
import Link from "next/link";
import { getMemberOrTest } from "@/lib/member/auth";
import { listMemberDecisions } from "@/lib/member/decisions";
import { MARKET_CATEGORIES } from "@/lib/intelligence/seed";
import DeleteDecisionButton from "@/components/member/DeleteDecisionButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My decisions",
  robots: { index: false, follow: false },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";
const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4";

function categoryName(id: string): string {
  return MARKET_CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DecisionsPage() {
  const member = await getMemberOrTest();
  if (!member) return null; // the (member) layout guards this; belt-and-suspenders.

  const decisions = await listMemberDecisions(member.subscriberId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
          Your decisions
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">My decisions</h1>
        <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
          Named weighting profiles you saved from a category&apos;s Interrogate panel. Reopening re-applies your
          saved weights to <strong>current</strong> live scores — never a frozen snapshot. Private to you.
        </p>
      </header>

      {decisions.length === 0 ? (
        <div className={CARD}>
          <p className={`text-sm ${MUTED}`}>
            No saved decisions yet. Open a category page, weight the domains to your priorities, and use
            &quot;Save this weighting as a decision&quot; on the Interrogate panel.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {decisions.map((d) => (
            <li key={d.id} className={CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/decisions/${d.id}`} className="text-sm font-semibold underline-offset-2 hover:underline">
                    {d.name}
                  </Link>
                  <p className={`mt-0.5 text-xs ${MUTED}`}>
                    {categoryName(d.category)} · {d.shortlist.length} vendor{d.shortlist.length === 1 ? "" : "s"} ·
                    updated {fmtDate(d.updatedAt)}
                    {d.asOfDate ? ` · as of ${fmtDate(d.asOfDate)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/decisions/${d.id}`}
                    className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium hover:border-[#b08d2f] dark:border-white/15"
                  >
                    Reopen
                  </Link>
                  <DeleteDecisionButton id={d.id} name={d.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
