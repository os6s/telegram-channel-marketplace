// client/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";
const Ctx = createContext<{theme: ThemePref; setTheme: (t: ThemePref)=>void; toggleTheme: ()=>void} | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => (localStorage.getItem("theme") as ThemePref) || "system");

  const apply = (pref: ThemePref) => {
    setThemeState(pref);
    try { localStorage.setItem("theme", pref); } catch {}
    const root = document.documentElement;

    // إذا مو "system" نفعل القوة
    if (pref === "dark") {
      root.classList.add("force-theme","dark");
    } else if (pref === "light") {
      root.classList.add("force-theme");
      root.classList.remove("dark");
    } else {
      // system: رجّع التحكم للنظام/تيليجرام
      root.classList.remove("force-theme");
      // اختياري: طبّق dark حسب النظام/تيليجرام لحظةً
      const tg = (window as any)?.Telegram?.WebApp;
      const isDark = tg?.colorScheme ? tg.colorScheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    }
  };

  useEffect(() => { apply(theme); /* أول تحميل */  // eslint-disable-line
  }, []);

  const setTheme = (t: ThemePref) => apply(t);
  const toggleTheme = () => setThemeState(prev => {
    const next = prev === "dark" ? "light" : "dark";
    apply(next);
    return next;
  });

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}