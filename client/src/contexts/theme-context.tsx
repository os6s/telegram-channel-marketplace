// client/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeCtx { theme: ThemePref; setTheme: (t: ThemePref)=>void; toggleTheme: ()=>void; }
const Ctx = createContext<ThemeCtx | undefined>(undefined);

function systemResolved(): Resolved {
  if (typeof window === "undefined") return "light";
  const tg = (window as any)?.Telegram?.WebApp;
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    try {
      const s = localStorage.getItem("theme") as ThemePref | null;
      if (s === "light" || s === "dark" || s === "system") return s;
    } catch {}
    return "system";
  });

  const resolved: Resolved = useMemo(() => (theme === "system" ? systemResolved() : theme), [theme]);

  useEffect(() => {
    const root = document.documentElement;
    // فعّل/عطّل dark
    if (resolved === "dark") root.classList.add("dark"); else root.classList.remove("dark");
    // أضف force-theme لمنع Telegram من تغطية الألوان في الوضع اليدوي
    if (theme === "system") root.classList.remove("force-theme"); else root.classList.add("force-theme");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [resolved, theme]);

  // استمع لتغيير نظام الجهاز في وضع system فقط
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const root = document.documentElement;
      if (mq.matches) root.classList.add("dark"); else root.classList.remove("dark");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // استمع لتغيّر ثيم تيليجرام في وضع system فقط
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.onEvent || theme !== "system") return;
    const handler = () => {
      const scheme = tg.colorScheme as Resolved | undefined;
      const root = document.documentElement;
      if (scheme === "dark") root.classList.add("dark"); else root.classList.remove("dark");
    };
    tg.onEvent("themeChanged", handler);
    return () => tg.offEvent?.("themeChanged", handler);
  }, [theme]);

  const setTheme = (t: ThemePref) => setThemeState(t);
  const toggleTheme = () => setThemeState(p => (p === "dark" ? "light" : "dark"));

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}