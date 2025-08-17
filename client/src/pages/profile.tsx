// client/src/pages/profile.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Wallet, Plus, Settings, Users, DollarSign, MessageSquare } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { WalletConnect } from "@/components/wallet-connect";
import { ChannelCard } from "@/components/channel-card";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useTon, type TonWallet } from "@/lib/ton-connect";
import { type Channel, type User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { MockChat } from "@/components/chat/mock-chat";

// Mock orders store
import { listOrdersForUser, seedOrdersFor, type Order } from "@/store/mock-orders";

export default function Profile() {
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { wallet, getBalance } = useTon();

  const telegramUser = telegramWebApp.user;
  const userId = telegramUser?.id.toString() || "temp-user-id";

  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const balance = await getBalance().catch(() => "0.000");
        const merged: TonWallet = { address: wallet.address, network: wallet.network, balance };
        setConnectedWallet(merged);
        if (user && user.tonWallet !== wallet.address) updateWalletMutation.mutate(wallet.address);
      } else {
        setConnectedWallet(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]);

  // اربط أول طلب بالمستخدم الحالي كمشتري إن ما عنده طلبات
  useEffect(() => {
    if (userId) seedOrdersFor(userId);
  }, [userId]);

  const { data: user } = useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) return (await res.json()) as User;
        if (telegramUser) {
          const created = await apiRequest("POST", "/api/users", {
            telegramId: telegramUser.id.toString(),
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            tonWallet: connectedWallet?.address ?? undefined,
          });
          return created as User;
        }
      } catch {}
      return null;
    },
  });

  const { data: userChannels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["/api/channels", "user", userId],
    queryFn: async () => {
      const res = await fetch(`/api/channels?sellerId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user channels");
      return (await res.json()) as Channel[];
    },
  });

  const updateWalletMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { tonWallet: walletAddress });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({ title: t("wallet.connected") });
    },
  });

  const handleWalletConnect = (w: TonWallet) => {
    setConnectedWallet(w);
    if (user && user.tonWallet !== w.address) updateWalletMutation.mutate(w.address);
  };

  const handleViewDetails = (channel: Channel) => console.log("View channel details:", channel.id);
  const handleEditChannel = (channel: Channel) => console.log("Edit channel:", channel.id);
  const handleBack = () => window.history.back();

  const stats = (() => {
    const activeChannels = userChannels.filter((c) => c.isActive).length;
    const totalValue = userChannels.filter(c => c.isActive).reduce((s, c) => s + parseFloat(c.price), 0);
    const totalSubscribers = userChannels.filter(c => c.isActive).reduce((s, c) => s + c.subscribers, 0);
    return { activeChannels, totalValue: totalValue.toFixed(2), totalSubscribers };
  })();

  // نشاط البائع (وهمي الآن)
  const sellerActivity: ActivityEvent[] = [
    { id: "e1", type: "LISTED", title: "You listed @mychannel", subtitle: "Price: 120 TON", createdAt: new Date().toISOString() },
    { id: "e2", type: "UPDATED", title: "Updated @mychannel", subtitle: "Price changed to 150 TON", createdAt: new Date(Date.now() - 3600_000).toISOString() },
    { id: "e3", type: "SOLD", title: "You sold @oldgroup", subtitle: "for 300 TON", createdAt: new Date(Date.now() - 4 * 3600_000).toISOString() },
  ];

  // طلبات المستخدم من الستور
  const myOrders: Order[] = useMemo(() => listOrdersForUser(userId), [userId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="w-4 h-4" /></Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{t("profilePage.title")}</h1>
                <p className="text-xs text-muted-foreground">{t("profilePage.subtitle")}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
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
                {telegramUser?.username && <p className="text-muted-foreground">@{telegramUser.username}</p>}
                <div className="flex items-center space-x-2 mt-2">
                  {telegramUser?.is_premium && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">⭐</Badge>
                  )}
                  <Badge variant="secondary">
                    {t("profilePage.memberSince")} {new Date().getFullYear()}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t("profilePage.tonWallet")}</span>
                </div>
                <WalletConnect onWalletConnect={handleWalletConnect} />
              </div>
              {connectedWallet && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {t("wallet.balance")}: {connectedWallet.balance} TON
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2"><Plus className="w-5 h-5 text-telegram-500" /></div>
              <div className="text-2xl font-bold text-foreground">{stats.activeChannels}</div>
              <div className="text-sm text-muted-foreground">{t("profilePage.stats.activeListings")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2"><DollarSign className="w-5 h-5 text-green-500" /></div>
              <div className="text-2xl font-bold text-foreground">{stats.totalValue}</div>
              <div className="text-sm text-muted-foreground">{t("profilePage.stats.totalValueTon")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2"><Users className="w-5 h-5 text-blue-500" /></div>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSubscribers > 1000 ? `${(stats.totalSubscribers / 1000).toFixed(1)}K` : stats.totalSubscribers}
              </div>
              <div className="text-sm text-muted-foreground">{t("profilePage.stats.totalReach")}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="channels">{t("profilePage.tabs.channels")}</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{t("profilePage.listingsHeader")}</h3>
              <Button size="sm" className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
                <Plus className="w-4 h-4 mr-1" />
                {t("profilePage.listChannel")}
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
                  <h3 className="font-medium text-foreground mb-2">{t("profilePage.emptyTitle")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("profilePage.emptyDesc")}</p>
                  <Button className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("profilePage.listFirst")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userChannels.map((channel) => (
                  <div key={channel.id} className="relative">
                    <ChannelCard channel={channel} onViewDetails={handleViewDetails} onBuyNow={handleEditChannel} />
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
            {/* My Orders (Buyer/Seller) */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  My Orders (chat / dispute)
                </div>
                {myOrders.map(o => (
                  <div key={o.id} className="border rounded p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Order #{o.id} · {o.amount} {o.currency}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString()} · status: {o.status} ·
                        {" "}buyer:{o.buyer.id === userId ? "You" : (o.buyer.name || o.buyer.id)}
                        {" "}· seller:{o.seller.id === userId ? "You" : (o.seller.name || o.seller.id)}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => { setSelected(o); setChatOpen(true); }}>
                      Open chat {o.thread?.length ? `(${o.thread.length})` : ""}
                    </Button>
                  </div>
                ))}
                {myOrders.length === 0 && (
                  <div className="text-sm text-muted-foreground">No orders yet.</div>
                )}
              </CardContent>
            </Card>

            {/* Seller activity timeline */}
            <ActivityTimeline
              events={sellerActivity}
              emptyText={t("activityPage.empty") || "No seller activity yet"}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat/Dialog */}
      <Dialog.Root open={chatOpen} onOpenChange={setChatOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[96vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-0 shadow-lg">
            {selected && (
              <MockChat
                order={selected}
                me={selected.buyer.id === userId ? "buyer" : "seller"}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}