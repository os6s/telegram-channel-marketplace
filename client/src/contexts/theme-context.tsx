// client/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeContextType {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemResolved(): Resolved {
  if (typeof window === "undefined") return "light";
  const tg = (window as any)?.Telegram?.WebApp;
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") {
    return tg.colorScheme as Resolved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    try {
      const stored = localStorage.getItem("theme") as ThemePref | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {}
    return "system";
  });

  const resolved: Resolved = useMemo(
    () => (theme === "system" ? systemResolved() : theme),
    [theme]
  );

  // Apply resolved mode + force flag
  useEffect(() => {
    const root = document.documentElement;

    // dark class for Tailwind (darkMode: 'class')
    if (resolved === "dark") root.classList.add("dark");
    else root.classList.remove("dark");

    // add/remove force-theme to override Telegram injected variables when user chooses manually
    if (theme === "system") root.classList.remove("force-theme");
    else root.classList.add("force-theme");

    try { localStorage.setItem("theme", theme); } catch {}
  }, [resolved, theme]);

  // Listen to OS changes only when system
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const root = document.documentElement;
      if (mq.matches) root.classList.add("dark");
      else root.classList.remove("dark");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Listen to Telegram theme changes only when system
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.onEvent) return;
    if (theme !== "system") {
      tg.offEvent?.("themeChanged");
      return;
    }
    const handler = () => {
      const scheme = tg.colorScheme as Resolved | undefined;
      const root = document.documentElement;
      if (scheme === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    tg.onEvent("themeChanged", handler);
    return () => tg.offEvent?.("themeChanged", handler);
  }, [theme]);

  const setTheme = (t: ThemePref) => setThemeState(t);
  const toggleTheme = () => setThemeState(prev => (prev === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}