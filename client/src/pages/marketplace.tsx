import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, TrendingUp, Users, Shield } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { WalletConnect } from "@/components/wallet-connect";
import { type Channel } from "@shared/schema";

const categories = [
  { id: 'Cryptocurrency', name: 'Cryptocurrency', icon: '🪙' },
  { id: 'NFT Collection', name: 'NFT Collection', icon: '🎁' },
  { id: 'Technology', name: 'Technology', icon: '💻' },
  { id: 'Gaming', name: 'Gaming', icon: '🎮' },
  { id: 'Entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'Education', name: 'Education', icon: '🎓' },
  { id: 'Business', name: 'Business', icon: '💼' },
];

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [filters, setFilters] = useState<{
    minSubscribers?: number;
    maxPrice?: string;
    verifiedOnly?: boolean;
  }>({});

  // Fetch marketplace stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
  });

  // Fetch channels with filters
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['/api/channels', selectedCategory, searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (filters.minSubscribers) params.append('minSubscribers', filters.minSubscribers.toString());
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      
      const response = await fetch(`/api/channels?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    },
  });

  const handleViewDetails = (channel: Channel) => {
    console.log('View details for channel:', channel.id);
    // TODO: Implement channel details modal or navigation
  };

  const handleBuyNow = (channel: Channel) => {
    console.log('Buy channel:', channel.id);
    // TODO: Implement escrow creation flow
  };

  const toggleFilter = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key as keyof typeof prev] === value ? undefined : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-telegram-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Channel Marketplace</h1>
                <p className="text-xs text-gray-500">Buy & Sell Telegram Channels</p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search channels by name, niche, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 focus:ring-telegram-500 focus:border-telegram-500"
            />
          </div>

          {/* Category Filters */}
          <div className="flex overflow-x-auto pb-2 space-x-2 scrollbar-hide">
            <Button
              variant={selectedCategory === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("")}
              className={selectedCategory === "" ? "bg-telegram-500 hover:bg-telegram-600" : ""}
            >
              All Categories
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap ${
                  selectedCategory === category.id ? "bg-telegram-500 hover:bg-telegram-600" : ""
                }`}
              >
                {category.icon} {category.name}
              </Button>
            ))}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.minSubscribers === 10000 ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('minSubscribers', 10000)}
              className={filters.minSubscribers === 10000 ? "bg-blue-500 hover:bg-blue-600" : ""}
            >
              <Users className="w-3 h-3 mr-1" />
              10K+ Subscribers
            </Button>
            <Button
              variant={filters.verifiedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFilter('verifiedOnly', true)}
              className={filters.verifiedOnly ? "bg-green-500 hover:bg-green-600" : ""}
            >
              <Shield className="w-3 h-3 mr-1" />
              Verified Only
            </Button>
          </div>
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
            <div className="text-sm opacity-90">Active Listings</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Skeleton className="h-6 w-20 bg-white/20 mx-auto" />
              ) : (
                `${(stats as any)?.totalVolume || '0'} TON`
              )}
            </div>
            <div className="text-sm opacity-90">Total Volume</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Skeleton className="h-6 w-12 bg-white/20 mx-auto" />
              ) : (
                (stats as any)?.activeEscrows || 0
              )}
            </div>
            <div className="text-sm opacity-90">Active Escrows</div>
          </div>
        </div>
      </div>

      {/* Channel Listings */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} Channels` : 'Featured Channels'}
          </h2>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            Sort: Price Low to High
          </Button>
        </div>

        {/* Loading State */}
        {channelsLoading && (
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

        {/* Channel Grid */}
        {!channelsLoading && (
          <div className="space-y-4">
            {channels.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-gray-400 text-lg mb-2">📭</div>
                  <h3 className="font-medium text-gray-900 mb-1">No channels found</h3>
                  <p className="text-sm text-gray-500">
                    Try adjusting your filters or search query
                  </p>
                </CardContent>
              </Card>
            ) : (
              channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onViewDetails={handleViewDetails}
                  onBuyNow={handleBuyNow}
                />
              ))
            )}
          </div>
        )}

        {/* Load More */}
        {!channelsLoading && channels.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" className="px-6">
              <TrendingUp className="w-4 h-4 mr-2" />
              Load More Channels
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
