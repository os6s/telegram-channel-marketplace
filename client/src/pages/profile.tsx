import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Wallet, Plus, Settings, TrendingUp, Users, DollarSign } from "lucide-react";
import { WalletConnect } from "@/components/wallet-connect";
import { ChannelCard } from "@/components/channel-card";
import { telegramWebApp } from "@/lib/telegram";
import { tonConnect, type TonWallet } from "@/lib/ton-connect";
import { type Channel, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get user info from Telegram
  const telegramUser = telegramWebApp.user;
  const userId = telegramUser?.id.toString() || 'temp-user-id';

  useEffect(() => {
    // Restore wallet connection
    tonConnect.restoreConnection().then(setConnectedWallet);
  }, []);

  // Fetch or create user profile
  const { data: user } = useQuery({
    queryKey: ['/api/users', userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (response.ok) {
          return response.json() as User;
        }
        
        // Create user if not exists
        if (telegramUser) {
          const createResponse = await apiRequest('POST', '/api/users', {
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            tonWallet: connectedWallet?.address,
          });
          return createResponse.json() as User;
        }
      } catch (error) {
        console.error('Failed to fetch/create user:', error);
      }
      return null;
    },
  });

  // Fetch user's channels
  const { data: userChannels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['/api/channels', 'user', userId],
    queryFn: async () => {
      const response = await fetch(`/api/channels?sellerId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user channels');
      return response.json() as Channel[];
    },
  });

  // Update user wallet mutation
  const updateWalletMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}`, {
        tonWallet: walletAddress,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId] });
      toast({
        title: "Wallet Connected",
        description: "Your TON wallet has been linked to your profile",
      });
    },
  });

  const handleWalletConnect = (wallet: TonWallet) => {
    setConnectedWallet(wallet);
    if (user && user.tonWallet !== wallet.address) {
      updateWalletMutation.mutate(wallet.address);
    }
  };

  const handleViewDetails = (channel: Channel) => {
    console.log('View channel details:', channel.id);
    // TODO: Implement channel details
  };

  const handleEditChannel = (channel: Channel) => {
    console.log('Edit channel:', channel.id);
    // TODO: Implement channel editing
  };

  const handleBack = () => {
    window.history.back();
  };

  const getProfileStats = () => {
    const activeChannels = userChannels.filter(c => c.isActive).length;
    const totalValue = userChannels
      .filter(c => c.isActive)
      .reduce((sum, channel) => sum + parseFloat(channel.price), 0);
    const totalSubscribers = userChannels
      .filter(c => c.isActive)
      .reduce((sum, channel) => sum + channel.subscribers, 0);

    return {
      activeChannels,
      totalValue: totalValue.toFixed(2),
      totalSubscribers,
    };
  };

  const stats = getProfileStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
                <p className="text-xs text-gray-500">Manage your account and listings</p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={telegramUser?.photo_url} />
                <AvatarFallback className="bg-telegram-500 text-white text-xl">
                  {telegramUser?.first_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900">
                  {telegramUser?.first_name} {telegramUser?.last_name}
                </h2>
                {telegramUser?.username && (
                  <p className="text-gray-600">@{telegramUser.username}</p>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  {telegramUser?.is_premium && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      ⭐ Premium
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    Member since {new Date().getFullYear()}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Wallet Status */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">TON Wallet</span>
                </div>
                <WalletConnect onWalletConnect={handleWalletConnect} />
              </div>
              {connectedWallet && (
                <div className="mt-2 text-sm text-gray-500">
                  Balance: {connectedWallet.balance} TON
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-telegram-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.activeChannels}</div>
              <div className="text-sm text-gray-500">Active Listings</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalValue}</div>
              <div className="text-sm text-gray-500">Total Value (TON)</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalSubscribers > 1000 
                  ? `${(stats.totalSubscribers / 1000).toFixed(1)}K` 
                  : stats.totalSubscribers}
              </div>
              <div className="text-sm text-gray-500">Total Reach</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="channels">My Channels</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">My Channel Listings</h3>
              <Button 
                size="sm"
                className="bg-telegram-500 hover:bg-telegram-600"
                onClick={() => {
                  // TODO: Navigate to sell channel page
                  console.log('Navigate to sell channel');
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                List Channel
              </Button>
            </div>

            {channelsLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : userChannels.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-gray-400 text-6xl mb-4">📺</div>
                  <h3 className="font-medium text-gray-900 mb-2">No channels listed yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Start selling your Telegram channels on the marketplace
                  </p>
                  <Button className="bg-telegram-500 hover:bg-telegram-600">
                    <Plus className="w-4 h-4 mr-2" />
                    List Your First Channel
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userChannels.map((channel) => (
                  <div key={channel.id} className="relative">
                    <ChannelCard
                      channel={channel}
                      onViewDetails={handleViewDetails}
                      onBuyNow={handleEditChannel}
                    />
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditChannel(channel)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <h3 className="font-medium text-gray-900 mb-2">Activity Coming Soon</h3>
                <p className="text-sm text-gray-500">
                  View your transaction history, earnings, and marketplace activity here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
