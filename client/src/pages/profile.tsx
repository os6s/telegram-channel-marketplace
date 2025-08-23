import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useTon, type TonWallet } from "@/lib/ton-connect";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { WalletSection } from "@/components/profile/WalletSection";
import { StatsCards } from "@/components/profile/StatsCards";
import { ListingsTab } from "@/components/profile/ListingsTab";
import { ActivityTab } from "@/components/profile/ActivityTab";
import { ActivityDialog } from "@/components/profile/ActivityDialog";
import { useMe, useMyListings, useMyActivities, useUpdateWallet } from "@/hooks/use-me";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default function ProfilePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { wallet, getBalance } = useTon();

  const [showSettings, setShowSettings] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogActivityId, setDialogActivityId] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);

  const tgUser = telegramWebApp.user;
  const { data: user } = useMe();
  const uname = user?.username || tgUser?.username || null;

  const { data: myListings = [], isLoading: listingsLoading } = useMyListings(uname || undefined);
  const { data: myActivities = [] } = useMyActivities(uname || undefined);
  const updateWallet = useUpdateWallet();

  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const balance = await getBalance().catch(() => "0.000");
        setConnectedWallet({ address: wallet.address, network: wallet.network, balance });
        updateWallet.mutate(wallet.address); // حفظ باليوزرنيم
      } else {
        setConnectedWallet(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]);

  const handleWalletConnect = (w: TonWallet) => {
    setConnectedWallet(w);
    updateWallet.mutate(w.address);
    toast({ title: t("wallet.connected") });
  };

  const stats = useMemo(() => {
    const active = myListings.filter((l: any) => l.isActive);
    const activeCount = active.length;
    const totalValue = active.reduce((s: number, l: any) => s + Number(String(l.price).replace(",", ".")), 0);
    const totalSubs = active
      .filter((l: any) => l.kind === "channel")
      .reduce((s: number, l: any) => s + N(l.subscribersCount), 0);
    return { activeCount, totalValue: totalValue.toFixed(2), totalSubs };
  }, [myListings]);

  const events = useMemo(() => {
    return (myActivities || []).slice(0, 20).map((a: any) => {
      const amt = `${S(a.currency) || "TON"} ${S(a.amount) || ""}`.trim();
      let type: "UPDATED" | "SOLD" | "RELEASED" | "CANCELLED" = "UPDATED";
      let title = "Activity";
      if (a.type === "buy") { type = "SOLD"; title = "Order paid to escrow"; }
      else if (["buyer_confirm", "seller_confirm", "admin_release"].includes(a.type)) {
        type = "RELEASED"; title = "Funds release approved";
      } else if (["admin_refund", "cancel"].includes(a.type)) {
        type = "CANCELLED"; title = "Order refunded/cancelled";
      }
      return { id: a.id, type, title, subtitle: amt, createdAt: a.createdAt || new Date().toISOString() };
    });
  }, [myActivities]);

  return (
    <div className="min-h-screen bg-background">
      <ProfileHeader
        telegramUser={tgUser}
        onBack={() => window.history.back()}
        onOpenSettings={() => setShowSettings(true)}
        t={t}
      />

      <div className="px-4 py-6 space-y-6">
        <WalletSection connectedWallet={connectedWallet} onConnect={handleWalletConnect} t={t} />
        <StatsCards activeCount={stats.activeCount} totalValue={stats.totalValue} totalSubs={stats.totalSubs} />

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="listings">My Listings</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="space-y-4">
            <ListingsTab listings={myListings as any} isLoading={listingsLoading} currentUsername={uname || undefined} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <ActivityTab events={events as any} emptyText={t("activityPage.empty") || "No activity yet"} />
          </TabsContent>
        </Tabs>
      </div>

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activityId={dialogActivityId} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}