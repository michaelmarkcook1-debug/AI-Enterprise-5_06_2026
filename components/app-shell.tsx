export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#faf6ec] text-[#13294b] dark:bg-[#071827] dark:text-zinc-100">{children}</div>;
}

export function PageFrame({
  title,
  kicker,
  description,
  children,
}: {
  title: string;
  kicker?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7 border-b border-[#e6dcc3] pb-5 dark:border-zinc-800">
          {kicker && <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e6b7e] dark:text-zinc-500">{kicker}</div>}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0f2240] dark:text-zinc-50 md:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-3xl text-sm leading-6 text-[#54647a] dark:text-zinc-400">{description}</p>}
        </div>
        {children}
      </main>
    </AppShell>
  );
}
