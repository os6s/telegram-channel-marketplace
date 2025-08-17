// client/src/pages/marketplace.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Filter, AtSign, Hash, Sparkles, User2, Users, Gift, Megaphone, Rocket,
} from "lucide-react";
import { ChannelCard } from "@/components/channel-card";
import { useLanguage } from "@/contexts/language-context";
import type { Channel } from "@shared/schema";

// ستور مشترك مع صفحة البيع
import {
  onListingsChange,
  listLocalListings,
  type AnyListing,
  type Kind, type Platform, type ChannelMode, type ServiceType,
} from "@/store/listings";

/* ===== i18n ===== */
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

  telegramUser: t("market.type.telegramUser") || "Telegram User",
  instagramUser: t("market.type.instagramUser") || "Instagram User",
  twitterUser: t("market.type.twitterUser") || "Twitter User",
  snapchatUser: t("market.type.snapchatUser") || "Snapchat User",
  tiktokUser: t("market.type.tiktokUser") || "TikTok User",

  modeSubscribers: t("sell.modeSubscribers") || "Subscribers channel",
  modeGifts: t("sell.modeGifts") || "Gifts channel",

  serviceFollowers: t("market.type.serviceFollowers") || "Followers Service",
  serviceSubscribers: t("market.type.serviceSubscribers") || "Subscribers Service",
  boostCh: t("sell.boostCh") || "Boost Telegram Channel",
  boostGp: t("sell.boostGp") || "Boost Telegram Group",
});

/* ===== أيقونات ===== */
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
  const L = useMemo(() => LABELS(t), [t]);

  // توحيد الثيم مثل باقي الصفحات
  // نعتمد على طبقات shadcn: bg-background, text-foreground, card...
  const containerCls = "min-h-screen bg-background text-foreground";

  /* state */
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [platform, setPlatform] = useState<Platform>("");
  const [channelMode, setChannelMode] = useState<ChannelMode>("");
  const [serviceType, setServiceType] = useState<ServiceType>("");

  /* stats */
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["/api/stats"] });

  /* جلب من السيرفر */
  const serverQueryKey = ["/api/listings", { search, kind, platform, channelMode, serviceType }];
  const { data: serverListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: serverQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (kind) params.set("type", kind);
      if (platform) params.set("platform", platform);
      if (channelMode) params.set("channelMode", channelMode);
      if (serviceType) params.set("serviceType", serviceType);

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = (await res.json()) as AnyListing[];
      return data;
    },
  });

  /* اشتراك محلي يستقبل ما يأتي من صفحة البيع */
  const [localListings, setLocalListings] = useState<AnyListing[]>(() => listLocalListings());
  useEffect(() => {
    setLocalListings(listLocalListings());
    const off = onListingsChange(() => setLocalListings(listLocalListings()));
    return off;
  }, []);

  /* الدمج: السيرفر + المحلي (المحلي يُقدَّم أولاً لظهور فوري بعد النشر) */
  const merged: AnyListing[] = useMemo(() => {
    // منع التكرار على أساس id
    const map = new Map<string, AnyListing>();
    for (const l of localListings) map.set(l.id, l);
    for (const l of serverListings as AnyListing[]) if (!map.has(l.id)) map.set(l.id, l);
    return Array.from(map.values());
  }, [localListings, serverListings]);

  /* فلترة حماية */
  const filtered = merged.filter((it) => {
    if (kind && (it.kind || "") !== kind) return false;
    if (platform && (it.platform || "") !== platform) return false;
    if (channelMode && (it.channelMode || "") !== channelMode) return false;
    if (serviceType && (it.serviceType || "") !== serviceType) return false;
    if (search) {
      const s = search.toLowerCase();
      const blob = `${it.name || ""} ${it.username || ""} ${it.title || ""} ${it.platform || ""}`.toLowerCase();
      if (!blob.includes(s)) return false;
    }
    return true;
  });

  const usernamePlatforms: Platform[] = ["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"];
  const accountPlatforms: Platform[] = ["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"];
  const channelModes: ChannelMode[] = ["subscribers", "gifts"];
  const serviceTypes: ServiceType[] = ["followers", "members", "boost_channel", "boost_group"];

  const chipCls = (active: boolean) =>
    `whitespace-nowrap border ${
      active ? "bg-telegram-500 text-white hover:bg-telegram-600" : "bg-card hover:bg-accent"
    }`;

  const clearAll = () => {
    setKind("");
    setPlatform("");
    setChannelMode("");
    setServiceType("");
    setSearch("");
  };

  return (
    <div className={containerCls}>
      {/* Header موحد */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-telegram-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2A10 10 0 1 1 2 12 10.011 10.011 0 0 1 12 2Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{L.title}</h1>
                <p className="text-xs text-muted-foreground">{L.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          {!statsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{(stats as any)?.sold ?? 0}</div>
                  <div className="text-sm text-muted-foreground mt-1">{L.salesCountLabel}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{(stats as any)?.totalVolume ?? 0} USDT</div>
                  <div className="text-sm text-muted-foreground mt-1">{L.salesVolumeLabel}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{(stats as any)?.activeListings ?? 0}</div>
                  <div className="text-sm text-muted-foreground mt-1">{L.activeListingsLabel}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </header>

      {/* Search + Filters */}
      <div className="bg-card px-4 py-4 border-b border-border">
        <div className="space-y-4">
          {/* search */}
          <div className="relative">
            <Input
              placeholder={L.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          </div>

          {/* kind row */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button size="sm" variant={kind === "" ? "default" : "outline"} className={chipCls(kind === "")}
              onClick={() => { setKind(""); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.allTypes}
            </Button>
            <Button size="sm" variant={kind === "username" ? "default" : "outline"} className={chipCls(kind === "username")}
              onClick={() => { setKind("username"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.username}
            </Button>
            <Button size="sm" variant={kind === "account" ? "default" : "outline"} className={chipCls(kind === "account")}
              onClick={() => { setKind("account"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.account}
            </Button>
            <Button size="sm" variant={kind === "channel" ? "default" : "outline"} className={chipCls(kind === "channel")}
              onClick={() => { setKind("channel"); setPlatform("telegram"); setChannelMode(""); setServiceType(""); }}>
              {L.channel}
            </Button>
            <Button size="sm" variant={kind === "service" ? "default" : "outline"} className={chipCls(kind === "service")}
              onClick={() => { setKind("service"); setPlatform(""); setChannelMode(""); setServiceType(""); }}>
              {L.service}
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll}>Reset</Button>
          </div>

          {/* platform row */}
          {(kind === "username" || kind === "account") && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(kind === "username" ? usernamePlatforms : accountPlatforms).map((p) => (
                <Button key={p} size="sm" variant={platform === p ? "default" : "outline"} className={chipCls(platform === p)}
                  onClick={() => setPlatform(platform === p ? "" : p)}>
                  <span className="mr-1">{ICON[p]}</span>{p}
                </Button>
              ))}
            </div>
          )}

          {/* channel mode row */}
          {kind === "channel" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {channelModes.map((m) => (
                <Button key={m} size="sm" variant={channelMode === m ? "default" : "outline"} className={chipCls(channelMode === m)}
                  onClick={() => setChannelMode(channelMode === m ? "" : m)}>
                  <span className="mr-1">{ICON[m]}</span>{m === "subscribers" ? L.modeSubscribers : L.modeGifts}
                </Button>
              ))}
            </div>
          )}

          {/* service type row */}
          {kind === "service" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {serviceTypes.map((s) => (
                <Button key={s} size="sm" variant={serviceType === s ? "default" : "outline"} className={chipCls(serviceType === s)}
                  onClick={() => setServiceType(serviceType === s ? "" : s)}>
                  <span className="mr-1">{ICON[s]}</span>
                  {{ followers: L.serviceFollowers, members: L.serviceSubscribers, boost_channel: L.boostCh, boost_group: L.boostGp }[s]}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Listings */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{L.title}</h2>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            {L.sortByPrice}
          </Button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}><CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              </CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="opacity-60 text-lg mb-2">📭</div>
              <h3 className="font-medium mb-1">{L.noFound}</h3>
              <p className="text-sm text-muted-foreground">{L.tryFilters}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((listing) => (
              <ChannelCard
                key={listing.id}
                channel={listing as Channel}
                onViewDetails={() => console.log("View", listing.id)}
                onBuyNow={() => console.log("Buy", listing.id)}
              />
            ))}
          </div>
        )}

        {!listingsLoading && filtered.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" className="px-6">{L.loadMore}</Button>
          </div>
        )}
      </div>
    </div>
  );
}