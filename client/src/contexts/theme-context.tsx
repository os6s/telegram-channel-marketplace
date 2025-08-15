// client/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getTelegramTheme } from "@/lib/telegram-webapp";

type Theme = "light" | "dark";
interface ThemeContextType { theme: Theme; toggleTheme: () => void; }

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light"); // قيمة أولية آمنة

  // apply class + persist
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  // init from localStorage -> Telegram -> system
  useEffect(() => {
    try {
      const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as Theme | null;
      if (stored === "dark" || stored === "light") { setTheme(stored); return; }
    } catch {}

    const tg = getTelegramTheme();
    if (tg?.colorScheme) { setTheme(tg.colorScheme === "dark" ? "dark" : "light"); return; }

    if (typeof window !== "undefined") {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  // react to Telegram live theme changes (إن وُجدت)
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

  // react to system changes لو الثيم مو مخزّن (اختياري)
  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (!mq) return;
    const onChange = () => {
      // لا نغيّر لو المستخدم اختار يدويًا وخزّناه
      const stored = (localStorage.getItem("theme") as Theme | null);
      if (stored === "dark" || stored === "light") return;
      setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}