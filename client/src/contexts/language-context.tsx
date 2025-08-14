import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

type Language = "en" | "ar";
type Dict = Record<string, any>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const bundles: Record<Language, Dict> = { en, ar };

function getByPath(obj: Dict, path: string): string | undefined {
  return path
    .split(".")
    .reduce<any>((acc, k) => {
      if (acc && typeof acc === "object" && k in acc) return acc[k];
      return undefined;
    }, obj);
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language") as Language | null;
      if (stored === "en" || stored === "ar") return stored;
      const tg = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      if (tg?.startsWith("ar")) return "ar";
    }
    return "en";
  });

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(
    () => (key: string) => {
      const val = getByPath(bundles[language], key);
      return (typeof val === "string" ? val : undefined) ?? key;
    },
    [language]
  );

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== "undefined") localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}