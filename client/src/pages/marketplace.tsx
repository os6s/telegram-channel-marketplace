import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Filter, AtSign, Hash, Sparkles, User2, Users, Gift, Megaphone, Rocket,
} from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { useLanguage } from "@/contexts/language-context";
import { onListingsChange, listLocalListings, type AnyListing } from "@/store/listings";
import { apiRequest } from "@/lib/queryClient";

type Kind = "username" | "account" | "channel" | "service" | "";
type Platform = "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok" | "";
type ChannelMode = "subscribers" | "gifts" | "";
type ServiceType = "followers" | "members" | "boost_channel" | "boost_group" | "";

const LABELS = (t: (k: string) => string) => ({
  title: t("market.title") || "Digital Marketplace",
  subtitle: t("market.subtitle") || "Platform for Buying & Selling Digital Assets",
  searchPlaceholder: t("market.searchPlaceholder") || "Search…",
  allTypes: t("market.allTypes") || "All",
  sortAsc: t("market.sortByPriceAsc") || "Sort: Price Low → High",
  sortDesc: t("market.sortByPriceDesc") || "Sort: Price High → Low",
  loadMore: t("market.loadMore") || "Load More",
  noFound: t("market.noFound") || "No listings found",
  tryFilters: t("market.tryFilters") || "Try adjusting your filters or search query",
  salesCountLabel: t("market.salesCountLabel") || "Sales Count",
  salesVolumeLabel: t("market.salesVolumeLabel") || "Sales Volume",
  activeListingsLabel: t("market.activeListingsLabel") || "Active Listings",
  username: t("sell.username") || "Sell Username",
  account: t("sell.account") || "Sell Account",
  channel: t("sell.channel") || "Sell",
  service: t("sell.service") || "Sell Service",
  modeSubscribers: t("sell.modeSubscribers") || "Subscribers channel",
  modeGifts: t("sell.modeGifts") || "Gifts channel",
  serviceFollowers: t("market.type.serviceFollowers") || "Followers Service",
  serviceSubscribers: t("market.type.serviceSubscribers") || "Subscribers Service",
  boostCh: t("sell.boostCh") || "Boost Telegram Channel",
  boostGp: t("sell.boostGp") || "Boost Telegram Group",
});

const ICON: Record<string, JSX.Element> = {
  telegram: <AtSign className="w-4 h-4" />,
  instagram: <Sparkles className="w-4 h-4" />,
  twitter: <Hash className="w-4 h-4" />,
  discord: <User2 className="w-4 h-4" />,
  snapchat: <User2 className="w-4 h-4" />,
  tiktok: <User2 className="w-4 h-4" />,
  subscribers: <Users className="w-4 h-4" />,
  gifts: <Gift className="w-4 h-4" />,
  followers: <Users className="w-4 h-4" />,
  members: <Users className="w-4 h-4" />,
  boost_channel: <Megaphone className="w-4 h-4" />,
  boost_group: <Rocket className="w-4 h-4" />,
};

export default function Marketplace() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const L = useMemo(() => LABELS(t), [t]);
  const containerCls = "min-h-screen bg-background text-foreground";

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [platform, setPlatform] = useState<Platform>("");
  const [channelMode, setChannelMode] = useState<ChannelMode>("");
  const [serviceType, setServiceType] = useState<ServiceType>("");

  const [sortAsc, setSortAsc] = useState(true);

  const [showStats, setShowStats] = useState(true);
  useEffect(() => {
    const onScroll = () => setShowStats(window.scrollY < 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ===== me =====
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      try { return await apiRequest("GET", "/api/me"); }
      catch { return null; }
    },
    staleTime: 0,
    retry: false,
  });

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/stats")) ?? {},
    staleTime: 30_000,
    retry: false,
  });

  // Listings (server)
  const qk = ["/api/listings", { search, kind, platform, channelMode, serviceType }] as const;
  const { data: serverListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (kind) params.set("type", kind);
      if (platform) params.set("platform", platform);
      if (channelMode) params.set("channelMode", channelMode);
      if (serviceType) params.set("serviceType", serviceType);
      const res = (await apiRequest("GET", `/api/listings?${params.toString()}`)) as AnyListing[] | null;
      return Array.isArray(res) ? res : [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Local + server merge
  const [localListings, setLocalListings] = useState<AnyListing[]>(() => listLocalListings());
  useEffect(() => {
    setLocalListings(listLocalListings());
    return onListingsChange(() => setLocalListings(listLocalListings()));
  }, []);

  const merged: AnyListing[] = useMemo(() => {
    const map = new Map<string, AnyListing>();
    for (const l of localListings) map.set(l.id, l);
    for (const l of serverListings as AnyListing[]) if (!map.has(l.id)) map.set(l.id, l);
    return Array.from(map.values());
  }, [localListings, serverListings]);

  // Client-side filtering
  const filtered = merged.filter((it) => {
    if (kind && (it.kind || "channel") !== kind) return false;
    if (platform && (it.platform || "telegram") !== platform) return false;
    if (channelMode && (it.channelMode || "") !== channelMode) return false;
    if (serviceType && (it.serviceType || "") !== serviceType) return false;
    if (search) {
      const s = search.toLowerCase();
      const blob = `${it.username || ""} ${it.title || ""} ${it.platform || ""}`.toLowerCase();
      if (!blob.includes(s)) return false;
    }
    return true;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    const pa = Number((a as any).price || 0);
    const pb = Number((b as any).price || 0);
    return sortAsc ? pa - pb : pb - pa;
  });

  // ===== Buy handler =====
  async function handleBuy(listing: AnyListing) {
    try {
      await apiRequest("POST", "/api/wallet/pay", { listingId: listing.id });
      toast({ title: "Order created", description: "Funds locked in escrow. Check Profile → Activity." });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401")) {
        toast({ title: "Unauthorized", description: "افتح الميني-أب داخل تيليجرام لتسجيل الدخول.", variant: "destructive" });
      } else if (msg.includes("insufficient_balance")) {
        toast({ title: "Insufficient funds", description: "رصيدك غير كافٍ — أودِع أولًا من المحفظة.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg || "Failed to create order.", variant: "destructive" });
      }
    }
  }

  // ===== Delete handler =====
  async function handleDelete(id: string) {
    try {
      await apiRequest("DELETE", `/api/listings/${id}`);
      toast({ title: "Deleted", description: "Listing deleted successfully" });
      setLocalListings((prev) => prev.filter((l) => l.id !== id)); // تحديث بدون reload
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to delete listing",
        variant: "destructive",
      });
    }
  }

  const currentUser = me ? { id: me.id, username: me.username, role: me.role } : undefined;

  return (
    <div className={containerCls}>
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-foreground">{L.title}</h1>
              <p className="text-[11px] text-muted-foreground">{L.subtitle}</p>
            </div>
          </div>

          {!statsLoading && (
            <div className={["transition-all duration-300 overflow-hidden", showStats ? "max-h-24 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0 pointer-events-none"].join(" ")}>
              <div className="grid grid-cols-3 gap-2">
                <Card><CardContent className="px-3 py-2 text-center">
                  <div className="text-base font-bold text-foreground">{(stats as any)?.totalSales ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{L.salesCountLabel}</div>
                </CardContent></Card>
                <Card><CardContent className="px-3 py-2 text-center">
                  <div className="text-base font-bold text-foreground">{(stats as any)?.totalVolume ?? 0} TON</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{L.salesVolumeLabel}</div>
                </CardContent></Card>
                <Card><CardContent className="px-3 py-2 text-center">
                  <div className="text-base font-bold text-foreground">{(stats as any)?.activeListings ?? 0}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{L.activeListingsLabel}</div>
                </CardContent></Card>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="bg-card px-4 py-3 border-b border-border">
        {/* ... filters code (نفس الكود الأصلي) ... */}
      </div>

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{L.title}</h2>
          <Button variant="outline" size="sm" onClick={() => setSortAsc(!sortAsc)}>
            <Filter className="w-4 h-4 mr-1" />
            {sortAsc ? L.sortAsc : L.sortDesc}
          </Button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <div className="opacity-60 text-lg mb-2">📭</div>
            <h3 className="font-medium mb-1">{L.noFound}</h3>
            <p className="text-sm text-muted-foreground">{L.tryFilters}</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing as any}
                currentUser={currentUser as any}
                onViewDetails={() => console.log("View", listing.id)}
                onBuyNow={() => handleBuy(listing)}
                onDelete={handleDelete} // ✅ تمرير الحذف
              />
            ))}
          </div>
        )}

        {!listingsLoading && sorted.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" className="px-6" disabled>
              {L.loadMore} (pagination not implemented yet)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}