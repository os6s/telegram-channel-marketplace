// client/src/pages/profile.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Wallet, Plus, Settings, Users, DollarSign } from "lucide-react";
import { WalletConnect } from "@/components/wallet-connect";
import { ChannelCard } from "@/components/channel-card";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useTon, type TonWallet } from "@/lib/ton-connect"; // CHANGED
import { type Channel, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // TonConnect via Provider
  const { wallet, getBalance } = useTon(); // CHANGED

  // Telegram user
  const telegramUser = telegramWebApp.user;
  const userId = telegramUser?.id.toString() || "temp-user-id";

  // مزامنة حالة المحفظة من الـ Provider وتحديث البروفايل إذا تغيّرت
  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const balance = await getBalance().catch(() => "0.000");
        const merged: TonWallet = {
          address: wallet.address,
          network: wallet.network,
          balance,
        };
        setConnectedWallet(merged);

        // اربط المحفظة بالبروفايل إذا اختلفت
        if (user && user.tonWallet !== wallet.address) {
          updateWalletMutation.mutate(wallet.address);
        }
      } else {
        setConnectedWallet(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]); // CHANGED

  // Fetch or create user profile
  const { data: user } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (response.ok) return (await response.json()) as User;

        // Create user if not exists
        if (telegramUser) {
          const createResponse = await apiRequest("POST", "/api/users", {
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            tonWallet: connectedWallet?.address ?? undefined,
          });
          return (await createResponse.json()) as User;
        }
      } catch (error) {
        console.error("Failed to fetch/create user:", error);
      }
      return null;
    },
  });

  // Fetch user's channels
  const {
    data: userChannels = [],
    isLoading: channelsLoading,
  } = useQuery({
    queryKey: ["/api/channels", "user", userId],
    queryFn: async () => {
      const response = await fetch(`/api/channels?sellerId=${userId}`);
      if (!response.ok) throw new Error("Failed to fetch user channels");
      return (await response.json()) as Channel[];
    },
  });

  // Update user wallet mutation
  const updateWalletMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, {
        tonWallet: walletAddress,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({
        title: "Wallet Connected",
        description: "Your TON wallet has been linked to your profile",
      });
    },
  });

  // يبقى التوقيع نفسه حتى يبقى WalletConnect متوافق
  const handleWalletConnect = (w: TonWallet) => { // CHANGED
    setConnectedWallet(w);
    if (user && user.tonWallet !== w.address) {
      updateWalletMutation.mutate(w.address);
    }
  };

  const handleViewDetails = (channel: Channel) => {
    console.log("View channel details:", channel.id);
  };

  const handleEditChannel = (channel: Channel) => {
    console.log("Edit channel:", channel.id);
  };

  const handleBack = () => window.history.back();

  const getProfileStats = () => {
    const activeChannels = userChannels.filter((c) => c.isActive).length;
    const totalValue = userChannels
      .filter((c) => c.isActive)
      .reduce((sum, channel) => sum + parseFloat(channel.price), 0);
    const totalSubscribers = userChannels
      .filter((c) => c.isActive)
      .reduce((sum, channel) => sum + channel.subscribers, 0);

    return {
      activeChannels,
      totalValue: totalValue.toFixed(2),
      totalSubscribers,
    };
  };

  const stats = getProfileStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Profile</h1>
                <p className="text-xs text-muted-foreground">
                  Manage your account and listings
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
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
                  {telegramUser?.first_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {telegramUser?.first_name} {telegramUser?.last_name}
                </h2>
                {telegramUser?.username && (
                  <p className="text-muted-foreground">@{telegramUser.username}</p>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  {telegramUser?.is_premium && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      ⭐ Premium
                    </Badge>
                  )}
                  <Badge variant="secondary">Member since {new Date().getFullYear()}</Badge>
                </div>
              </div>
            </div>

            {/* Wallet Status */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">TON Wallet</span>
                </div>
                <WalletConnect onWalletConnect={handleWalletConnect} />
              </div>
              {connectedWallet && (
                <div className="mt-2 text-sm text-muted-foreground">
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
              <div className="text-2xl font-bold text-foreground">{stats.activeChannels}</div>
              <div className="text-sm text-muted-foreground">Active Listings</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stats.totalValue}</div>
              <div className="text-sm text-muted-foreground">Total Value (TON)</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSubscribers > 1000
                  ? `${(stats.totalSubscribers / 1000).toFixed(1)}K`
                  : stats.totalSubscribers}
              </div>
              <div className="text-sm text-muted-foreground">Total Reach</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="channels">My Channels</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">My Channel Listings</h3>
              <Button
                size="sm"
                className="bg-telegram-500 hover:bg-telegram-600"
                onClick={() => {
                  window.location.href = "/sell-channel";
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
                          <div className="w-12 h-12 bg-muted rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/3"></div>
                            <div className="h-3 bg-muted rounded w-1/4"></div>
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
                  <div className="text-muted-foreground text-6xl mb-4">📺</div>
                  <h3 className="font-medium text-foreground mb-2">No channels listed yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start selling your Telegram channels on the marketplace
                  </p>
                  <Button
                    className="bg-telegram-500 hover:bg-telegram-600"
                    onClick={() => {
                      window.location.href = "/sell-channel";
                    }}
                  >
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
                      <Button variant="ghost" size="sm" onClick={() => handleEditChannel(channel)}>
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
                <div className="text-muted-foreground text-6xl mb-4">📊</div>
                <h3 className="font-medium text-foreground mb-2">View Full Activity</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access your complete transaction history and marketplace activity.
                </p>
                <Button
                  className="bg-telegram-500 hover:bg-telegram-600"
                  onClick={() => {
                    window.location.href = "/activity";
                  }}
                >
                  Open Activity Page
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}