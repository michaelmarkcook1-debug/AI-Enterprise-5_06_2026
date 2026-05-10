"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { applyTheme, getStoredOrPreferredTheme, persistTheme, type Theme } from "@/lib/theme";

const THEME_CHANGE_EVENT = "ai-enterprise-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): Theme {
  return getStoredOrPreferredTheme();
}

function getServerSnapshot(): Theme {
  return "light";
}

export function usePortalTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    persistTheme(nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return [theme, setTheme] as const;
}
