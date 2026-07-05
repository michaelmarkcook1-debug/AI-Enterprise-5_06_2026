// Admin-gated Reddit connector probe — verify creds + pull real dev-community
// threads for the coding models, so the 4th dev-sentiment source can be
// populated from REAL data (never fabricated).
//
//   GET /api/data-sources/reddit                         → default coding-model sweep
//   GET /api/data-sources/reddit?subreddit=LocalLLaMA&q=claude+code
//
// Returns per-(subreddit,query) the top threads (score/comments/permalink) +
// an aggregate net-score per vendor, so an operator can eyeball the signal and
// I can transcribe it into lib/dev-sentiment/data.ts as the `reddit` source.
// When REDDIT_CLIENT_ID/SECRET are unset the connector reports not_configured
// and this returns that honestly — nothing invented.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { redditConnector, type RedditQuery } from "@/lib/connectors/reddit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The coding-model sweep: (vendor → subreddit+query pairs) over the developer
// subreddits the spec names. Deterministic; edit here to tune the sweep.
const SWEEP: { vendorId: string; queries: RedditQuery[] }[] = [
  { vendorId: "anthropic", queries: [
    { subreddit: "LocalLLaMA", q: "claude code" }, { subreddit: "ChatGPTCoding", q: "claude" }, { subreddit: "ClaudeAI", q: "coding" } ] },
  { vendorId: "openai", queries: [
    { subreddit: "LocalLLaMA", q: "codex" }, { subreddit: "ChatGPTCoding", q: "gpt codex" } ] },
  { vendorId: "google", queries: [
    { subreddit: "LocalLLaMA", q: "gemini cli" }, { subreddit: "ChatGPTCoding", q: "gemini coding" } ] },
  { vendorId: "deepseek", queries: [ { subreddit: "LocalLLaMA", q: "deepseek coder" } ] },
  { vendorId: "alibaba", queries: [ { subreddit: "LocalLLaMA", q: "qwen coder" } ] },
  { vendorId: "meta", queries: [ { subreddit: "LocalLLaMA", q: "code llama" } ] },
  { vendorId: "mistral", queries: [ { subreddit: "LocalLLaMA", q: "codestral" } ] },
];

export async function GET(request: Request): Promise<Response> {
  if (!isAdminRequest(request)) return unauthorized();

  const health = redditConnector.health();
  if (!health.configured) {
    return Response.json(
      {
        ok: false,
        status: health.status,
        message: health.message,
        howTo:
          "Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in Vercel → Project → Settings → Environment Variables (Production), then redeploy. Values come from a Reddit app registered at reddit.com/prefs/apps (type 'script' or 'web app').",
      },
      { status: 200 },
    );
  }

  const url = new URL(request.url);
  const single = url.searchParams.get("subreddit");
  const q = url.searchParams.get("q");

  // Single ad-hoc probe.
  if (single && q) {
    const r = await redditConnector.fetch({ subreddit: single, q, sort: "top", t: "year", limit: 10 });
    return Response.json({ ok: r.ok, status: r.status, error: r.error, sourceUrl: r.sourceUrl, records: r.records });
  }

  // The coding-model sweep — sequential to respect the 100 req/min OAuth limit.
  const out: Record<string, unknown>[] = [];
  for (const v of SWEEP) {
    const seen = new Map<string, { title: string; score: number; comments: number; date: string; url: string }>();
    for (const query of v.queries) {
      const r = await redditConnector.fetch({ ...query, sort: "top", t: "year", limit: 10 });
      if (!r.ok) continue;
      for (const rec of r.records) {
        // Dedup by permalink (brigading/repost dedup, per the anti-gaming spec).
        if (rec.score < 50 || seen.has(rec.permalink)) continue;
        seen.set(rec.permalink, {
          title: rec.title,
          score: rec.score,
          comments: rec.numComments,
          date: new Date(rec.createdUtc * 1000).toISOString().slice(0, 10),
          url: rec.permalink,
        });
      }
    }
    const threads = [...seen.values()].sort((a, b) => b.score - a.score);
    out.push({
      vendorId: v.vendorId,
      threadCount: threads.length,
      netScore: threads.reduce((s, t) => s + t.score, 0),
      topThreads: threads.slice(0, 6),
    });
  }
  return Response.json({ ok: true, status: "ok", compiledAt: new Date().toISOString(), sweep: out });
}
