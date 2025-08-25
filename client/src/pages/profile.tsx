// client/src/pages/profile.tsx
import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useTon, type TonWallet } from "@/lib/ton-connect";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsCards } from "@/components/profile/StatsCards";
import { ListingsTab } from "@/components/profile/ListingsTab";
import { ActivityTab } from "@/components/profile/ActivityTab";
import { ActivityDialog } from "@/components/profile/ActivityDialog";
import { DisputesTab } from "@/components/profile/DisputesTab";
import { WalletTab } from "@/components/profile/WalletTab"; // ✅ new
import {
  useMe,
  useMyListings,
  useMyActivities,
  useMyDisputes,
} from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default function ProfilePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { wallet } = useTon();

  const [showSettings, setShowSettings] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogActivityId, setDialogActivityId] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<TonWallet | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState("");

  const tgUser = telegramWebApp.user;
  const { data: user } = useMe();
  const uname = user?.username || tgUser?.username || null;

  const { data: myListings = [], isLoading: listingsLoading } = useMyListings(uname || undefined);
  const { data: myActivities = [] } = useMyActivities(uname || undefined);
  const { data: myDisputes = [], isLoading: disputesLoading } = useMyDisputes(uname || undefined);

  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const bal = await fetchBalance();
        setConnectedWallet({ address: wallet.address, network: wallet.network, balance: bal.toFixed(3) });
      } else {
        setConnectedWallet(null);
      }
    })();
  }, [wallet?.address]);

  async function fetchBalance() {
    try {
      const r = await apiRequest("GET", "/api/wallet/balance");
      const b = Number(r.balance || 0);
      setBalance(b);
      return b;
    } catch {
      setBalance(0);
      return 0;
    }
  }

  async function handleDeposit() {
    try {
      const amt = Number(depositAmount);
      if (!amt || amt <= 0) {
        toast({ title: "Invalid amount", variant: "destructive" });
        return;
      }
      const r = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });
      const url = r.deeplinks?.tonkeeperWeb || r.deeplinks?.ton;
      if (url) {
        window.open(url, "_blank");
        toast({ title: "Confirm deposit in your wallet" });

        // poll until paid
        const check = async () => {
          const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: r.code, minTon: amt });
          if (status.status === "paid") {
            toast({ title: "Deposit confirmed ✅" });
            fetchBalance();
          } else {
            setTimeout(check, 5000);
          }
        };
        setTimeout(check, 5000);
      }
    } catch (e: any) {
      toast({ title: "Deposit failed", description: e?.message || "", variant: "destructive" });
    }
  }

  const stats = useMemo(() => {
    if (!Array.isArray(myListings)) return { activeCount: 0, totalValue: "0.00", totalSubs: 0 };
    const active = myListings.filter((l: any) => l.isActive);
    const activeCount = active.length;
    const totalValue = active.reduce(
      (s: number, l: any) => s + Number(String(l.price).replace(",", ".")),
      0
    );
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
      if (a.type === "buy") {
        type = "SOLD";
        title = "Order paid to escrow";
      } else if (["buyer_confirm", "seller_confirm", "admin_release"].includes(a.type)) {
        type = "RELEASED";
        title = "Funds release approved";
      } else if (["admin_refund", "cancel"].includes(a.type)) {
        type = "CANCELLED";
        title = "Order refunded/cancelled";
      }
      return {
        id: a.id,
        type,
        title,
        subtitle: amt,
        createdAt: a.createdAt || new Date().toISOString(),
      };
    });
  }, [myActivities]);

  if (!tgUser?.id && !user?.id) {
    return (
      <div className="p-6 text-center text-red-500">
        {t("profilePage.unauthorized") || "⚠️ Please open this app from Telegram."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProfileHeader
        telegramUser={tgUser}
        onBack={() => window.history.back()}
        onOpenSettings={() => setShowSettings(true)}
        t={t}
      />

      <div className="px-4 py-6 space-y-6">
        {/* Wallet Section */}
        <div className="p-4 border rounded bg-card space-y-2">
          <div className="text-sm">Wallet: {connectedWallet?.address || "Not connected"}</div>
          <div className="text-lg font-semibold">Balance: {balance.toFixed(3)} TON</div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={handleDeposit}>Deposit</Button>
          </div>
        </div>

        <StatsCards activeCount={stats.activeCount} totalValue={stats.totalValue} totalSubs={stats.totalSubs} />

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="listings">{t("profilePage.tabs.listings") || "My Listings"}</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
            <TabsTrigger value="disputes">{t("profilePage.tabs.disputes") || "Disputes"}</TabsTrigger>
            <TabsTrigger value="wallet">{t("profilePage.tabs.wallet") || "Wallet"}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="space-y-4">
            <ListingsTab
              listings={myListings as any}
              isLoading={listingsLoading}
              currentUsername={uname || undefined}
              ctaLabel={t("profilePage.cta.list") || "List for sale"}
            />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <ActivityTab events={events as any} emptyText={t("activityPage.empty") || "No activity yet"} />
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4">
            <DisputesTab disputes={myDisputes as any} isLoading={disputesLoading} />
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4">
            <WalletTab />
          </TabsContent>
        </Tabs>
      </div>

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activityId={dialogActivityId} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}