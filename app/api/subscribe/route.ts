// POST /api/subscribe — email capture (double opt-in).
// Validates the email, creates/refreshes a pending subscriber, and emails a
// confirmation link. Anonymous, rate-limited. No live LLM.

import { z } from "zod";
import { captureSubscriber } from "@/lib/subscribers/service";
import { sendEmail, emailConfigured } from "@/lib/email/mailer";
import { rateLimit, rateLimitHeaders } from "@/lib/http/rate-limit";
import { anonSessionHash } from "@/lib/http/anon-session";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { hasDatabase } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(254),
  source: z.string().max(80).optional(),
  industry: z.string().max(80).optional(),
});

function confirmationEmailHtml(confirmUrl: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#15263c">
      <h2 style="margin:0 0 12px">Confirm your subscription</h2>
      <p>Thanks for your interest in ${SITE_NAME} — independent, evidence-based enterprise-AI market intelligence.</p>
      <p>Click below to confirm. If you didn't request this, just ignore this email.</p>
      <p style="margin:24px 0">
        <a href="${confirmUrl}" style="background:#15263c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm subscription</a>
      </p>
      <p style="font-size:12px;color:#4c5d75">Or paste this link: ${confirmUrl}</p>
    </div>`;
}

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  const rl = rateLimit(`subscribe:${anonSessionHash(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 422 });
  }

  const result = await captureSubscriber(parsed.data);

  // Same response shape whether new, pending, or already-confirmed — never leak
  // whether an address is already on the list.
  if (result.outcome === "pending" && result.confirmToken) {
    const confirmUrl = absoluteUrl(`/api/subscribe/confirm?token=${encodeURIComponent(result.confirmToken)}`);
    if (emailConfigured()) {
      await sendEmail({
        to: result.email,
        subject: `Confirm your ${SITE_NAME} subscription`,
        html: confirmationEmailHtml(confirmUrl),
      });
    } else {
      // No mailer configured (dev/preview) — surface the link in logs so the
      // flow is still testable, but never auto-confirm.
      console.warn(`[subscribe] RESEND not configured; confirm link: ${confirmUrl}`);
    }
  }

  return Response.json(
    { ok: true, message: "Check your inbox to confirm your subscription." },
    { status: 202, headers: rateLimitHeaders(rl) },
  );
}
