import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, ArrowLeft } from "lucide-react";
import TonIcon from "@/assets/icons/ton.svg"; // ✅ أيقونة TON

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "U";
};

export function ProfileHeader({
  telegramUser,
  onBack,
  onOpenSettings,
  t,
  balance,
  walletAddress,
  onToggleWallet,
}: {
  telegramUser: any;
  onBack: () => void;
  onOpenSettings: () => void;
  t: (k: string) => string;
  balance?: { balance: number; currency: string } | null;
  walletAddress?: string | null;
  onToggleWallet: () => void;
}) {
  return (
    <>
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{t("profilePage.title")}</h1>
                <p className="text-xs text-muted-foreground">{t("profilePage.subtitle")}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onOpenSettings}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {/* 🟢 قسم البروفايل */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={telegramUser?.photo_url} />
                <AvatarFallback className="bg-telegram-500 text-white text-xl">
                  {initialFrom(telegramUser?.first_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {S(telegramUser?.first_name)} {S(telegramUser?.last_name)}
                </h2>
                {telegramUser?.username && (
                  <p className="text-muted-foreground">@{telegramUser.username}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {telegramUser?.is_premium && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                      ⭐
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {t("profilePage.memberSince")} {new Date().getFullYear()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 🟢 قسم الرصيد + زر ربط المحفظة */}
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <TonIcon className="w-5 h-5" />
              <span className="font-semibold">
                {balance?.balance ?? 0} {balance?.currency || "TON"}
              </span>
              <Button
                size="sm"
                variant={walletAddress ? "destructive" : "default"}
                onClick={onToggleWallet}
              >
                {walletAddress ? t("wallet.disconnect") : t("wallet.connect")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}