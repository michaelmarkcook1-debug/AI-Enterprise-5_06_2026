// Shared transactional mailer (Resend).
// ──────────────────────────────────────
// One place that talks to Resend, so the subscribe flow and the existing
// watchlist notifiers stop duplicating init code. Graceful by design: with no
// RESEND_API_KEY the send is a labelled no-op rather than an error, matching the
// existing posture (lib/watchlist/notify.ts).

export const MAIL_FROM = "AI Enterprise <alerts@ranking-engine-red.vercel.app>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: string;
  error?: string;
}

/** True when a real mailer is configured. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: "no_resend_key" };
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: MAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
