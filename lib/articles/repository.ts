// Articles read layer. DB-only, no LLM. No seed content is invented — with no
// database (or no published rows) the surface is honestly empty.

import { getPrisma, hasDatabase } from "../prisma";

export interface ArticleView {
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[];
  vendorIds: string[];
  authorName: string | null;
  publishedAt: string | null;
}

interface ArticleRow {
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[];
  vendorIds: string[];
  authorName: string | null;
  publishedAt: Date | null;
}

function mapArticle(r: ArticleRow): ArticleView {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    body: r.body,
    tags: r.tags,
    vendorIds: r.vendorIds,
    authorName: r.authorName,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

export async function listPublishedArticles(): Promise<ArticleView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await getPrisma().article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
    });
    return rows.map(mapArticle);
  } catch {
    return [];
  }
}

export async function getPublishedArticle(slug: string): Promise<ArticleView | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await getPrisma().article.findFirst({ where: { slug, status: "published" } });
    return row ? mapArticle(row) : null;
  } catch {
    return null;
  }
}
