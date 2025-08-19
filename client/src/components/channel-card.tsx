// client/src/components/ListingCard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ShoppingCart, Users, Zap, CheckCircle, X } from "lucide-react";
import { AdminControls } from "@/components/admin-controls";
import { type Listing as Channel } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";

interface ListingCardProps {
  listing: Channel & {
    gifts?: { statueOfLiberty?: number; torchOfFreedom?: number };
  };
  onViewDetails: (l: Channel) => void;
  onBuyNow: (l: Channel) => void;
  currentUser?: { username?: string };
}

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "?";
};
const N = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const formatNumber = (num: number): string =>
  num >= 1_000_000 ? (num / 1_000_000).toFixed(1) + "M" :
  num >= 1_000 ? (num / 1_000).toFixed(1) + "K" :
  String(Math.trunc(num));

export function ListingCard({ listing, onViewDetails, onBuyNow, currentUser }: ListingCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const { t } = useLanguage();

  const title = S(listing.title) || S(listing.username) || `${S(listing.platform) || "item"}:${S(listing.kind) || "listing"}`;
  const uname = S(listing.username);
  const desc  = S(listing.description);
  const kind  = S(listing.kind);        // username | account | channel | service
  const plat  = S(listing.platform);    // telegram | twitter | ...
  const currency = S(listing.currency) || "TON";
  const priceNum = Number(String(listing.price || "0").replace(",", "."));
  const usd = currency === "TON" ? priceNum * 5.1 : priceNum; // تبسيط: إذا USDT اعتبره ≈ USD

  const showSubs = kind === "channel";
  const subsCount = N((listing as any).subscribersCount);
  const giftKind  = S((listing as any).giftKind);
  const giftsCount = N((listing as any).giftsCount);
  const followers = N((listing as any).followersCount);
  const accCreatedAt = S((listing as any).accountCreatedAt);
  const serviceType = S((listing as any).serviceType);
  const target = S((listing as any).target);
  const serviceCount = N((listing as any).serviceCount);

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-telegram-500 to-telegram-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {initialFrom(title)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
                {listing.isVerified ? <CheckCircle className="w-4 h-4 text-telegram-500" /> : null}
                <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                  {plat || "—"} · {kind || "—"}
                </Badge>
              </div>

              {uname ? <p className="text-sm text-gray-600 mb-2">@{uname}</p> : null}
              {desc ? <p className="text-sm text-gray-500 line-clamp-2">{desc}</p> : null}
            </div>
          </div>

          {/* Metrics حسب النوع */}
          <div className="grid grid-cols-3 gap-4 mt-4 py-3 bg-gray-50 rounded-lg">
            {showSubs ? (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold text-gray-900">
                    <Users className="w-4 h-4" />
                    <span>{formatNumber(subsCount)}</span>
                  </div>
                  <div className="text-xs text-gray-500">{t("channel.subscribers")}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <Zap className="w-4 h-4" />
                    <span>{giftKind ? giftKind : "-"}</span>
                  </div>
                  <div className="text-xs text-gray-500">{t("gift.kind") || "gift kind"}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <Zap className="w-4 h-4" />
                    <span>{formatNumber(giftsCount)}</span>
                  </div>
                  <div className="text-xs text-gray-500">{t("gift.count") || "gifts"}</div>
                </div>
              </>
            ) : kind === "account" ? (
              <>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-lg font-semibold">
                    <Users className="w-4 h-4" />
                    <span>{formatNumber(followers)}</span>
                  </div>
                  <div className="text-xs text-gray-500">{t("account.followers") || "followers"}</div>
                </div>
                <div className="text-center col-span-2">
                  <div className="text-lg font-semibold">{accCreatedAt || "—"}</div>
                  <div className="text-xs text-gray-500">{t("account.createdAt") || "created at (YYYY-MM)"}</div>
                </div>
              </>
            ) : kind === "service" ? (
              <>
                <div className="text-center">
                  <div className="text-lg font-semibold">{serviceType || "—"}</div>
                  <div className="text-xs text-gray-500">{t("service.type") || "service type"}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{target || "—"}</div>
                  <div className="text-xs text-gray-500">{t("service.target") || "target"}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{formatNumber(serviceCount)}</div>
                  <div className="text-xs text-gray-500">{t("service.count") || "count"}</div>
                </div>
              </>
            ) : (
              // username
              <>
                <div className="text-center col-span-3">
                  <div className="text-lg font-semibold">{S((listing as any).tgUserType) || "—"}</div>
                  <div className="text-xs text-gray-500">{t("username.type") || "user type"}</div>
                </div>
              </>
            )}
          </div>

          {/* Price + Actions */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {priceNum.toLocaleString()} {currency}
              </div>
              <div className="text-sm text-gray-500">≈ ${usd.toLocaleString()} USD</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowInfo(true)} className="text-gray-700">
                <Eye className="w-4 h-4 mr-1" />
                {t("channel.info")}
              </Button>
              <Button size="sm" onClick={() => setShowBuyConfirm(true)} className="bg-telegram-500 hover:bg-telegram-600 text-white">
                <ShoppingCart className="w-4 h-4 mr-1" />
                {t("channel.buyNow")}
              </Button>
            </div>
          </div>

          {/* Admin */}
          <AdminControls channel={listing as any} currentUser={currentUser} />
        </CardContent>
      </Card>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-lg">
            <button onClick={() => setShowInfo(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">{t("channel.giftsInfo")}</h2>

            {kind === "channel" ? (
              <>
                <p className="mb-2">🎯 {t("channel.mode") || "mode"}: <strong>{S((listing as any).channelMode) || "—"}</strong></p>
                <p className="mb-2">👥 {t("channel.subscribers")}: <strong>{formatNumber(subsCount)}</strong></p>
                <p className="mb-2">🎁 {t("gift.kind")}: <strong>{giftKind || "—"}</strong></p>
                <p className="mb-2">🎁 {t("gift.count")}: <strong>{formatNumber(giftsCount)}</strong></p>
              </>
            ) : kind === "account" ? (
              <>
                <p className="mb-2">👥 {t("account.followers")}: <strong>{formatNumber(followers)}</strong></p>
                <p className="mb-2">📅 {t("account.createdAt")}: <strong>{accCreatedAt || "—"}</strong></p>
              </>
            ) : kind === "service" ? (
              <>
                <p className="mb-2">🛠 {t("service.type")}: <strong>{serviceType || "—"}</strong></p>
                <p className="mb-2">🎯 {t("service.target")}: <strong>{target || "—"}</strong></p>
                <p className="mb-2">🔢 {t("service.count")}: <strong>{formatNumber(serviceCount)}</strong></p>
              </>
            ) : (
              <>
                <p className="mb-2">👤 {t("username.type")}: <strong>{S((listing as any).tgUserType) || "—"}</strong></p>
              </>
            )}

            {uname ? (
              <p>{t("channel.username")}: <a href={`https://t.me/${uname}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">@{uname}</a></p>
            ) : null}
          </div>
        </div>
      )}

      {/* Buy Confirmation Modal */}
      {showBuyConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-lg">
            <button onClick={() => setShowBuyConfirm(false)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold mb-4">{t("channel.confirmPurchase")}</h2>
            <p className="mb-2">{t("channel.confirmQuestion")}</p>

            {kind === "channel" && (
              <>
                <p className="mb-2">👥 {t("channel.subscribers")}: <strong>{formatNumber(subsCount)}</strong></p>
                <p className="mb-2">🎁 {t("gift.kind")}: <strong>{giftKind || "—"}</strong></p>
                <p className="mb-2">🎁 {t("gift.count")}: <strong>{formatNumber(giftsCount)}</strong></p>
              </>
            )}
            {uname ? (
              <p className="mb-4">{t("channel.username")}: <a href={`https://t.me/${uname}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">@{uname}</a></p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBuyConfirm(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => { setShowBuyConfirm(false); onBuyNow(listing); }} className="bg-telegram-500 hover:bg-telegram-600 text-white">
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}