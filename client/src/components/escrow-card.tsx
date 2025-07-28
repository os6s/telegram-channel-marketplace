import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Shield, Eye, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { type Escrow } from "@shared/schema";

interface EscrowCardProps {
  escrow: Escrow;
  channelName?: string;
  onViewDetails: (escrow: Escrow) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800",
    text: "Pending Verification"
  },
  verified: {
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800", 
    text: "Verified"
  },
  completed: {
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    text: "Completed"
  },
  cancelled: {
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    text: "Cancelled"
  }
};

export function EscrowCard({ escrow, channelName, onViewDetails }: EscrowCardProps) {
  const status = statusConfig[escrow.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = status.icon;

  const formatTimeRemaining = (expiresAt: string): string => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const formatPrice = (amount: string): { ton: string; usd: string } => {
    const tonAmount = parseFloat(amount);
    const usdAmount = tonAmount * 5.1; // Mock conversion rate
    return {
      ton: tonAmount.toLocaleString(),
      usd: usdAmount.toLocaleString()
    };
  };

  const { ton, usd } = formatPrice(escrow.amount);
  const timeRemaining = formatTimeRemaining(escrow.expiresAt);
  const isExpired = timeRemaining === "Expired";

  return (
    <Card className="bg-white border border-gray-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-telegram-500 to-telegram-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {channelName?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="font-medium text-gray-900">{channelName || 'Unknown Channel'}</div>
              <div className="text-sm text-gray-500">Escrow #{escrow.id.slice(0, 8)}</div>
            </div>
          </div>
          <Badge variant="secondary" className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {status.text}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div>
            <div className="text-gray-500">Amount</div>
            <div className="font-semibold">{ton} TON</div>
            <div className="text-xs text-gray-400">≈ ${usd} USD</div>
          </div>
          <div>
            <div className="text-gray-500">Time Remaining</div>
            <div className={`font-semibold ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
              {timeRemaining}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 flex items-center">
              <Shield className="w-4 h-4 text-green-500 mr-1" />
              {escrow.status === 'pending' ? 'Bot verification in progress' : 
               escrow.status === 'verified' ? 'Awaiting ownership transfer' :
               status.text}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(escrow)}
              className="text-telegram-500 hover:text-telegram-600"
            >
              <Eye className="w-4 h-4 mr-1" />
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
