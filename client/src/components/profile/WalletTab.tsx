// client/src/components/profile/WalletTab.tsx
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { useTonWallet, useTonConnectUI } from "@tonconnect/ui-react";
import { Plus, Minus } from "lucide-react";

export default function WalletTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // ✅ رصيد المحفظة
  const { data: balance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  // ✅ تحديث عنوان المحفظة عند الربط أو إلغاء الربط
  useEffect(() => {
    async function syncWallet() {
      try {
        const address = wallet?.account.address || "";
        if (address) {
          await apiRequest("POST", "/api/wallet/address", { walletAddress: address });
          toast({ title: "Wallet linked", description: `${address.slice(0, 6)}…${address.slice(-4)}` });
        } else {
          await apiRequest("DELETE", "/api/wallet/address");
          toast({ title: "Wallet unlinked", description: "Disconnected from Ton wallet" });
        }
        qc.invalidateQueries({ queryKey: ["/api/wallet/address"] });
      } catch (e: any) {
        toast({ title: "Failed to sync wallet", description: e?.message || "", variant: "destructive" });
      }
    }
    syncWallet();
  }, [wallet?.account.address]);

  /** ✅ إيداع */
  async function handleDeposit() {
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount") || "Invalid amount", variant: "destructive" });
        return;
      }
      const r = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });

      if (wallet) {
        await tonConnectUI.sendTransaction(r.txPayload);
        toast({ title: t("toast.confirmDeposit") || "Confirm deposit in your wallet…" });
      }

      const check = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: r.code, minTon: amt });
        if (status.status === "paid") {
          toast({ title: t("toast.depositConfirmed") || "Deposit confirmed ✅" });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        } else {
          setTimeout(check, 5000);
        }
      };
      setTimeout(check, 5000);
      setDepositOpen(false);
      setAmount("");
    } catch (e: any) {
      toast({ title: t("toast.depositFailed") || "Deposit failed", description: e?.message || "", variant: "destructive" });
    }
  }

  /** ✅ سحب */
  async function handleWithdraw() {
    try {
      await apiRequest("POST", "/api/payouts", {
        amount: Number(amount),
        toAddress: withdrawAddress,
      });
      toast({ title: "Withdrawal request submitted" });
      setWithdrawOpen(false);
      setAmount("");
      setWithdrawAddress("");
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
    } catch (e: any) {
      toast({ title: "Withdraw failed", description: e?.message || "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Widget */}
      <Card className="flex items-center justify-between p-4">
        {/* شعار TON */}
        <img src="/ton-logo.svg" alt="TON" className="w-8 h-8 object-contain" />

        {/* الرصيد */}
        <div className="text-xl font-bold">
          {balance?.balance ?? 0} {balance?.currency || "TON"}
        </div>

        {/* أزرار + و - */}
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={() => setDepositOpen(true)}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => setWithdrawOpen(true)}>
            <Minus className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* زر ربط/إلغاء ربط المحفظة */}
      <Button
        className="w-full"
        variant={wallet ? "secondary" : "default"}
        onClick={() => {
          if (wallet) {
            tonConnectUI.disconnect(); // إلغاء الربط
          } else {
            tonConnectUI.connectWallet(); // TonConnect
          }
        }}
      >
        {wallet ? "Unlink Wallet" : t("wallet.connect") || "Connect Wallet"}
      </Button>

      {/* Dialog الإيداع */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profilePage.deposit") || "Deposit"}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("profilePage.depositPlaceholder") || "Enter amount"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleDeposit}>Confirm Deposit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog السحب */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.withdraw") || "Withdraw"}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter TON wallet address"
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
          />
          <Input
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleWithdraw}>{t("wallet.withdraw") || "Withdraw"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}