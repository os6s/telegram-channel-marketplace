import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ThemePref = "light" | "dark" | "system";

type CtxType = {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<CtxType | undefined>(undefined);

function getSystemIsDark() {
  if (typeof window === "undefined") return false;
  const tg = (window as any)?.Telegram?.WebApp;
  if (tg?.colorScheme === "dark") return true;
  if (tg?.colorScheme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function clearTelegramCssVars(root: HTMLElement) {
  // إزالة قيم تيليجرام عند الوضع اليدوي
  root.style.removeProperty("--tg-theme-bg-color");
  root.style.removeProperty("--tg-theme-text-color");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    const saved = localStorage.getItem("theme") as ThemePref | null;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });

  const apply = (pref: ThemePref) => {
    setThemeState(pref);
    try { localStorage.setItem("theme", pref); } catch {}
    const root = document.documentElement;

    if (pref === "system") {
      // ارجع التحكم لتيليجرام/النظام
      root.classList.remove("force-theme");
      root.classList.toggle("dark", getSystemIsDark());
      return;
    }

    // وضع يدوي: فرض الثيم وإبطال تأثير تيليجرام
    root.classList.add("force-theme");
    if (pref === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    clearTelegramCssVars(root);
  };

  // تفعيل عند الإقلاع
  useEffect(() => { apply(theme); /* eslint-disable-next-line */ }, []);

  // استماع لتغيّر ثيم النظام/تيليجرام عند system فقط
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => document.documentElement.classList.toggle("dark", getSystemIsDark());
    mq.addEventListener?.("change", onSystem);

    const tg = (window as any)?.Telegram?.WebApp;
    const onTg = () => onSystem();
    tg?.onEvent?.("themeChanged", onTg);

    return () => {
      mq.removeEventListener?.("change", onSystem);
      tg?.offEvent?.("themeChanged", onTg);
    };
  }, [theme]);

  const setTheme = (t: ThemePref) => apply(t);
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

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