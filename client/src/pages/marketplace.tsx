// client/src/pages/marketplace.tsx
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Kind = "username" | "account" | "channel" | "service" | "";
type Platform = "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok" | "";
type ChannelMode = "subscribers" | "gifts" | "";
type ServiceType = "followers" | "members" | "boost_channel" | "boost_group" | "";

const LABELS = (t: (k: string) => string) => ({
  title: t("market.title"),
  subtitle: t("market.subtitle"),
  searchPlaceholder: t("market.searchPlaceholder"),
  allTypes: t("market.allTypes"),
  sortAsc: t("market.sortByPriceAsc"),
  sortDesc: t("market.sortByPriceDesc"),
  loadMore: t("market.loadMore"),
  noFound: t("market.noFound"),
  tryFilters: t("market.tryFilters"),
  salesCountLabel: t("market.salesCountLabel"),
  salesVolumeLabel: t("market.salesVolumeLabel"),
  activeListingsLabel: t("market.activeListingsLabel"),
  toastDeleted: t("market.toastDeleted"),
  toastDeleteError: t("market.toastDeleteError"),
  toastBuyConfirm: t("market.toastBuyConfirm"),
  toastBuySuccess: t("market.toastBuySuccess"),
  toastBuyError: t("market.toastBuyError"),
  toastInsufficient: t("market.toastInsufficient"),
  toastUnauthorized: t("market.toastUnauthorized"),
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
  const qc = useQueryClient();
  const L = useMemo(() => LABELS(t), [t]);
  const containerCls = "min-h-screen bg-background text-foreground";

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("");
  const [platform, setPlatform] = useState<Platform>("");
  const [channelMode, setChannelMode] = useState<ChannelMode>("");
  const [serviceType, setServiceType] = useState<ServiceType>("");

  const [sortAsc, setSortAsc] = useState(true);

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

  // ===== Buy mutation =====
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<AnyListing | null>(null);

  const buyMutation = useMutation({
    mutationFn: async (listingId: string) =>
      await apiRequest("POST", "/api/wallet/pay", { listingId }),
    onSuccess: () => {
      toast({ title: L.toastBuySuccess });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      setBuyDialogOpen(false);
      setSelectedListing(null);
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.startsWith("401")) {
        toast({ title: L.toastUnauthorized, variant: "destructive" });
      } else if (msg.includes("insufficient_balance")) {
        toast({ title: L.toastInsufficient, variant: "destructive" });
      } else {
        toast({ title: L.toastBuyError, description: msg, variant: "destructive" });
      }
    },
  });

  // ===== Delete mutation =====
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await apiRequest("DELETE", `/api/listings/${id}`),
    onSuccess: () => {
      toast({ title: L.toastDeleted });
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
    },
    onError: (e: any) => {
      toast({ title: L.toastDeleteError, description: e?.message || "", variant: "destructive" });
    },
  });

  const currentUser = me ? { id: me.id, username: me.username, role: me.role } : undefined;

  return (
    <div className={containerCls}>
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-2">
          <h1 className="text-base font-semibold">{L.title}</h1>
          <p className="text-[11px] text-muted-foreground">{L.subtitle}</p>
        </div>
      </header>

      {/* Filters placeholder */}
      <div className="bg-card px-4 py-3 border-b border-border">Filters here…</div>

      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{L.title}</h2>
          <Button variant="outline" size="sm" onClick={() => setSortAsc(!sortAsc)}>
            <Filter className="w-4 h-4 mr-1" />
            {sortAsc ? L.sortAsc : L.sortDesc}
          </Button>
        </div>

        {listingsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-20 w-full" />
              </CardContent></Card>
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
                onBuyNow={() => {
                  setSelectedListing(listing);
                  setBuyDialogOpen(true);
                }}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {!listingsLoading && sorted.length > 0 && (
          <div className="text-center mt-6">
            <Button variant="outline" className="px-6" disabled>
              {L.loadMore}
            </Button>
          </div>
        )}
      </div>

      {/* Confirm Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L.toastBuyConfirm}</DialogTitle>
          </DialogHeader>
          <p>
            {selectedListing
              ? `${t("market.buyPrompt")} ${selectedListing.title} (${selectedListing.price} TON)`
              : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => selectedListing && buyMutation.mutate(selectedListing.id)}
              disabled={buyMutation.isPending}
            >
              {buyMutation.isPending ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}