import type { Metadata } from "next";
import Link from "next/link";

// Status landing for confirm / unsubscribe links. Not indexable.
export const metadata: Metadata = { title: "Subscription", robots: { index: false, follow: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  confirmed: {
    title: "You're subscribed ✓",
    body: "Your email is confirmed. You'll get concise, evidence-based intelligence on the enterprise-AI market — no spam, unsubscribe any time.",
  },
  unsubscribed: {
    title: "You've unsubscribed",
    body: "You're off the list and won't receive further emails. You can resubscribe any time.",
  },
  invalid: {
    title: "Link expired or invalid",
    body: "That confirmation link is no longer valid. Try subscribing again to get a fresh link.",
  },
};

export default async function SubscribeDonePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const m = MESSAGES[state ?? "invalid"] ?? MESSAGES.invalid;

  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{m.title}</h1>
      <p className="mt-3 text-sm text-[#15263c]/70 dark:text-[#eef3f8]/70">{m.body}</p>
      <div className="mt-8 flex justify-center gap-4 text-sm">
        <Link href="/dependencies" className="underline underline-offset-2">Explore the dependency graph</Link>
        <Link href="/vendors" className="underline underline-offset-2">Vendor rankings</Link>
      </div>
    </main>
  );
}
