// client/src/pages/profile.tsx
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsModal } from "@/components/settings-modal";
import { telegramWebApp } from "@/lib/telegram";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsCards } from "@/components/profile/StatsCards";
import { ListingsTab } from "@/components/profile/ListingsTab";
import { ActivityTab } from "@/components/profile/ActivityTab";
import { ActivityDialog } from "@/components/profile/ActivityDialog";
import { DisputesTab } from "@/components/profile/DisputesTab";
import WalletTab from "@/components/profile/WalletTab"; // ✅ جديد
import {
  useMe,
  useMyListings,
  useMyActivities,
  useMyDisputes,
} from "@/hooks/use-me";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export default function ProfilePage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [showSettings, setShowSettings] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogActivityId, setDialogActivityId] = useState<string | null>(null);

  const tgUser = telegramWebApp.user;
  const { data: user } = useMe();
  const uname = user?.username || tgUser?.username || null;

  const { data: myListings = [], isLoading: listingsLoading } = useMyListings(uname || undefined);
  const { data: myActivities = [] } = useMyActivities(uname || undefined);
  const { data: myDisputes = [], isLoading: disputesLoading } = useMyDisputes(uname || undefined);

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
      let title = t("activityPage.updated") || "Activity";
      if (a.type === "buy") {
        type = "SOLD";
        title = t("activityPage.locked") || "Funds locked in escrow";
      } else if (["buyer_confirm", "seller_confirm", "admin_release"].includes(a.type)) {
        type = "RELEASED";
        title = t("activityPage.released") || "Funds release approved";
      } else if (["admin_refund", "cancel"].includes(a.type)) {
        type = "CANCELLED";
        title = t("activityPage.refunded") || "Order refunded/cancelled";
      }
      return {
        id: a.id,
        type,
        title,
        subtitle: amt,
        createdAt: a.createdAt || new Date().toISOString(),
      };
    });
  }, [myActivities, t]);

  if (!tgUser?.id && !user?.id) {
    return (
      <div className="p-6 text-center text-red-500">
        {t("activityPage.unauthorized") || "⚠️ Please open this app from Telegram."}
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
        {/* Stats Section */}
        <StatsCards
          activeCount={stats.activeCount}
          totalValue={stats.totalValue}
          totalSubs={stats.totalSubs}
        />

        {/* Tabs */}
        <Tabs defaultValue="listings" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="listings">{t("profilePage.tabs.listings")}</TabsTrigger>
            <TabsTrigger value="activity">{t("profilePage.tabs.activity")}</TabsTrigger>
            <TabsTrigger value="disputes">{t("profilePage.tabs.disputes")}</TabsTrigger>
            <TabsTrigger value="wallet">{t("profilePage.tabs.wallet") || "Wallet"}</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="space-y-4">
            <ListingsTab
              listings={myListings as any}
              isLoading={listingsLoading}
              currentUsername={uname || undefined}
              ctaLabel={t("profilePage.cta.list")}
            />
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <ActivityTab
              events={events as any}
              emptyText={t("activityPage.empty")}
            />
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4">
            <DisputesTab disputes={myDisputes as any} isLoading={disputesLoading} />
          </TabsContent>

          {/* ✅ Wallet Tab */}
          <TabsContent value="wallet" className="space-y-4">
            <WalletTab />
          </TabsContent>
        </Tabs>
      </div>

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        activityId={dialogActivityId}
      />
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}