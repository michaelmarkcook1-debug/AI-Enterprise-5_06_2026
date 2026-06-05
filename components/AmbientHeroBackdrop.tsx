"use client";

import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";

/**
 * Subtle full-app backdrop that embeds the AI Enterprise hero behind every
 * page. Suppressed on `/` because the home shell renders its own foreground
 * hero. The image is heavily blurred + low-opacity so it acts as ambient
 * brand colour, never competing with content.
 *
 * Pointer-events disabled and z-index 0 so it cannot intercept clicks. The
 * page chrome (TopNav, GlobalFooter) and main content sit above it via
 * normal block-flow stacking.
 */
export default function AmbientHeroBackdrop() {
  const pathname = usePathname();
  const [theme] = usePortalTheme();

  // Skip on the home shell — it already paints a full hero.
  if (pathname === "/") return null;

  const opacity = theme === "dark" ? 0.18 : 0.08;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      <div
        className="absolute inset-[-18%]"
        style={{
          background:
            "radial-gradient(circle at 24% 18%, rgba(52,211,153,0.28), transparent 24%), radial-gradient(circle at 76% 12%, rgba(245,196,81,0.18), transparent 22%), radial-gradient(circle at 52% 68%, rgba(34,211,238,0.22), transparent 28%)",
          filter: "blur(84px) saturate(0.9)",
          opacity,
        }}
      />
      {/* Soft tint so the backdrop never tips into "noisy". */}
      <div
        className="absolute inset-0"
        style={{
          background:
            theme === "dark"
              ? "linear-gradient(180deg, rgba(7,24,39,0.72) 0%, rgba(7,24,39,0.92) 100%)"
              : "linear-gradient(180deg, rgba(247,248,245,0.86) 0%, rgba(247,248,245,0.94) 100%)",
        }}
      />
    </div>
  );
}
