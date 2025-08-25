// client/src/components/profile/WalletTab.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { TonConnectUI, useTonConnectUI } from "@tonconnect/ui-react";

export default function WalletTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const { data: balance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/ledger"),
  });

  // TonConnect hook
  const [tonConnectUI] = useTonConnectUI();

  /** Deposit handler */
  async function handleDeposit() {
    try {
      const amt = Number(depositAmount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount") || "Invalid amount", variant: "destructive" });
        return;
      }

      // 1) نطلب من الباك تسجيل العملية pending
      const { txPayload } = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });

      // 2) نفتح واجهة TonConnect الرسمية
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 دقائق
        messages: [
          {
            address: txPayload.toAddress, // عنوان منصة الاستلام
            amount: String(Math.floor(amt * 1e9)), // بالـ nanotons
          },
        ],
      });

      // 3) نعرض تنبيه انتظار التأكيد
      toast({ title: t("toast.confirmDeposit") || "Confirm deposit in your wallet" });

      // 4) polling للتأكد من وصول التحويل
      const check = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: txPayload.code });
        if (status.status === "paid") {
          toast({ title: t("toast.depositConfirmed") || "Deposit confirmed ✅" });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
          qc.invalidateQueries({ queryKey: ["/api/wallet/ledger"] });
        } else {
          setTimeout(check, 5000);
        }
      };
      setTimeout(check, 5000);
    } catch (e: any) {
      if (e?.message?.includes("User reject")) {
        toast({ title: "❌ Cancelled", description: "You cancelled the transaction." });
      } else {
        toast({
          title: t("toast.depositFailed") || "Deposit failed",
          description: e?.message || "",
          variant: "destructive",
        });
      }
    }
  }

  /** Withdraw mutation */
  const withdrawMutation = useMutation({
    mutationFn: async () =>
      await apiRequest("POST", "/api/payouts", {
        amount: Number(withdrawAmount),
        toAddress: withdrawAddress,
      }),
    onSuccess: () => {
      toast({ title: t("toast.success") || "Payout request submitted" });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet/ledger"] });
    },
    onError: (e: any) => {
      toast({ title: t("toast.error") || "Withdraw failed", description: e?.message || "", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      {/* TonConnect UI Widget */}
      <TonConnectUI />

      {/* Balance + Deposit/Withdraw */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wallet.balance") || "Wallet Balance"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-2xl font-semibold">
            {balance?.balance ?? 0} {balance?.currency || "TON"}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={t("profilePage.depositPlaceholder") || "Enter amount"}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={handleDeposit} className="bg-green-500 hover:bg-green-600 text-white">
              {t("profilePage.deposit") || "Deposit via TON"}
            </Button>
            <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
              {t("wallet.withdraw") || "Withdraw"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">{t("wallet.transactions") || "Transactions"}</div>
          {ledger.length === 0 && (
            <div className="text-muted-foreground text-sm">
              {t("wallet.empty") || "No transactions yet."}
            </div>
          )}
          {ledger.map((tx: any) => (
            <div key={tx.id} className="flex justify-between items-center border-b py-2">
              <div>
                <div className="text-sm font-medium">
                  {tx.refType} {tx.direction === "in" ? "🟢" : "🔴"}
                </div>
                <div className="text-xs text-muted-foreground">{tx.note}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {tx.amount} {tx.currency}
                </div>
                <div className="text-xs opacity-70">
                  {new Date(tx.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.withdraw") || "Request Withdrawal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t("wallet.addressPlaceholder") || "Enter TON wallet address"}
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
            />
            <Input
              placeholder={t("wallet.amountPlaceholder") || "Enter amount"}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending}>
              {withdrawMutation.isPending ? "Submitting..." : t("wallet.withdraw")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}