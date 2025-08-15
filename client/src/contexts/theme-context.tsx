import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeContextType {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystem(): Resolved {
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
    return "system"; // default for new users
  });

  const resolved: Resolved = useMemo(() => {
    if (theme === "system") return getSystem();
    return theme;
  }, [theme]);

  // Force apply theme immediately
  const applyThemeNow = (mode: ThemePref) => {
    setThemeState(mode);
    localStorage.setItem("theme", mode);
    const root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  };

  // Apply resolved theme when it changes
  useEffect(() => {
    const root = document.documentElement;
    if (resolved === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [resolved]);

  // Listen for system color scheme changes only in "system" mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      const root = document.documentElement;
      if (next === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Listen for Telegram theme changes only in "system" mode
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.onEvent) return;

    if (theme !== "system") {
      tg.offEvent?.("themeChanged");
      return;
    }

    const handler = () => {
      const scheme = tg.colorScheme as Resolved | undefined;
      if (!scheme) return;
      const root = document.documentElement;
      if (scheme === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };

    tg.onEvent?.("themeChanged", handler);
    return () => tg.offEvent?.("themeChanged", handler);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyThemeNow(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyThemeNow, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}