// client/src/pages/profile.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit3, Wallet, Plus, Settings, Users, DollarSign, MessageSquare, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { WalletConnect } from "@/components/wallet-connect";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useTon, type TonWallet } from "@/lib/ton-connect";
import { type Listing as Channel, type User, type Activity } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity-timeline";
import { ListingCard } from "@/components/listing-card"; // ← استخدم الكارد الجديدة المتوافقة مع listings

/* helpers آمنة */
const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "U";
};
const N = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default function Profile() {
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { wallet, getBalance } = useTon();

  const telegramUser = telegramWebApp.user;
  const telegramId = telegramUser?.id ? String(telegramUser.id) : undefined;

  /* تحميل/إنشاء المستخدم الحقيقي */
  const { data: user } = useQuery({
    enabled: !!telegramId,
    queryKey: ["user/by-telegram", telegramId],
    queryFn: async () => {
      // جرّب مسار REST موجود عندك. عدّله إذا مسارك مختلف.
      const r = await fetch(`/api/users/by-telegram/${telegramId}`);
      if (r.ok) return (await r.json()) as User;

      // إنشاء سريع إذا غير موجود
      const created = await apiRequest("POST", "/api/users", {
        telegramId,
        username: telegramUser?.username,
        firstName: telegramUser?.first_name,
        lastName: telegramUser?.last_name,
      });
      return created as User;
    },
  });

  /* Listings الخاصة بالمستخدم */
  const { data: myListings = [], isLoading: listingsLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["listings/by-seller", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/listings?sellerId=${user!.id}`);
      if (!res.ok) throw new Error("Failed to fetch listings");
      return (await res.json()) as Channel[];
    },
  });

  /* Activities الحقيقية */
  const { data: myActivities = [] } = useQuery({
    enabled: !!user?.id,
    queryKey: ["activities/by-user", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/activities?userId=${user!.id}`);
      if (!res.ok) return [] as Activity[];
      return (await res.json()) as Activity[];
    },
  });

  /* Wallet connect وتحديثه على المستخدم */
  const updateWalletMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      const res = await apiRequest("PATCH", `/api/users/${user!.id}`, { tonWallet: walletAddress });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user/by-telegram", telegramId] });
      toast({ title: t("wallet.connected") });
    },
  });

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
  }, [wallet?.address, user?.id]);

  const handleWalletConnect = (w: TonWallet) => {
    setConnectedWallet(w);
    if (user && user.tonWallet !== w.address) updateWalletMutation.mutate(w.address);
  };

  const handleBack = () => window.history.back();

  /* إحصاءات */
  const stats = useMemo(() => {
    const active = myListings.filter((l) => l.isActive);
    const activeCount = active.length;
    const totalValue = active.reduce((s, l) => s + Number(String(l.price).replace(",", ".")), 0);
    // reach للقنوات فقط
    const totalSubs = active
      .filter((l) => l.kind === "channel")
      .reduce((s, l) => s + N((l as any).subscribersCount), 0);
    return { activeCount, totalValue: totalValue.toFixed(2), totalSubs };
  }, [myListings]);

  /* Activity timeline عرض بسيط */
  const sellerActivity: ActivityEvent[] = useMemo(() => {
    return myActivities
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        type:
          a.type === "buy" ? "SOLD"
          : a.type === "confirm" ? "RELEASED"
          : a.type === "cancel" ? "CANCELLED"
          : "UPDATED",
        title:
          a.type === "buy" ? "Order paid to escrow"
          : a.type === "confirm" ? "Buyer confirmed. Payout queued"
          : a.type === "cancel" ? "Order cancelled"
          : "Activity",
        subtitle: `${S(a.currency) || "TON"} ${S(a.amount) || ""}`.trim(),
        createdAt: (a.createdAt as any) ?? new Date().toISOString(),
      }));
  }, [myActivities]);

  /* رندرة */
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={telegramUser?.photo_url} />
                <AvatarFallback className="bg-telegram-500 text-white text-xl">
                  {initialFrom(telegramUser?.first_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {S(telegramUser?.first_name)} {S(telegramUser?.last_name)}
                </h2>
                {telegramUser?.username && <p className="text-muted-foreground">@{telegramUser.username}</p>}
                <div className="flex items-center gap-2 mt-2">
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
                <div className="flex items-center gap-2">
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
              <div className="text-2xl font-bold text-foreground">{stats.activeCount}</div>
              <div className="text-sm text-muted-foreground">Active listings</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2"><DollarSign className="w-5 h-5 text-green-500" /></div>
              <div className="text-2xl font-bold text-foreground">{stats.totalValue}</div>
              <div className="text-sm text-muted-foreground">Total value (TON)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2"><Users className="w-5 h-5 text-blue-500" /></div>
              <div className="text-2xl font-bold text-foreground">
                {stats.totalSubs > 1000 ? `${(stats.totalSubs / 1000).toFixed(1)}K` : stats.totalSubs}
              </div>
              <div className="text-sm text-muted-foreground">Total reach</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">My Listings</h3>
              <Button size="sm" className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
                <Plus className="w-4 h-4 mr-1" />
                List a channel
              </Button>
            </div>

            {listingsLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i}><CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-muted rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3"></div>
                          <div className="h-3 bg-muted rounded w-1/4"></div>
                        </div>
                      </div>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            ) : myListings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground text-6xl mb-4">📺</div>
                  <h3 className="font-medium text-foreground mb-2">No listings yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">List your first channel to start selling.</p>
                  <Button className="bg-telegram-500 hover:bg-telegram-600" onClick={() => (window.location.href = "/sell")}>
                    <Plus className="w-4 h-4 mr-2" />
                    List your first
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myListings.map((l) => (
                  <div key={l.id} className="relative">
                    <ListingCard
                      listing={l}
                      onViewDetails={() => {}}
                      onBuyNow={() => {}}
                      currentUser={{ username: telegramUser?.username }}
                    />
                    <div className="absolute top-4 right-4">
                      <Button variant="ghost" size="sm" onClick={() => { /* TODO: edit flow */ }}>
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
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  My Activity
                </div>

                {myActivities.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("activityPage.empty") || "No activity yet."}</div>
                ) : (
                  <ActivityTimeline
                    events={sellerActivity}
                    emptyText={t("activityPage.empty") || "No activity yet"}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog مبسّط لعرض activity لاحقًا */}
      <Dialog.Root open={chatOpen} onOpenChange={setChatOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[96vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-0 shadow-lg">
            {selectedActivity && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="text-sm font-semibold">Activity · #{selectedActivity.id}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-4 text-sm">
                  {/* تفاصيل إضافية للنشاط */}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}