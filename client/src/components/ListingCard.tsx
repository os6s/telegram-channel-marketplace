// client/src/components/ListingCard.tsx
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, CheckCircle, X } from "lucide-react";
import { type Listing as Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";
import { apiRequest } from "@/lib/queryClient";
import { EditListingDialog } from "@/components/EditListingDialog";

interface ListingCardProps {
  listing: Channel & {
    seller?: { id: string; username?: string | null; name?: string | null };
    sellerUsername?: string | null;
  };
  onViewDetails: (l: Channel) => void;
  onBuyNow: (l: Channel) => void;
  onDelete?: (id: string) => void; // ✅ بدل reload
  currentUser?: { id?: string; username?: string; role?: "user" | "admin" };
}

/* ===== Helpers ===== */
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "?";
};

/* ===== Metrics Component ===== */
function ListingMetrics({ listing }: { listing: any }) {
  const { t } = useLanguage();
  const kind = S(listing.kind);
  const subsCount = N(listing.subscribersCount);
  const followers = N(listing.followersCount);

  if (kind === "channel") {
    return (
      <div className="grid grid-cols-2 gap-4 mt-4 py-3 bg-muted rounded-lg text-center">
        <div>
          <div className="text-lg font-semibold">{subsCount.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{t("channel.subscribers")}</div>
        </div>
      </div>
    );
  }

  if (kind === "account") {
    return (
      <div className="grid grid-cols-1 gap-4 mt-4 py-3 bg-muted rounded-lg text-center">
        <div>
          <div className="text-lg font-semibold">{followers.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{t("account.followers")}</div>
        </div>
      </div>
    );
  }

  return null;
}

/* ===== Actions Component ===== */
function ListingActions({
  isOwner,
  isAdmin,
  priceNum,
  onViewDetails,
  onBuyNow,
  onEdit,
  onDelete,
  listing,
}: {
  isOwner: boolean;
  isAdmin: boolean;
  priceNum: number;
  onViewDetails: () => void;
  onBuyNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
  listing: any;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-2 mt-4">
      {/* زر المعلومات */}
      <Button variant="outline" size="sm" onClick={onViewDetails}>
        <Eye className="w-4 h-4 mr-1" /> {t("channel.info")}
      </Button>

      {/* زر الشراء */}
      {!isOwner && (
        <Button
          size="sm"
          disabled={priceNum <= 0 || !listing.isActive}
          onClick={onBuyNow}
          className="bg-green-500 hover:bg-green-600 text-white"
          title={t("channel.buyNowTooltip") || "Buy securely with escrow"}
        >
          <ShoppingCart className="w-4 h-4 mr-1" /> {t("channel.buyNow")}
        </Button>
      )}

      {/* أدوات المالك */}
      {isOwner && (
        <>
          <Button size="sm" variant="secondary" onClick={onEdit}>
            ✏️ {t("channel.edit") || "Edit"}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            🗑 {t("channel.delete") || "Delete"}
          </Button>
        </>
      )}

      {/* أدوات الإدمن */}
      {isAdmin && !isOwner && (
        <Button size="sm" variant="destructive" onClick={onDelete}>
          🗑 {t("channel.adminDelete") || "Delete (admin)"}
        </Button>
      )}
    </div>
  );
}

/* ===== Main Card ===== */
export function ListingCard({
  listing,
  onViewDetails,
  onBuyNow,
  onDelete,
  currentUser,
}: ListingCardProps) {
  const { t } = useLanguage();
  const [editOpen, setEditOpen] = useState(false);

  const title =
    S(listing.title) ||
    S(listing.username) ||
    `${S(listing.platform) || "item"}:${S(listing.kind) || "listing"}`;
  const uname = S(listing.username);
  const desc = S(listing.description);
  const currency = S(listing.currency) || "TON";
  const priceNum = N(listing.price);

  const sellerUsername = (listing.seller?.username || listing.sellerUsername || "").toLowerCase();
  const currentUname = (currentUser?.username || "").toLowerCase();
  const isAdmin = currentUser?.role === "admin";
  const isOwner = !!sellerUsername && !!currentUname && sellerUsername === currentUname;

  return (
    <>
      <Card className="bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Header */}
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
                {Boolean((listing as any).isVerified) && (
                  <CheckCircle className="w-4 h-4 text-telegram-500" />
                )}

                {/* حالة الإعلان */}
                {!listing.isActive && (
                  <Badge variant="destructive">
                    {t("channel.inactive") || "Inactive"}
                  </Badge>
                )}
              </div>

              {uname ? <p className="text-sm text-muted-foreground mb-2">@{uname}</p> : null}
              {desc ? <p className="text-sm text-muted-foreground line-clamp-2">{desc}</p> : null}
            </div>
          </div>

          {/* Metrics */}
          <ListingMetrics listing={listing} />

          {/* Price */}
          <div className="text-2xl font-bold text-foreground mt-4">
            {priceNum.toLocaleString()} {currency}
          </div>

          {/* Actions */}
          <ListingActions
            isOwner={isOwner}
            isAdmin={isAdmin}
            priceNum={priceNum}
            listing={listing}
            onViewDetails={() => onViewDetails(listing)}
            onBuyNow={() => onBuyNow(listing)}
            onEdit={() => setEditOpen(true)}
            onDelete={async () => {
              if (confirm(t("channel.confirmDelete") || "Are you sure you want to delete this listing?")) {
                await apiRequest("DELETE", `/api/listings/${listing.id}`);
                onDelete?.(listing.id); // ✅ تحديث الواجهة
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {isOwner && (
        <EditListingDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          listing={listing}
        />
      )}
    </>
  );
}