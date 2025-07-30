import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, Users, TrendingUp, Zap, CheckCircle } from "lucide-react";
import { AdminControls } from "@/components/admin-controls";
import { type Channel } from "@shared/schema";

interface ChannelCardProps {
  channel: Channel;
  onViewDetails: (channel: Channel) => void;
  onBuyNow: (channel: Channel) => void;
  currentUser?: { username?: string };
}

const categoryIcons: Record<string, string> = {
  "Cryptocurrency": "🪙",
  "NFT Collection": "🎁", 
  "Technology": "💻",
  "Gaming": "🎮",
  "Entertainment": "🎬",
  "Education": "🎓",
  "Business": "💼",
  "News": "📰"
};

const categoryColors: Record<string, string> = {
  "Cryptocurrency": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "NFT Collection": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Technology": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", 
  "Gaming": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Entertainment": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Education": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Business": "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  "News": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

export function ChannelCard({ channel, onViewDetails, onBuyNow, currentUser }: ChannelCardProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPrice = (price: string): { ton: string; usd: string } => {
    const tonAmount = parseFloat(price);
    const usdAmount = tonAmount * 5.1; // Mock conversion rate
    return {
      ton: tonAmount.toLocaleString(),
      usd: usdAmount.toLocaleString()
    };
  };

  const { ton, usd } = formatPrice(channel.price);

  return (
    <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-telegram-500 to-telegram-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {channel.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{channel.name}</h3>
              {channel.isVerified && (
                <CheckCircle className="w-4 h-4 text-telegram-500" />
              )}
              <Badge 
                variant="secondary" 
                className={categoryColors[channel.category] || "bg-gray-100 text-gray-800"}
              >
                {categoryIcons[channel.category]} {channel.category}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">@{channel.username}</p>
            <p className="text-sm text-gray-500 line-clamp-2">{channel.description}</p>
          </div>
        </div>

        {/* Channel Metrics */}
        <div className="grid grid-cols-3 gap-4 mt-4 py-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-lg font-semibold text-gray-900">
              <Users className="w-4 h-4" />
              <span>{formatNumber(channel.subscribers)}</span>
            </div>
            <div className="text-xs text-gray-500">Subscribers</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-lg font-semibold text-green-600">
              <Zap className="w-4 h-4" />
              <span>{channel.engagement}%</span>
            </div>
            <div className="text-xs text-gray-500">Engagement</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 text-lg font-semibold text-blue-600">
              <TrendingUp className="w-4 h-4" />
              <span>{parseFloat(channel.growth) > 0 ? '+' : ''}{channel.growth}%</span>
            </div>
            <div className="text-xs text-gray-500">Growth</div>
          </div>
        </div>

        {/* Price and Actions */}
        <div className="flex items-center justify-between mt-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{ton} TON</div>
            <div className="text-sm text-gray-500">≈ ${usd} USD</div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(channel)}
              className="text-gray-700"
            >
              <Eye className="w-4 h-4 mr-1" />
              View Details
            </Button>
            <Button
              size="sm"
              onClick={() => onBuyNow(channel)}
              className="bg-telegram-500 hover:bg-telegram-600 text-white"
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Buy Now
            </Button>
          </div>
        </div>
        
        {/* Admin Controls for @Os6s7 */}
        <AdminControls channel={channel} currentUser={currentUser} />
      </CardContent>
    </Card>
  );
}
