import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Operate the data pipeline that feeds the scoring engine.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <AdminCard href="/admin/ingestion" title="Ingestion" body="Trigger public-data fetches and inspect job status." />
          <AdminCard href="/admin/evidence" title="Evidence review" body="Review, approve, or reject extracted evidence proposals before they affect scoring." />
        </div>
        <div className="mt-10 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Set <code className="font-mono">ADMIN_API_OPEN=1</code> for local dev, or send the <code className="font-mono">x-admin-token</code> header.
        </div>
      </main>
    </div>
  );
}

function AdminCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-400 dark:hover:border-zinc-600">
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </Link>
  );
}
