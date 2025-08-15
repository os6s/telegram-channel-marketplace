import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";   // تفضيل المستخدم
type Resolved = "light" | "dark";               // الثيم الفعلي المطبق

interface ThemeContextType {
  theme: ThemePref;                  // ما يراه المستخدم (light/dark/system)
  setTheme: (t: ThemePref) => void;  // يحدد التفضيل
  toggleTheme: () => void;           // سويتش سريع بين light/dark
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystem(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePref>(() => {
    try {
      const stored = localStorage.getItem("theme") as ThemePref | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {}
    return "system";
  });

  // احسب الثيم الفعلي المطبق
  const resolved: Resolved = useMemo(() => {
    if (theme === "system") return getSystem();
    return theme;
  }, [theme]);

  // طبّق/أزل كلاس dark + خزّن التفضيل
  useEffect(() => {
    const root = document.documentElement;
    if (resolved === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [resolved, theme]);

  // استمع لتغيّر النظام إذا كان التفضيل "system"
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

  // (اختياري) لا نسمح لتيليجرام يغيّر بعد ما المستخدم يختار يدوياً
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.onEvent) return;
    const handler = () => {
      // طبّق فقط إذا التفضيل "system"
      const pref = (localStorage.getItem("theme") as ThemePref | null) || "system";
      if (pref !== "system") return;
      const scheme = tg.colorScheme as Resolved | undefined;
      if (!scheme) return;
      const root = document.documentElement;
      if (scheme === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    tg.onEvent?.("themeChanged", handler);
    return () => tg.offEvent?.("themeChanged", handler);
  }, []);

  const toggleTheme = () => setTheme(prev => (prev === "dark" ? "light" : "dark"));

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