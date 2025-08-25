// client/src/components/ListingCard.tsx
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, Users, Zap, CheckCircle, X } from "lucide-react";
import { AdminControls } from "@/components/admin-controls";
import { type Listing as Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
import { EditListingDialog } from "@/components/EditListingDialog";

interface ListingCardProps {
  listing: Channel & {
    seller?: { id: string; username?: string | null; name?: string | null };
    sellerUsername?: string | null;
    gifts?: { statueOfLiberty?: number; torchOfFreedom?: number };
    canDelete?: boolean;
  };
  onViewDetails: (l: Channel) => void;
  onBuyNow: (l: Channel) => void;
  currentUser?: { id?: string; username?: string; role?: "user" | "admin" };
}

const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "?";
};
const formatNumber = (num: number): string =>
  num >= 1_000_000 ? (num / 1_000_000).toFixed(1) + "M" :
  num >= 1_000 ? (num / 1_000).toFixed(1) + "K" : String(Math.trunc(num));

export function ListingCard({ listing, onViewDetails, onBuyNow, currentUser }: ListingCardProps) {
  const { t } = useLanguage();
  const [showInfo, setShowInfo] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const title = S(listing.title) || S(listing.username) || `${S(listing.platform) || "item"}:${S(listing.kind) || "listing"}`;
  const uname = S(listing.username);
  const desc  = S(listing.description);
  const kind  = S(listing.kind);
  const plat  = S(listing.platform);
  const currency = S(listing.currency) || "TON";
  const priceNum = N(listing.price);

  const sellerUsername = (listing.seller?.username || listing.sellerUsername || "").toLowerCase();
  const currentUname = (currentUser?.username || "").toLowerCase();
  const isAdmin = currentUser?.role === "admin";
  const isOwner = !!sellerUsername && !!currentUname && sellerUsername === currentUname;

  const showSubs = kind === "channel";
  const subsCount = N((listing as any).subscribersCount);
  const giftKind  = S((listing as any).giftKind);
  const giftsCount = N((listing as any).giftsCount);
  const followers = N((listing as any).followersCount);
  const accCreatedAt = S((listing as any).accountCreatedAt);
  const serviceType = S((listing as any).serviceType);
  const target = S((listing as any).target);
  const serviceCount = N((listing as any).serviceCount);

  const sellerLabel = useMemo(() => {
    const u = listing.seller?.username || listing.sellerUsername;
    const name = listing.seller?.name;
    if (u) return `@${u}`;
    if (name) return name;
    return t("market.unknownSeller") || "Unknown seller";
  }, [listing, t]);

  return (
    <>
      <Card className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onViewDetails(listing)}
              className="w-12 h-12 bg-gradient-to-br from-telegram-500 to-telegram-600 rounded-full flex items-center justify-center text-white font-semibold text-lg"
              aria-label={title}
            >
              {initialFrom(title)}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground truncate">{title}</h3>
                {Boolean((listing as any).isVerified) ? <CheckCircle className="w-4 h-4 text-telegram-500" /> : null}
                <Badge variant="secondary" className="bg-muted text-foreground">
                  {plat || "—"} · {kind || "—"}
                </Badge>
              </div>

              <div className="text-[12px] text-muted-foreground mb-1 flex items-center gap-1">
                👤 {t("market.seller") || "Seller"}:{" "}
                <span className="font-medium text-foreground">{sellerLabel}</span>
              </div>

              {uname ? <p className="text-sm text-muted-foreground mb-2">@{uname}</p> : null}
              {desc ? <p className="text-sm text-muted-foreground line-clamp-2">{desc}</p> : null}
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mt-4 py-3 bg-muted rounded-lg">
            {showSubs ? (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <Users className="w-4 h-4" /><span>{formatNumber(subsCount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{t("channel.subscribers")}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <Zap className="w-4 h-4" /><span>{giftKind || "-"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{t("gift.kind") || "gift kind"}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <Zap className="w-4 h-4" /><span>{formatNumber(giftsCount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{t("gift.count") || "gifts"}</div>
                </div>
              </>
            ) : kind === "account" ? (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-foreground">
                    <Users className="w-4 h-4" /><span>{formatNumber(followers)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{t("account.followers") || "followers"}</div>
                </div>
                <div className="text-center col-span-2">
                  <div className="text-lg font-semibold text-foreground">{accCreatedAt || "—"}</div>
                  <div className="text-xs text-muted-foreground">{t("account.createdAt") || "created at (YYYY-MM)"}</div>
                </div>
              </>
            ) : kind === "service" ? (
              <>
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground">{serviceType || "—"}</div>
                  <div className="text-xs text-muted-foreground">{t("service.type") || "service type"}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground">{target || "—"}</div>
                  <div className="text-xs text-muted-foreground">{t("service.target") || "target"}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground">{formatNumber(serviceCount)}</div>
                  <div className="text-xs text-muted-foreground">{t("service.count") || "count"}</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center col-span-3">
                  <div className="text-lg font-semibold text-foreground">{S((listing as any).tgUserType) || "—"}</div>
                  <div className="text-xs text-muted-foreground">{t("username.type") || "user type"}</div>
                </div>
              </>
            )}
          </div>

          {/* Price + Actions */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {priceNum.toLocaleString()} {currency}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onViewDetails(listing)}>
                <Eye className="w-4 h-4 mr-1" /> {t("channel.info")}
              </Button>

              {!isOwner && (
                <Button
                  size="sm"
                  disabled={priceNum <= 0}
                  onClick={() => setShowBuyConfirm(true)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <ShoppingCart className="w-4 h-4 mr-1" /> {t("channel.buyNow")}
                </Button>
              )}
            </div>
          </div>

          {/* أدوات المالك */}
          {isOwner && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                ✏️ {t("channel.edit") || "Edit"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this listing?")) {
                    await apiRequest("DELETE", `/api/listings/${listing.id}`);
                    window.location.reload();
                  }
                }}
              >
                🗑 {t("channel.delete") || "Delete"}
              </Button>
            </div>
          )}

          {/* أدوات الإدارة: للإدمن */}
          {isAdmin ? <AdminControls channel={listing as any} currentUser={currentUser} /> : null}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {isOwner && (
        <EditListingDialog open={editOpen} onOpenChange={setEditOpen} listing={listing} />
      )}

      {/* Buy Confirmation */}
      {showBuyConfirm && !isOwner && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 relative shadow-lg">
            <button
              onClick={() => setShowBuyConfirm(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-foreground">{t("channel.confirmPurchase")}</h2>
            <p className="mb-2 text-foreground">{t("channel.confirmQuestion")}</p>

            {kind === "channel" && (
              <>
                <p className="mb-2 text-foreground">👥 {t("channel.subscribers")}: <strong>{formatNumber(subsCount)}</strong></p>
                <p className="mb-2 text-foreground">🎁 {t("gift.kind")}: <strong>{giftKind || "—"}</strong></p>
                <p className="mb-4 text-foreground">🎁 {t("gift.count")}: <strong>{formatNumber(giftsCount)}</strong></p>
              </>
            )}
            {uname ? (
              <p className="mb-4 text-foreground">
                {t("channel.username")}:{" "}
                <a href={`https://t.me/${uname}`} target="_blank" rel="noopener noreferrer" className="underline">
                  @{uname}
                </a>
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBuyConfirm(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={priceNum <= 0}
                onClick={() => { setShowBuyConfirm(false); onBuyNow(listing); }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}