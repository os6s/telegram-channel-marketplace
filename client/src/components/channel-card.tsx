import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, Users, TrendingUp, Zap, CheckCircle, X } from "lucide-react";
import { AdminControls } from "@/components/admin-controls";
import { type Channel } from "@shared/schema";

interface ChannelCardProps {
  channel: Channel & {
    gifts?: {
      statueOfLiberty?: number;
      torchOfFreedom?: number;
    };
  };
  onViewDetails: (channel: Channel) => void;
  onBuyNow: (channel: Channel) => void;
  currentUser?: { username?: string };
}

export function ChannelCard({ channel, onViewDetails, onBuyNow, currentUser }: ChannelCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatPrice = (price: string): { ton: string; usd: string } => {
    const tonAmount = parseFloat(price);
    const usdAmount = tonAmount * 5.1; // سعر افتراضي بالدولار
    return {
      ton: tonAmount.toLocaleString(),
      usd: usdAmount.toLocaleString(),
    };
  };

  const { ton, usd } = formatPrice(channel.price);

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-telegram-500 to-telegram-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {channel.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{channel.name}</h3>
                {channel.isVerified && <CheckCircle className="w-4 h-4 text-telegram-500" />}
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-800"
                >
                  {/* Category icon لو حاب تضيف */}
                  {channel.category}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-2">@{channel.username}</p>
              <p className="text-sm text-gray-500 line-clamp-2">{channel.description}</p>
            </div>
          </div>

          {/* Metrics */}
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
                <span>{parseFloat(channel.growth) > 0 ? "+" : ""}{channel.growth}%</span>
              </div>
              <div className="text-xs text-gray-500">Growth</div>
            </div>
          </div>

          {/* Price and Buttons */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">{ton} TON</div>
              <div className="text-sm text-gray-500">≈ ${usd} USD</div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfo(true)}
                className="text-gray-700"
              >
                <Eye className="w-4 h-4 mr-1" />
                Info
              </Button>
              <Button
                size="sm"
                onClick={() => setShowBuyConfirm(true)}
                className="bg-telegram-500 hover:bg-telegram-600 text-white"
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                Buy Now
              </Button>
            </div>
          </div>

          {/* Admin Controls */}
          <AdminControls channel={channel} currentUser={currentUser} />
        </CardContent>
      </Card>

      {/* Info Modal / Bottom Sheet */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-lg">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">Channel Gifts Info</h2>
            <p className="mb-2">
              🗽 Statue of Liberty: <strong>{channel.gifts?.statueOfLiberty || 0}</strong>
            </p>
            <p className="mb-2">
              🔥 Torch of Freedom: <strong>{channel.gifts?.torchOfFreedom || 0}</strong>
            </p>
            <p>
              Channel username:{" "}
              <a
                href={`https://t.me/${channel.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                @{channel.username}
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Buy Confirmation Modal */}
      {showBuyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-lg">
            <button
              onClick={() => setShowBuyConfirm(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">Confirm Purchase</h2>
            <p className="mb-2">Do you want to buy this channel?</p>
            <p className="mb-2">
              🗽 Statue of Liberty: <strong>{channel.gifts?.statueOfLiberty || 0}</strong>
            </p>
            <p className="mb-2">
              🔥 Torch of Freedom: <strong>{channel.gifts?.torchOfFreedom || 0}</strong>
            </p>
            <p className="mb-4">
              Channel username:{" "}
              <a
                href={`https://t.me/${channel.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                @{channel.username}
              </a>
            </p>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBuyConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowBuyConfirm(false);
                  onBuyNow(channel);
                }}
                className="bg-telegram-500 hover:bg-telegram-600 text-white"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}