export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ai-enterprise-theme";

export const DEFAULT_THEME: Theme = "dark";

export function getStoredOrPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  // Brand surfaces are designed dark-first; ignore OS preference and
  // default to dark unless the user explicitly opts to light via the
  // TopNav toggle. Mirrors the pre-hydration script in app/layout.tsx.
  return DEFAULT_THEME;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.aiEnterpriseTheme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
