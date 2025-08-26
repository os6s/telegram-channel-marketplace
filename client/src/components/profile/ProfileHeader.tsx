// client/src/components/profile/ProfileHeader.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings, ArrowLeft, Plus, Minus, Link2 } from "lucide-react";
import TonIcon from "@/assets/icons/ton.svg";

import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { useTonWallet, useTonConnectUI } from "@tonconnect/ui-react";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "U";
};

export function ProfileHeader({
  telegramUser,
  onBack,
  onOpenSettings,
  balance, // ✅ balance is passed from ProfilePage
}: {
  telegramUser: any;
  onBack: () => void;
  onOpenSettings: () => void;
  balance?: { balance: number; currency: string } | null;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");

  // ✅ Deposit
  async function handleDeposit() {
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }
      const r = await apiRequest("POST", "/api/wallet/deposit/initiate", {
        amountTon: amt,
      });

      await tonConnectUI.sendTransaction(r.txPayload);
      toast({ title: t("toast.confirmDeposit") });

      // Poll for confirmation
      const check = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", {
          code: r.code,
          minTon: amt,
        });
        if (status.status === "paid") {
          toast({
            title: t("toast.depositConfirmed"),
            description: `Tx: ${status.txHash}`,
          });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        } else {
          setTimeout(check, 5000);
        }
      };
      setTimeout(check, 5000);

      setDepositOpen(false);
    } catch (e: any) {
      toast({
        title: t("toast.depositFailed"),
        description: e?.message || "",
        variant: "destructive",
      });
    }
  }

  // ✅ Withdraw
  async function handleWithdraw() {
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0 || (balance?.balance || 0) < amt) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }
      await apiRequest("POST", "/api/payouts", { amount: amt });
      toast({
        title: t("wallet.withdrawRequest") || "Withdrawal request sent",
      });
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      setWithdrawOpen(false);
    } catch (e: any) {
      toast({
        title: "Withdraw failed",
        description: e?.message || "",
        variant: "destructive",
      });
    }
  }

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
                <h1 className="text-lg font-semibold text-foreground">
                  {t("profilePage.title")}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t("profilePage.subtitle")}
                </p>
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
            {/* 🟢 Profile info */}
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
                  <p className="text-muted-foreground">
                    @{telegramUser.username}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {telegramUser?.is_premium && (
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800"
                    >
                      ⭐
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {t("profilePage.memberSince")} {new Date().getFullYear()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 🟢 Wallet section */}
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
              <TonIcon className="w-5 h-5" />
              <span className="font-semibold">
                {balance?.balance ?? 0} {balance?.currency || "TON"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDepositOpen(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWithdrawOpen(true)}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => tonConnectUI.openModal()}
              >
                <Link2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.deposit")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("profilePage.depositPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleDeposit}>{t("wallet.deposit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.withdraw")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("profilePage.depositPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleWithdraw}>{t("wallet.withdraw")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}