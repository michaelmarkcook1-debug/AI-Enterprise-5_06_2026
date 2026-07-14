export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#faf6ec] text-[#123d2c] dark:bg-[#081410] dark:text-[#eef3f8]">{children}</div>;
}

export function PageFrame({
  title,
  kicker,
  description,
  children,
  aside,
}: {
  title: string;
  kicker?: string;
  description?: string;
  children: React.ReactNode;
  /** Optional left-hand rail (e.g. <DataSourceRail/>). When set, the page
   *  renders as a 2-column layout below the masthead; otherwise unchanged. */
  aside?: React.ReactNode;
}) {
  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-5 py-10">
        {/* Editorial masthead — serif display title, gold kicker, gold hairline rule */}
        <div className="mb-9 pb-2">
          {kicker && (
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#a07f1f] dark:text-[#d4af37]">
              {kicker}
            </div>
          )}
          <h1 className="font-display mt-2 text-5xl font-semibold leading-none tracking-tight text-[#0f2240] dark:text-[#f6f1e3] md:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#3f5068] dark:text-[#a7bacd]">
              {description}
            </p>
          )}
          <div aria-hidden className="mt-6 flex items-center gap-2">
            <span className="h-px w-14 bg-[#d4af37]" />
            <span className="h-px flex-1 bg-[#123d2c]/10 dark:bg-white/10" />
          </div>
        </div>
        {aside ? (
          <div className="grid items-start gap-6 lg:grid-cols-[236px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-6">{aside}</aside>
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>
    </AppShell>
  );
}
