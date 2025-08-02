import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, TrendingUp, Users, Shield } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { type Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

// النصوص حسب اللغة
const textMap = {
  en: {
    title: "Digital Marketplace",
    subtitle: "Platform for Buying & Selling Digital Assets",
    activeListings: "Active Listings",
    totalVolume: "Sales Volume",
    sold: "Sales Count",
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
    salesCountLabel: "Sales Count",
    salesVolumeLabel: "Sales Volume",
    activeListingsLabel: "Active Listings",
  },
  ar: {
    title: "السوق الرقمي",
    subtitle: "منصة شراء وبيع الاصول الرقمية",
    activeListings: "اجمالي المعروض",
    totalVolume: "حجم المبيعات",
    sold: "عدد المبيعات",
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
    salesCountLabel: "عدد المبيعات",
    salesVolumeLabel: "حجم المبيعات",
    activeListingsLabel: "اجمالي المعروض",
  },
};

export default function Marketplace() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [filters, setFilters] = useState<{
    minFollowers?: number;
    maxPrice?: string;
    verifiedOnly?: boolean;
  }>({});

  const texts = textMap[language] || textMap.en;

  const listingTypes = [
    { id: "telegramUser", label: texts.telegramUser },
    { id: "instagramUser", label: texts.instagramUser },
    { id: "twitterUser", label: texts.twitterUser },
    { id: "serviceFollowers", label: texts.serviceFollowers },
    { id: "serviceSubscribers", label: texts.serviceSubscribers },
  ];

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["/api/listings", selectedType, searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType) params.append("type", selectedType);
      if (searchQuery) params.append("search", searchQuery);
      if (filters.minFollowers) params.append("minFollowers", filters.minFollowers.toString());
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.verifiedOnly) params.append("verifiedOnly", "true");

      const response = await fetch(`/api/listings?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch listings");
      return response.json();
    },
  });

  const toggleFilter = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key as keyof typeof prev] === value ? undefined : value,
    }));
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-telegram-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold">{texts.title}</h1>
                <p className="text-xs opacity-70">{texts.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          {!statsLoading && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {/* عدد المبيعات */}
              <Card className="border border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{(stats as any)?.sold || 0}</div>
                  <div className="text-sm mt-1">{texts.salesCountLabel}</div>
                </CardContent>
              </Card>

              {/* حجم المبيعات */}
              <Card className="border border-green-500 bg-green-50 dark:bg-green-900 dark:border-green-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold flex justify-center items-center gap-1">
                    {(stats as any)?.totalVolume || 0} <span>USDT</span>
                  </div>
                  <div className="text-sm mt-1">{texts.salesVolumeLabel}</div>
                </CardContent>
              </Card>

              {/* المعروض حاليًا */}
              <Card className="border border-cyan-500 bg-cyan-50 dark:bg-cyan-900 dark:border-cyan-700">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{(stats as any)?.activeListings || 0}</div>
                  <div className="text-sm mt-1">{texts.activeListingsLabel}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </header>

      {/* Search and Type Filters */}
      <div className="bg-card px-4 py-4 border-b border-border">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Input
              placeholder={texts.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          </div>

          {/* Listing Type Filters */}
          <div className="flex overflow-x-auto pb-2 space-x-2 scrollbar-hide">
            <Button
              variant={selectedType === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType("")}
              className={selectedType === "" ? "bg-telegram-500 hover:bg-telegram-600" : ""}
            >
              {texts.allTypes}
            </Button>
            {listingTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(type.id)}
                className={`whitespace-nowrap ${
                  selectedType === type.id ? "bg-telegram-500 hover:bg-telegram-600" : ""
                }`}
              >
                {type.label}
              </Button>
            ))}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.minFollowers === 10000 ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter("minFollowers", 10000)}
              className={filters.minFollowers === 10000 ? "bg-blue-500 hover:bg-blue-600" : ""}
            >
              <Users className="w-3 h-3 mr-1" />
              +10000 Followers
            </Button>
            <Button
              variant={filters.verifiedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter("verifiedOnly", true)}
              className={filters.verifiedOnly ? "bg-green-500 hover:bg-green-600" : ""}
            >
              <Shield className="w-3 h-3 mr-1" />
              Verified Only
            </Button>
            <Button
              variant={"outline"}
              size="sm"
              onClick={() => setFilters({})}
              className="bg-telegram-500 hover:bg-telegram-600 text-white"
            >
              حذف التحديد
            </Button>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {selectedType
              ? listingTypes.find((c) => c.id === selectedType)?.label
              : texts.allTypes}
          </h2>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            {texts.sortByPrice}
          </Button>
        </div>

        {/* Loading State */}
        {listingsLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Listings */}
        {!listingsLoading && (
          <div className="space-y-4">
            {listings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-gray-400 text-lg mb-2">📭</div>
                  <h3 className="font-medium mb-1">{texts.noChannelsFound}</h3>
                  <p className="text-sm opacity-70">{texts.tryFilters}</p>
                </CardContent>
              </Card>
            ) : (
              listings.map((listing: Channel) => (
                <ChannelCard
                  key={listing.id}
                  channel={listing}
                  onViewDetails={() => console.log("View details for", listing.id)}
                  onBuyNow={() => console.log("Buy listing", listing.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Load More Button */}
        {!listingsLoading && listings.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" className="px-6">
              <TrendingUp className="w-4 h-4 mr-2" />
              {texts.loadMore}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}