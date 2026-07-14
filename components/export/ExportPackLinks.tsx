// "Export procurement pack" — plain download links (no JS needed; the browser
// handles the download via the route's Content-Disposition header). Reused on
// a saved decision's page and on the live category/vendor view.

export default function ExportPackLinks({ href, label = "Export procurement pack" }: { href: string; label?: string }) {
  const sep = href.includes("?") ? "&" : "?";
  const linkClass =
    "rounded-full border border-[#d6c9a8] px-2.5 py-1 text-xs font-medium text-[#4c5d75] hover:bg-white dark:border-[#2a4a6b] dark:text-[#a7bacd] dark:hover:bg-[#0d1f17]";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[#5e6b7e] dark:text-[#a7bacd]">{label}</span>
      <a href={`${href}${sep}format=pdf`} className={linkClass}>
        PDF
      </a>
      <a href={`${href}${sep}format=csv`} className={linkClass}>
        CSV
      </a>
    </div>
  );
}
