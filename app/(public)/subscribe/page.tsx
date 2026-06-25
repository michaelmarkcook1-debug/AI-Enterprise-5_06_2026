import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

const TITLE = "Get the market read";
const DESCRIPTION =
  "The evidence-based moves in enterprise AI — who's rising, who's exposed, and who relies on whom. Double opt-in, no spam, unsubscribe any time.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/subscribe" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/subscribe"), type: "website" },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default function SubscribePage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
        Newsletter
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-tight">
        Get the market read
      </h1>
      <p className={`mt-3 text-sm ${MUTED}`}>{DESCRIPTION}</p>

      <div className="mt-6 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
        <SubscribeForm source="subscribe-page" />
      </div>

      <p className={`mt-6 text-sm ${MUTED}`}>
        Prefer to explore first? See the{" "}
        <Link href="/dependencies" className="underline underline-offset-2">dependency graph</Link> or the{" "}
        <Link href="/vendors" className="underline underline-offset-2">live rankings</Link>.
      </p>
    </main>
  );
}
