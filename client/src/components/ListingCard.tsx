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
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [localListing, setLocalListing] = useState(listing); // ✅ state محلي للتحديث

  const title = S(localListing.title) || S(localListing.username) || `${S(localListing.platform) || "item"}:${S(localListing.kind) || "listing"}`;
  const uname = S(localListing.username);
  const desc  = S(localListing.description);
  const kind  = S(localListing.kind);
  const plat  = S(localListing.platform);
  const currency = S(localListing.currency) || "TON";
  const priceNum = N(localListing.price);

  const sellerUsername = (localListing.seller?.username || localListing.sellerUsername || "").toLowerCase();
  const currentUname = (currentUser?.username || "").toLowerCase();
  const isAdmin = currentUser?.role === "admin";
  const isOwner = !!sellerUsername && !!currentUname && sellerUsername === currentUname;

  const showSubs = kind === "channel";
  const subsCount = N((localListing as any).subscribersCount);
  const giftKind  = S((localListing as any).giftKind);
  const giftsCount = N((localListing as any).giftsCount);
  const followers = N((localListing as any).followersCount);
  const accCreatedAt = S((localListing as any).accountCreatedAt);
  const serviceType = S((localListing as any).serviceType);
  const target = S((localListing as any).target);
  const serviceCount = N((localListing as any).serviceCount);

  const sellerLabel = useMemo(() => {
    const u = localListing.seller?.username || localListing.sellerUsername;
    const name = localListing.seller?.name;
    if (u) return `@${u}`;
    if (name) return name;
    return t("market.unknownSeller") || "Unknown seller";
  }, [localListing, t]);

  return (
    <>
      <Card className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* ... باقي الكود نفس قبل ... */}

          {/* Price + Actions */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {priceNum.toLocaleString()} {currency}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onViewDetails(localListing)}>
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
                    await apiRequest("DELETE", `/api/listings/${localListing.id}`);
                    window.location.reload();
                  }
                }}
              >
                🗑 {t("channel.delete") || "Delete"}
              </Button>
            </div>
          )}

          {isAdmin ? <AdminControls channel={localListing as any} currentUser={currentUser} /> : null}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {isOwner && (
        <EditListingDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          listing={localListing}
          onUpdated={(updated) => setLocalListing(updated)} // ✅ تحديث state محلي
        />
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
                onClick={() => { setShowBuyConfirm(false); onBuyNow(localListing); }}
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