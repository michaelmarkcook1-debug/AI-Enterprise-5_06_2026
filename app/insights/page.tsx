import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import { listPublishedArticles } from "@/lib/articles/repository";

export const revalidate = 3600;

const TITLE = "Insights";
const DESCRIPTION =
  "Analysis and education on the enterprise-AI market — dependencies, encroachment, and what the rankings mean for buyers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/insights" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/insights"), type: "website" },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function InsightsPage() {
  const articles = await listPublishedArticles();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
        <p className={`mt-2 text-sm ${MUTED}`}>{DESCRIPTION}</p>
      </header>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6 text-sm">
          <p>No insights published yet. In the meantime, explore the{" "}
            <Link href="/dependencies" className="underline underline-offset-2">dependency graph</Link> or the{" "}
            <Link href="/vendors" className="underline underline-offset-2">vendor rankings</Link>.
          </p>
        </div>
      ) : (
        <ul className="space-y-5">
          {articles.map((a) => (
            <li key={a.slug} className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5">
              <Link href={`/insights/${a.slug}`} className="text-lg font-semibold underline-offset-2 hover:underline">
                {a.title}
              </Link>
              {a.summary && <p className={`mt-1 text-sm ${MUTED}`}>{a.summary}</p>}
              <p className={`mt-2 text-xs ${MUTED}`}>
                {a.authorName ? `${a.authorName} · ` : ""}
                {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
