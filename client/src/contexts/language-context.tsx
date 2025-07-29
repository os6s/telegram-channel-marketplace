import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "ar";

interface Translations {
  [key: string]: string;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Navigation
    marketplace: "Marketplace",
    sellChannel: "Sell Channel",
    guarantors: "Guarantors",
    profile: "Profile",
    
    // Marketplace
    welcomeTitle: "Channel Marketplace",
    welcomeDesc: "Buy and sell Telegram channels with secure escrow",
    searchPlaceholder: "Search channels...",
    categories: "Categories",
    allCategories: "All Categories",
    business: "Business",
    entertainment: "Entertainment",
    education: "Education",
    technology: "Technology",
    lifestyle: "Lifestyle",
    news: "News",
    guarantors: "Guarantors",
    
    // Filters
    minSubscribers: "Min Subscribers",
    maxPrice: "Max Price (TON)",
    applyFilters: "Apply Filters",
    clearFilters: "Clear Filters",
    
    // Channel Card
    subscribers: "subscribers",
    verified: "Verified",
    buyNow: "Buy Now",
    
    // Sell Channel
    sellChannelTitle: "Sell Your Channel",
    channelName: "Channel Name",
    channelUsername: "Channel Username (without @)",
    description: "Description",
    category: "Category",
    subscriberCount: "Subscriber Count",
    price: "Price (TON)",
    botToken: "Bot Token (for verification)",
    listChannel: "List Channel",
    
    // Wallet
    connectWallet: "Connect TON Wallet",
    walletConnected: "Wallet Connected",
    disconnect: "Disconnect",
    
    // Settings
    settings: "Settings",
    darkMode: "Dark Mode",
    language: "Language",
    english: "English",
    arabic: "العربية",
    
    // Common
    loading: "Loading...",
    error: "Error",
    success: "Success",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    save: "Save",
  },
  ar: {
    // Navigation
    marketplace: "السوق",
    sellChannel: "بيع قناة",
    guarantors: "الضامنين",
    profile: "الملف الشخصي",
    
    // Marketplace
    welcomeTitle: "سوق القنوات",
    welcomeDesc: "شراء وبيع قنوات تليجرام مع ضمان آمن",
    searchPlaceholder: "البحث عن القنوات...",
    categories: "الفئات",
    allCategories: "جميع الفئات",
    business: "الأعمال",
    entertainment: "الترفيه",
    education: "التعليم",
    technology: "التكنولوجيا",
    lifestyle: "نمط الحياة",
    news: "الأخبار",
    guarantors: "الضامنين",
    
    // Filters
    minSubscribers: "الحد الأدنى للمشتركين",
    maxPrice: "الحد الأقصى للسعر (TON)",
    applyFilters: "تطبيق المرشحات",
    clearFilters: "مسح المرشحات",
    
    // Channel Card
    subscribers: "مشترك",
    verified: "موثق",
    buyNow: "اشتري الآن",
    
    // Sell Channel
    sellChannelTitle: "بيع قناتك",
    channelName: "اسم القناة",
    channelUsername: "معرف القناة (بدون @)",
    description: "الوصف",
    category: "الفئة",
    subscriberCount: "عدد المشتركين",
    price: "السعر (TON)",
    botToken: "رمز البوت (للتحقق)",
    listChannel: "عرض القناة",
    
    // Wallet
    connectWallet: "ربط محفظة TON",
    walletConnected: "المحفظة متصلة",
    disconnect: "قطع الاتصال",
    
    // Settings
    settings: "الإعدادات",
    darkMode: "الوضع الليلي",
    language: "اللغة",
    english: "English",
    arabic: "العربية",
    
    // Common
    loading: "جار التحميل...",
    error: "خطأ",
    success: "نجح",
    cancel: "إلغاء",
    confirm: "تأكيد",
    back: "رجوع",
    save: "حفظ",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    // Always check localStorage first for user preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("language") as Language;
      if (stored && (stored === 'en' || stored === 'ar')) {
        return stored;
      }
      
      // Only use Telegram's language as fallback if no preference saved
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code) {
        const telegramLang = window.Telegram.WebApp.initDataUnsafe.user.language_code;
        if (telegramLang.startsWith('ar')) return 'ar';
      }
    }
    return "en";
  });

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem("language", lang);
    }
    
    // Update document direction for RTL support
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}