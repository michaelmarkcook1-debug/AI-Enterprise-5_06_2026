import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { listPublishedArticles, getPublishedArticle } from "@/lib/articles/repository";
import { renderMarkdown } from "@/lib/articles/markdown";

export const revalidate = 3600;

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  const articles = await listPublishedArticles().catch(() => []);
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Insight not found" };
  return {
    title: article.title,
    description: article.summary ?? undefined,
    alternates: { canonical: `/insights/${slug}` },
    openGraph: {
      title: article.title,
      description: article.summary ?? undefined,
      url: absoluteUrl(`/insights/${slug}`),
      type: "article",
    },
  };
}

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <nav className={`mb-3 text-xs ${MUTED}`}>
        <Link href="/insights" className="underline underline-offset-2">Insights</Link>
      </nav>
      <header className="mb-6">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{article.title}</h1>
        <p className={`mt-2 text-xs ${MUTED}`}>
          {article.authorName ? `${article.authorName} · ` : ""}
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })
            : ""}
        </p>
      </header>
      <div
        className="prose-sm max-w-none space-y-3 text-[15px] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 dark:[&_code]:bg-white/10"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
      />
    </main>
  );
}
