// Buyer-intent aggregation (admin-only reads).
// ─────────────────────────────────────────────
// Read-only roll-ups over the anonymous IntentEvent stream — the demand signal
// forming. No PII: sessions are counted by their salted hash, never identified.

import { getPrisma, hasDatabase } from "../prisma";

export interface IntentTop {
  targetId: string;
  views: number;
}

export interface IntentDemand {
  windowDays: number;
  totalEvents: number;
  uniqueSessions: number;
  vendorsViewed: number;
  comparisonsRun: number;
  categoriesBrowsed: number;
  articleReads: number;
  pageViews: number;
  topVendors: IntentTop[];
  topCategories: IntentTop[];
  topComparisons: IntentTop[];
}

export async function getIntentDemand(windowDays = 30): Promise<IntentDemand | null> {
  if (!hasDatabase()) return null;
  const prisma = getPrisma();
  const since = new Date(Date.now() - windowDays * 86_400 * 1000);

  try {
    const [totalsRows, vendors, categories, comparisons] = await Promise.all([
      prisma.$queryRaw<Array<{ total: bigint; sessions: bigint; vendors: bigint; comparisons: bigint; categories: bigint; articles: bigint; pageviews: bigint }>>`
        SELECT COUNT(*)::bigint AS total,
               COUNT(DISTINCT "session_hash")::bigint AS sessions,
               COUNT(*) FILTER (WHERE "event_type" = 'vendor_viewed')::bigint AS vendors,
               COUNT(*) FILTER (WHERE "event_type" = 'comparison_run')::bigint AS comparisons,
               COUNT(*) FILTER (WHERE "event_type" = 'category_browsed')::bigint AS categories,
               COUNT(*) FILTER (WHERE "event_type" = 'article_read')::bigint AS articles,
               COUNT(*) FILTER (WHERE "event_type" = 'page_view')::bigint AS pageviews
        FROM "intent_events"
        WHERE "created_at" >= ${since}
      `,
      prisma.$queryRaw<Array<{ target_id: string; views: bigint }>>`
        SELECT "target_id", COUNT(*)::bigint AS views FROM "intent_events"
        WHERE "event_type" = 'vendor_viewed' AND "target_id" IS NOT NULL AND "created_at" >= ${since}
        GROUP BY "target_id" ORDER BY views DESC LIMIT 15
      `,
      prisma.$queryRaw<Array<{ target_id: string; views: bigint }>>`
        SELECT "target_id", COUNT(*)::bigint AS views FROM "intent_events"
        WHERE "event_type" = 'category_browsed' AND "target_id" IS NOT NULL AND "created_at" >= ${since}
        GROUP BY "target_id" ORDER BY views DESC LIMIT 15
      `,
      prisma.$queryRaw<Array<{ target_id: string; views: bigint }>>`
        SELECT "target_id", COUNT(*)::bigint AS views FROM "intent_events"
        WHERE "event_type" = 'comparison_run' AND "target_id" IS NOT NULL AND "created_at" >= ${since}
        GROUP BY "target_id" ORDER BY views DESC LIMIT 15
      `,
    ]);

    const t = totalsRows[0];
    const top = (rows: Array<{ target_id: string; views: bigint }>): IntentTop[] =>
      rows.map((r) => ({ targetId: r.target_id, views: Number(r.views) }));

    return {
      windowDays,
      totalEvents: Number(t?.total ?? 0),
      uniqueSessions: Number(t?.sessions ?? 0),
      vendorsViewed: Number(t?.vendors ?? 0),
      comparisonsRun: Number(t?.comparisons ?? 0),
      categoriesBrowsed: Number(t?.categories ?? 0),
      articleReads: Number(t?.articles ?? 0),
      pageViews: Number(t?.pageviews ?? 0),
      topVendors: top(vendors),
      topCategories: top(categories),
      topComparisons: top(comparisons),
    };
  } catch {
    return null;
  }
}
