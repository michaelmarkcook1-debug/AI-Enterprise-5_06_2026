import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});
// Display wordmark face for the homepage hero — heavy humanist sans
// matching the brief's reference image. Loaded at 700/800/900 for
// the wordmark + supporting weights.
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
});

const SITE_DESCRIPTION =
  "Independent, evidence-based rankings of enterprise AI vendors — scores, market share, agentic momentum, and the dependency/encroachment graph of who relies on (and threatens) whom.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Enterprise — Enterprise AI Market Intelligence",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  // NOTE: no default `alternates.canonical` here — canonical is set per-page so
  // it never inherits the home URL onto unrelated routes. Likewise openGraph.url
  // is per-page; the root only provides sensible shared OG defaults.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "AI Enterprise — Enterprise AI Market Intelligence",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Enterprise — Enterprise AI Market Intelligence",
    description: SITE_DESCRIPTION,
  },
};

// Inline script that runs before paint to apply the user's stored / preferred
// theme so we never flash the wrong colour scheme on first load. Mirrors the
// logic in lib/theme.ts but is plain JS so it can run pre-hydration.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var key = 'ai-enterprise-theme';
    var stored = window.localStorage.getItem(key);
    // Dark is the default — only honour an explicit user opt-in to
    // 'light' via the TopNav toggle. We intentionally ignore the OS
    // preference because the brand surfaces are designed dark-first.
    var theme = stored === 'light' ? 'light' : 'dark';
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.aiEnterpriseTheme = theme;
    root.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${plusJakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      {/* Minimal root: html/body, fonts, and the no-flash theme script only.
          All page chrome lives in the route-group layouts — app/(public) gets a
          lean, idle-reaching shell; app/(internal) gets the gated, live-polling
          dashboard shell. This separation is what lets public pages avoid the
          dashboard's pollers and reach document-idle. */}
      <body className="min-h-full bg-[#faf6ec] dark:bg-[#081410] text-[#123d2c] dark:text-[#eef3f8]">
        {children}
      </body>
    </html>
  );
}
