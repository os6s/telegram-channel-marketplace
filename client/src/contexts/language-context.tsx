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
    sellChannel: "Sell",
    activity: "Activity",
    profile: "Profile",

    // Marketplace
    welcomeTitle: "Channel Marketplace",
    welcomeDesc: "Buy and sell Telegram channels with secure escrow",
    searchPlaceholder: "Search channels...",
    categories: "Categories",
    allCategories: "All Categories",
    statueOfLiberty: "Statue of Liberty",
    torchOfFreedom: "Torch of Freedom",
    goldenEagle: "Golden Eagle",
    diamondHands: "Diamond Hands",
    cryptoPunk: "Crypto Punk",
    moonWalker: "Moon Walker",
    rocketShip: "Rocket Ship",
    unicornMagic: "Unicorn Magic",

    // Filters
    minSubscribers: "Min Subscribers",
    maxPrice: "Max Price (TON)",
    applyFilters: "Apply Filters",
    clearFilters: "Clear Filters",

    // Channel Card
    subscribers: "subscribers",
    verified: "Verified",
    buyNow: "Buy Now",

    // Sell Channel (and SellPage)
    chooseSellType: "Choose service type",
    sellUsername: "Sell Username",
    sellChannel: "Sell Channel",
    sellService: "Sell Service",
    back: "← Back",
    publishListing: "Publish Listing",
    selectPlatform: "Select platform",
    platformLabel: "Platform",
    usernameLabel: "Username",
    channelUsernameLabel: "Channel Username",
    giftTypeLabel: "Gift Type",
    serviceTypeLabel: "Service Type",
    priceLabel: "Price (TON)",
    descriptionLabel: "Description (Optional)",
    chooseGiftType: "Select gift type",
    followers: "Followers",
    subscribersCountLabel: "Number of Subscribers",
    followersCountLabel: "Number of Followers",
    giftCountLabel: "Number of gifts",
    addGift: "Add Gift",
    giftNameStatue: "🗽 Statue of Liberty",
    giftNameFlame: "🔥 Liberty Torch",

    // Toast & common
    error: "Error",
    success: "Success",
    openTelegramApp: "Open this app from Telegram.",
    invalidGifts: "Please specify valid gift types and counts.",
    listingSubmitted: "Your item is now live for sale!",
    somethingWentWrong: "Something went wrong. Please try again.",

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
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
  },
  ar: {
    // Navigation
    marketplace: "السوق",
    sellChannel: "بيع",
    activity: "النشاط",
    profile: "الملف الشخصي",

    // Marketplace
    welcomeTitle: "سوق القنوات",
    welcomeDesc: "شراء وبيع قنوات تليجرام مع ضمان آمن",
    searchPlaceholder: "البحث عن القنوات...",
    categories: "الفئات",
    allCategories: "جميع الفئات",
    statueOfLiberty: "تمثال الحرية",
    torchOfFreedom: "شعلة الحرية",
    goldenEagle: "النسر الذهبي",
    diamondHands: "الأيدي الماسية",
    cryptoPunk: "كريبتو بانك",
    moonWalker: "المشي على القمر",
    rocketShip: "سفينة الصاروخ",
    unicornMagic: "سحر وحيد القرن",

    // Filters
    minSubscribers: "الحد الأدنى للمشتركين",
    maxPrice: "الحد الأقصى للسعر (TON)",
    applyFilters: "تطبيق المرشحات",
    clearFilters: "مسح المرشحات",

    // Channel Card
    subscribers: "مشترك",
    verified: "موثق",
    buyNow: "اشتري الآن",

    // Sell Channel (and SellPage)
    chooseSellType: "اختر نوع الخدمة",
    sellUsername: "بيع يوزر",
    sellChannel: "بيع قناة",
    sellService: "بيع خدمة",
    back: "← رجوع",
    publishListing: "نشر العرض للبيع",
    selectPlatform: "اختر التطبيق",
    platformLabel: "نوع التطبيق",
    usernameLabel: "اليوزر",
    channelUsernameLabel: "اسم المستخدم للقناة",
    giftTypeLabel: "نوع الهدية",
    serviceTypeLabel: "نوع الخدمة",
    priceLabel: "السعر (TON)",
    descriptionLabel: "الوصف (اختياري)",
    chooseGiftType: "اختر نوع الهدية",
    followers: "متابعين",
    subscribersCountLabel: "عدد المشتركين",
    followersCountLabel: "عدد المتابعين",
    giftCountLabel: "عدد الهدايا",
    addGift: "إضافة هدية",
    giftNameStatue: "🗽 تمثال الحرية",
    giftNameFlame: "🔥 شعلة الحرية",

    // Toast & common
    error: "خطأ",
    success: "نجح",
    openTelegramApp: "افتح التطبيق من تيليجرام.",
    invalidGifts: "حدد نوع الهدية وعدد صحيح لكل هدية.",
    listingSubmitted: "العرض متوفر الآن للبيع!",
    somethingWentWrong: "حدث خطأ. حاول مرة أخرى.",

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
    cancel: "إلغاء",
    confirm: "تأكيد",
    save: "حفظ",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language") as Language;
      if (stored && (stored === "en" || stored === "ar")) {
        return stored;
      }
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code) {
        const telegramLang = window.Telegram.WebApp.initDataUnsafe.user.language_code;
        if (telegramLang.startsWith("ar")) return "ar";
      }
    }
    return "en";
  });

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("language", lang);
    }
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
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