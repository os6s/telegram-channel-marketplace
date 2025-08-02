import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, TrendingUp, Users, Shield } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { WalletConnect } from "@/components/wallet-connect";
import { type Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";

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
    title: "Digital Marketplace",          // ممكن تحط ترجمة عربية هنا اذا تريد
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
};

export default function Marketplace() {
  const { language } = useLanguage();
  const texts = textMap[language] || textMap.en;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [filters, setFilters] = useState<{
    minFollowers?: number;
    maxPrice?: string;
    verifiedOnly?: boolean;
  }>({});

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-telegram-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{texts.title}</h1>
              <p className="text-xs text-gray-500">{texts.subtitle}</p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Search and Type Filters */}
      <div className="bg-white px-4 py-4 border-b border-gray-100 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder={texts.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 border border-gray-200 focus:ring-telegram-500 focus:border-telegram-500 w-full rounded-md py-2"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
            10K+ Followers
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
        </div>
      </div>

      {/* Marketplace Stats */}
      <div className="bg-gradient-to-r from-telegram-500 to-telegram-600 px-4 py-6 text-white">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Skeleton className="h-6 w-16 bg-white/20 mx-auto" />
              ) : (
                (stats as any)?.activeListings || 0
              )}
            </div>
            <div className="text-sm opacity-90">{texts.activeListings}</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Skeleton className="h-6 w-20 bg-white/20 mx-auto" />
              ) : (
                `${(stats as any)?.totalVolume || "0"} TON`
              )}
            </div>
            <div className="text-sm opacity-90">{texts.totalVolume}</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Skeleton className="h-6 w-12 bg-white/20 mx-auto" />
              ) : (
                (stats as any)?.activeEscrows || 0
              )}
            </div>
            <div className="text-sm opacity-90">{texts.sold}</div>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
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
                  <h3 className="font-medium text-gray-900 mb-1">{texts.noChannelsFound}</h3>
                  <p className="text-sm text-gray-500">{texts.tryFilters}</p>
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