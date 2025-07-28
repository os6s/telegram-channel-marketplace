import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; 
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EscrowCard } from "@/components/escrow-card";
import { ArrowLeft, Shield, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { type Escrow, type Channel } from "@shared/schema";
import { telegramWebApp } from "@/lib/telegram";

export default function Escrows() {
  // TODO: Get actual user ID from authentication
  const userId = telegramWebApp.user?.id.toString() || 'temp-user-id';

  const { data: escrows = [], isLoading } = useQuery({
    queryKey: ['/api/escrows', userId],
    queryFn: async () => {
      const response = await fetch(`/api/escrows?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch escrows');
      return response.json();
    },
  });

  // Fetch channel names for escrows
  const { data: channelMap = {} } = useQuery({
    queryKey: ['/api/channels/map', escrows],
    queryFn: async () => {
      if (escrows.length === 0) return {};
      
      const channelIds = Array.from(new Set(escrows.map(e => e.channelId)));
      const channelPromises = channelIds.map(async (id) => {
        const response = await fetch(`/api/channels/${id}`);
        if (response.ok) {
          const channel = await response.json() as Channel;
          return [id, channel.name];
        }
        return [id, 'Unknown Channel'];
      });
      
      const results = await Promise.all(channelPromises);
      return Object.fromEntries(results);
    },
    enabled: escrows.length > 0,
  });

  const handleViewEscrowDetails = (escrow: Escrow) => {
    console.log('View escrow details:', escrow.id);
    // TODO: Implement escrow details modal or navigation
  };

  const handleBack = () => {
    window.history.back();
  };

  const getStatusStats = () => {
    const stats = {
      pending: escrows.filter(e => e.status === 'pending').length,
      verified: escrows.filter(e => e.status === 'verified').length,
      completed: escrows.filter(e => e.status === 'completed').length,
      cancelled: escrows.filter(e => e.status === 'cancelled').length,
    };
    return stats;
  };

  const stats = getStatusStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">My Escrows</h1>
              <p className="text-xs text-gray-500">Manage your secure transactions</p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Shield className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.verified}</div>
              <div className="text-sm text-gray-500">Verified</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.cancelled}</div>
              <div className="text-sm text-gray-500">Cancelled</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Escrows */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Escrows</h2>
          
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : escrows.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">🔒</div>
                <h3 className="font-medium text-gray-900 mb-2">No escrows yet</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Start buying or selling channels to see your secure transactions here.
                </p>
                <Button 
                  className="bg-telegram-500 hover:bg-telegram-600"
                  onClick={() => window.history.back()}
                >
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {escrows
                .filter(escrow => escrow.status !== 'completed' && escrow.status !== 'cancelled')
                .map((escrow) => (
                  <EscrowCard
                    key={escrow.id}
                    escrow={escrow}
                    channelName={channelMap[escrow.channelId]}
                    onViewDetails={handleViewEscrowDetails}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Completed Escrows */}
        {escrows.some(e => e.status === 'completed' || e.status === 'cancelled') && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
            <div className="space-y-4">
              {escrows
                .filter(escrow => escrow.status === 'completed' || escrow.status === 'cancelled')
                .map((escrow) => (
                  <EscrowCard
                    key={escrow.id}
                    escrow={escrow}
                    channelName={channelMap[escrow.channelId]}
                    onViewDetails={handleViewEscrowDetails}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
