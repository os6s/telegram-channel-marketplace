import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  useMe,
  useMyListings,
  useMyActivities,
  useMyDisputes,
  useUpdateWallet,
} from "@/hooks/use-me";

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

  const [backendBalance, setBackendBalance] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLink, setDepositLink] = useState<string | null>(null);
  const [depositCode, setDepositCode] = useState<string | null>(null);

  const tgUser = telegramWebApp.user;
  const { data: user } = useMe();
  const uname = user?.username || tgUser?.username || null;

  const { data: myListings = [], isLoading: listingsLoading } = useMyListings(uname || undefined);
  const { data: myActivities = [] } = useMyActivities(uname || undefined);
  const { data: myDisputes = [], isLoading: disputesLoading } = useMyDisputes(uname || undefined);
  const updateWallet = useUpdateWallet();

  // Load backend balance
  async function loadBalance() {
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const j = await res.json();
        setBackendBalance(j.balance || 0);
      }
    } catch (e) {
      console.error("balance fetch failed", e);
    }
  }

  useEffect(() => {
    loadBalance();
  }, []);

  // Deposit initiate
  async function startDeposit() {
    try {
      const amt = Number(depositAmount);
      if (!amt || amt <= 0) return;
      const res = await fetch("/api/wallet/deposit/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountTon: amt }),
      });
      if (!res.ok) throw new Error("failed");
      const j = await res.json();
      setDepositLink(j.deeplinks.tonkeeperWeb || j.deeplinks.ton);
      setDepositCode(j.code);
      toast({ title: "Deposit started", description: "Confirm in your wallet" });
    } catch {
      toast({ title: "Deposit failed", variant: "destructive" });
    }
  }

  // Poll deposit status if we have a code
  useEffect(() => {
    if (!depositCode) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/wallet/deposit/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: depositCode }),
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j.status === "paid") {
          toast({ title: "Deposit confirmed", description: `${j.amount} TON` });
          setDepositCode(null);
          setDepositLink(null);
          setDepositAmount("");
          loadBalance();
          clearInterval(id);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [depositCode]);

  // Connect wallet (TonConnect)
  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const balance = await getBalance().catch(() => "0.000");
        setConnectedWallet({ address: wallet.address, network: wallet.network, balance });
        updateWallet.mutate(wallet.address);
      } else {
        setConnectedWallet(null);
      }
    })();
  }, [wallet?.address]);

  const handleWalletConnect = (w: TonWallet) => {
    setConnectedWallet(w);
    updateWallet.mutate(w.address);
    toast({ title: t("wallet.connected") });
  };

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

  // unauthorized check
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
        {/* Backend wallet section */}
        <div className="p-4 border rounded">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted">Balance</div>
              <div className="text-xl font-bold">{backendBalance.toFixed(2)} TON</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              placeholder="Amount TON"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={startDeposit}>Deposit</Button>
          </div>
          {depositLink && (
            <div className="mt-3">
              <a href={depositLink} target="_blank" className="text-blue-600 underline">
                Open Wallet to Confirm Deposit
              </a>
            </div>
          )}
        </div>

        <StatsCards
          activeCount={stats.activeCount}
          totalValue={stats.totalValue}
          totalSubs={stats.totalSubs}
        />

        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="listings">{t("profilePage.tabs.listings")}</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
            <TabsTrigger value="disputes">{t("profilePage.tabs.disputes")}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings">
            <ListingsTab
              listings={myListings as any}
              isLoading={listingsLoading}
              currentUsername={uname || undefined}
              ctaLabel={t("profilePage.cta.list")}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTab
              events={(myActivities || []).map((a: any) => ({
                id: a.id,
                type: a.type,
                title: a.type,
                subtitle: `${a.currency} ${a.amount}`,
                createdAt: a.createdAt || new Date().toISOString(),
              }))}
              emptyText={t("activityPage.empty")}
            />
          </TabsContent>

          <TabsContent value="disputes">
            <DisputesTab disputes={myDisputes as any} isLoading={disputesLoading} />
          </TabsContent>
        </Tabs>
      </div>

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activityId={dialogActivityId} />
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}