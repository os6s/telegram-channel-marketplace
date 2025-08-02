import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, TrendingUp, Users, Shield } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { WalletConnect } from "@/components/wallet-connect";
import { type Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

// النصوص حسب اللغة
const textMap = {
  en: {
    title: "Digital Marketplace",
    subtitle: "Platform for Buying & Selling Digital Assets",
    activeListings: "Active Listings",
    totalVolume: "Total Volume",
    sold: "Sold",
    searchPlaceholder: "Search channels, usernames, or services...",
    allTypes: "All Types",
    telegramUser: "Telegram User",
    instagramUser: "Instagram User",
    twitterUser: "Twitter User",
    serviceFollowers: "Followers Service",
    serviceSubscribers: "Subscribers Service",
    noChannelsFound: "No channels or listings found",
    tryFilters: "Try adjusting your filters or search query",
    sortByPrice: "Sort: Price Low to High",
    loadMore: "Load More Listings",
  },
  ar: {
    title: "السوق الرقمي",
    subtitle: "منصة شراء وبيع الاصول الرقمية",
    activeListings: "القوائم النشطة",
    totalVolume: "الإجمالي",
    sold: "المباع",
    searchPlaceholder: "ابحث عن يوزرات، قنوات أو خدمات...",
    allTypes: "كل الأنواع",
    telegramUser: "يوزر تليجرام",
    instagramUser: "يوزر انستاغرام",
    twitterUser: "يوزر تويتر",
    serviceFollowers: "خدمة متابعين",
    serviceSubscribers: "خدمة مشتركين",
    noChannelsFound: "لم يتم العثور على قنوات أو عروض",
    tryFilters: "حاول تعديل الفلاتر أو نص البحث",
    sortByPrice: "ترتيب: السعر من الأقل للأعلى",
    loadMore: "تحميل المزيد من العروض",
  },
};

export default function Marketplace() {
  const { t, language } = useLanguage();
  const { theme } = useTheme(); // 'light' أو 'dark'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [filters, setFilters] = useState<{
    minFollowers?: number;
    maxPrice?: string;
    verifiedOnly?: boolean;
  }>({});

  // اختيار النص حسب اللغة
  const texts = textMap[language] || textMap.en;

  // أنواع القوائم المتاحة (معدل حسب طلبك)
  const listingTypes = [
    { id: "telegramUser", label: texts.telegramUser },
    { id: "instagramUser", label: texts.instagramUser },
    { id: "twitterUser", label: texts.twitterUser },
    { id: "serviceFollowers", label: texts.serviceFollowers },
    { id