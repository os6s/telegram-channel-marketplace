import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getTelegramTheme } from "@/lib/telegram-webapp";

type Theme = "light" | "dark";
interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void; // حتى نقدر نغير الثيم مباشرة
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light"); // قيمة أولية آمنة

  // تطبيق كلاس الثيم + تخزينه
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  // أول تحميل: جلب من localStorage → Telegram → النظام
  useEffect(() => {
    try {
      const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as Theme | null;
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
        return;
      }
    } catch {}

    const tg = getTelegramTheme();
    if (tg?.colorScheme) {
      setTheme(tg.colorScheme === "dark" ? "dark" : "light");
      return;
    }

    if (typeof window !== "undefined") {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  // الاستماع لتغييرات الثيم من تيليجرام
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg?.onEvent) return;
    const handler = () => {
      const scheme = tg.colorScheme; // "dark" | "light"
      if (scheme === "dark" || scheme === "light") setTheme(scheme);
    };
    tg.onEvent?.("themeChanged", handler);
    return () => tg.offEvent?.("themeChanged", handler);
  }, []);

  // الاستماع لتغييرات النظام إذا ماكو تخزين يدوي
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (!mq) return;
    const onChange = () => {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored === "dark" || stored === "light") return; // المستخدم مختار يدوي
      setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));

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