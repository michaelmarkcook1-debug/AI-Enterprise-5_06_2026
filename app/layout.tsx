import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import GlobalFooter from "@/components/GlobalFooter";
import AmbientHeroBackdrop from "@/components/AmbientHeroBackdrop";
import NotLiveBanner from "@/components/NotLiveBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Enterpise — Enterprise AI Market Intelligence",
  description: "Executive market intelligence portal for enterprise AI: vendor rankings, market share, agentic momentum, news, capabilities, and platform-fit assessment.",
};

// Inline script that runs before paint to apply the user's stored / preferred
// theme so we never flash the wrong colour scheme on first load. Mirrors the
// logic in lib/theme.ts but is plain JS so it can run pre-hydration.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var key = 'ai-enterprise-theme';
    var stored = window.localStorage.getItem(key);
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-[#071827] text-zinc-900 dark:text-zinc-100">
        <AmbientHeroBackdrop />
        <div className="relative z-10 flex flex-1 flex-col">
          <TopNav />
          <NotLiveBanner />
          <div className="flex-1">{children}</div>
          <GlobalFooter />
        </div>
      </body>
    </html>
  );
}
