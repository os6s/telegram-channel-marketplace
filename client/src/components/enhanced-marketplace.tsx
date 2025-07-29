import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Settings, Wallet } from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { EnhancedWalletConnect } from "@/components/enhanced-wallet-connect";
import { SettingsModal } from "@/components/settings-modal";
import { useLanguage } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { type Channel } from "@shared/schema";

const categories = [
  { id: '', name: 'allCategories', icon: '📂' },
  { id: 'statueOfLiberty', name: 'statueOfLiberty', icon: '🗽' },
  { id: 'torchOfFreedom', name: 'torchOfFreedom', icon: '🔥' },
  { id: 'goldenEagle', name: 'goldenEagle', icon: '🦅' },
  { id: 'diamondHands', name: 'diamondHands', icon: '💎' },
  { id: 'cryptoPunk', name: 'cryptoPunk', icon: '👾' },
  { id: 'moonWalker', name: 'moonWalker', icon: '🌙' },
  { id: 'rocketShip', name: 'rocketShip', icon: '🚀' },
  { id: 'unicornMagic', name: 'unicornMagic', icon: '🦄' },
  { id: 'guarantors', name: 'guarantors', icon: '🛡️' },
];

export default function EnhancedMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    minSubscribers?: number;
    maxPrice?: string;
    verifiedOnly?: boolean;
  }>({});

  const { t, language } = useLanguage();
  const { theme } = useTheme();

  // Define the stats type
  type MarketplaceStats = {
    activeListings: number;
    totalVolume: string;
    activeEscrows: number;
  };

  // Fetch marketplace stats
  const { data: stats, isLoading: statsLoading } = useQuery<MarketplaceStats>({
    queryKey: ['/api/stats'],
  });

  // Type-safe stats with fallback
  const safeStats = stats || { activeListings: 0, totalVolume: '0.00', activeEscrows: 0 };

  // Fetch channels with filters - use useCallback to prevent recreation
  const { data: channels = [], isLoading: channelsLoading, refetch } = useQuery({
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

  // Improved category selection with smooth transition instead of page reload
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    // The query will automatically refetch due to the dependency change
  }, []);

  const handleViewDetails = (channel: Channel) => {
    console.log('View details for channel:', channel.id);
    // TODO: Implement channel details modal
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
    <div className={`min-h-screen bg-background transition-colors duration-200 ${language === 'ar' ? 'font-arabic' : ''}`}>
      {/* Enhanced Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-opacity-90">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-primary/10 p-2 rounded-lg">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('welcomeTitle')}</h1>
                <p className="text-sm text-muted-foreground">{t('welcomeDesc')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <EnhancedWalletConnect />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowSettings(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {!statsLoading && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-primary">{safeStats.activeListings}</div>
                  <div className="text-xs text-muted-foreground">Active Listings</div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-green-600">{safeStats.totalVolume}</div>
                  <div className="text-xs text-muted-foreground">TON Volume</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{safeStats.activeEscrows}</div>
                  <div className="text-xs text-muted-foreground">Active Escrows</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </header>

      {/* Search and Filter Bar */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 rtl:left-auto rtl:right-3" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 rtl:pl-4 rtl:pr-10"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="px-3"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Enhanced Category Navigation */}
        <div className="mt-3">
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleCategorySelect(category.id)}
                className="flex-shrink-0 flex items-center gap-2 transition-all duration-200"
              >
                <span>{category.icon}</span>
                <span className="text-sm">{t(category.name)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">{t('minSubscribers')}</label>
                <Input
                  type="number"
                  placeholder="1000"
                  min="0"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '0') {
                      toggleFilter('minSubscribers', undefined);
                    } else {
                      const num = parseInt(value);
                      if (!isNaN(num) && num > 0) {
                        toggleFilter('minSubscribers', num);
                      }
                    }
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('maxPrice')}</label>
                <Input
                  type="number"
                  placeholder="100"
                  min="0"
                  step="0.01"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '0') {
                      toggleFilter('maxPrice', undefined);
                    } else {
                      const num = parseFloat(value);
                      if (!isNaN(num) && num > 0) {
                        toggleFilter('maxPrice', value);
                      }
                    }
                  }}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                {t('clearFilters')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(false)}>
                {t('applyFilters')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Channels Grid */}
      <div className="px-4 py-6">
        {channelsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : channels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel: Channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onViewDetails={handleViewDetails}
                onBuyNow={handleBuyNow}
                currentUser={{ username: "Os6s7" }} // Mock user for admin testing
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No channels found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          open={showSettings} 
          onOpenChange={setShowSettings} 
        />
      )}
    </div>
  );
}