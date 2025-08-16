// client/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";

type CtxType = {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<CtxType | undefined>(undefined);

function resolveSystem(): "light" | "dark" {
  const tg = (window as any)?.Telegram?.WebApp;
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyDOM(pref: ThemePref) {
  const root = document.documentElement;
  // when user forces a theme -> add .force-theme and control .dark
  if (pref === "dark") {
    root.classList.add("force-theme", "dark");
  } else if (pref === "light") {
    root.classList.add("force-theme");
    root.classList.remove("dark");
  } else {
    // system: remove forcing and follow Telegram/system instantly
    root.classList.remove("force-theme");
    root.classList.toggle("dark", resolveSystem() === "dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as ThemePref | null;
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  // first paint
  useEffect(() => { applyDOM(theme); }, []); // eslint-disable-line

  // persist + apply on change
  useEffect(() => {
    try { localStorage.setItem("theme", theme); } catch {}
    applyDOM(theme);
  }, [theme]);

  // react to system changes only in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDOM("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // react to Telegram theme changes only in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const tg = (window as any)?.Telegram?.WebApp;
    const handler = () => applyDOM("system");
    tg?.onEvent?.("themeChanged", handler);
    return () => tg?.offEvent?.("themeChanged", handler);
  }, [theme]);

  const setTheme = (t: ThemePref) => setThemeState(t);
  const toggleTheme = () => setThemeState((p) => (p === "dark" ? "light" : "dark"));

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