// client/src/pages/marketplace.tsx
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
  sortByPrice: t("market.sortByPrice") || "Sort: Price Low to High",
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

  const [showStats, setShowStats] = useState(true);
  useEffect(() => {
    const onScroll = () => setShowStats(window.scrollY < 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ===== me (لازم لتمييز المالك وتمرير currentUser) =====
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

  // Listings (match backend params)
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

  const usernamePlatforms: Platform[] = ["telegram","twitter","instagram","discord","snapchat","tiktok"];
  const accountPlatforms: Platform[] = ["telegram","twitter","instagram","discord","snapchat","tiktok"];
  const channelModes: ChannelMode[] = ["subscribers","gifts"];
  const serviceTypes: ServiceType[] = ["followers","members","boost_channel","boost_group"];

  const chipCls = (active: boolean) =>
    `whitespace-nowrap border ${active ? "bg-telegram-500 text-white hover:bg-telegram-600" : "bg-card hover:bg-accent"}`;

  const clearAll = () => { setKind(""); setPlatform(""); setChannelMode(""); setServiceType(""); setSearch(""); };

  // ===== Buy handler =====
  async function handleBuy(listing: AnyListing) {
    try {
      await apiRequest("POST", "/api/activities", {
        listingId: listing.id,
        type: "buy",
      });
      toast({ title: "Order created", description: "Check Activity tab for status." });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("401")) {
        toast({ title: "Unauthorized", description: "افتح الميني‑أب داخل تيليجرام لتسجيل الدخول.", variant: "destructive" });
      } else if (msg.includes("INSUFFICIENT_FUNDS") || msg.startsWith("402")) {
        toast({ title: "Insufficient funds", description: "رصيدك غير كافٍ — أودِع أولًا من المحفظة.", variant: "destructive" });
      } else if (msg.includes("Wallet not set")) {
        toast({ title: "Wallet needed", description: "أضف عنوان محفظتك من الصفحة الشخصية.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg || "Failed to create order.", variant: "destructive" });
      }
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

      <div className="bg-card px-4 py-3 border-b border-border">
        <div className="space-y-3">
          <div className="relative">
            <Input placeholder={L.searchPlaceholder} value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10 pr-4"/>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant={kind===""?"default":"outline"} className={chipCls(kind==="")} onClick={clearAll}>
              {L.allTypes}
            </Button>
            <Button size="sm" variant={kind==="username"?"default":"outline"} className={chipCls(kind==="username")}
              onClick={() => { setKind("username"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.username}
            </Button>
            <Button size="sm" variant={kind==="account"?"default":"outline"} className={chipCls(kind==="account")}
              onClick={() => { setKind("account"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.account}
            </Button>
            <Button size="sm" variant={kind==="channel"?"default":"outline"} className={chipCls(kind==="channel")}
              onClick={() => { setKind("channel"); setPlatform("telegram"); setChannelMode(""); setServiceType(""); }}>
              {L.channel}
            </Button>
            <Button size="sm" variant={kind==="service"?"default":"outline"} className={chipCls(kind==="service")}
              onClick={() => { setKind("service"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.service}
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll}>Reset</Button>
          </div>

          {(kind==="username" || kind==="account") && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(kind==="username"?usernamePlatforms:accountPlatforms).map(p=>(
                <Button key={p} size="sm" variant={platform===p?"default":"outline"} className={chipCls(platform===p)}
                  onClick={()=> setPlatform(platform===p?"":p)}>
                  <span className="mr-1">{ICON[p]}</span>{p}
                </Button>
              ))}
            </div>
          )}

          {kind==="channel" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {channelModes.map(m=>(
                <Button key={m} size="sm" variant={channelMode===m?"default":"outline"} className={chipCls(channelMode===m)}
                  onClick={()=> setChannelMode(channelMode===m?"":m)}>
                  <span className="mr-1">{ICON[m]}</span>{m==="subscribers"?L.modeSubscribers:L.modeGifts}
                </Button>
              ))}
            </div>
          )}

          {kind==="service" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {serviceTypes.map(s=>(
                <Button key={s} size="sm" variant={serviceType===s?"default":"outline"} className={chipCls(serviceType===s)}
                  onClick={()=> setServiceType(serviceType===s?"":s)}>
                  <span className="mr-1">{ICON[s]}</span>
                  {{followers:L.serviceFollowers,members:L.serviceSubscribers,boost_channel:L.boostCh,boost_group:L.boostGp}[s]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{L.title}</h2>
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-1"/>{L.sortByPrice}</Button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_,i)=>(
              <Card key={i}><CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-12 h-12 rounded-full"/><div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3"/><Skeleton className="h-3 w-1/2"/><Skeleton className="h-3 w-full"/><Skeleton className="h-8 w-24"/>
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <div className="opacity-60 text-lg mb-2">📭</div>
            <h3 className="font-medium mb-1">{L.noFound}</h3>
            <p className="text-sm text-muted-foreground">{L.tryFilters}</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing as any}
                currentUser={currentUser as any}
                onViewDetails={() => console.log("View", listing.id)}
                onBuyNow={() => handleBuy(listing)}
              />
            ))}
          </div>
        )}

        {!listingsLoading && filtered.length > 0 && (
          <div className="text-center mt-6"><Button variant="outline" className="px-6">{L.loadMore}</Button></div>
        )}
      </div>
    </div>
  );
}