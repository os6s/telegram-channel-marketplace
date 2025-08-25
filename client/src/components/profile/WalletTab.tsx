import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

export default function WalletTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  // ✅ حفظ العنوان في الباك إذا ربط المستخدم المحفظة
  useEffect(() => {
    async function saveWallet() {
      try {
        const address = wallet?.account.address || "";
        await apiRequest("POST", "/api/me/wallet", { address });
        toast({
          title: "Wallet updated",
          description: address ? `Connected: ${address.slice(0, 6)}…${address.slice(-4)}` : "Disconnected",
        });
      } catch (e: any) {
        toast({ title: "Failed to save wallet", description: e?.message || "", variant: "destructive" });
      }
    }
    saveWallet();
  }, [wallet?.account.address]);

  const { data: balance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/ledger"),
  });

  /** ✅ Deposit */
  async function handleDeposit() {
    try {
      const amt = Number(depositAmount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount") || "Invalid amount", variant: "destructive" });
        return;
      }
      const r = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });

      if (wallet) {
        await tonConnectUI.sendTransaction(r.txPayload);
        toast({ title: "Please confirm deposit in your wallet…" });
      } else {
        window.open(r.fallbackDeeplinks?.tonkeeper, "_blank");
      }

      const check = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: r.code, minTon: amt });
        if (status.status === "paid") {
          toast({ title: "Deposit confirmed ✅", description: `Tx: ${status.txHash}` });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
          qc.invalidateQueries({ queryKey: ["/api/wallet/ledger"] });
        } else {
          setTimeout(check, 5000);
        }
      };
      setTimeout(check, 5000);
    } catch (e: any) {
      toast({ title: "Deposit failed", description: e?.message || "", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Wallet Connect */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wallet.balance") || "Wallet Balance"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-2xl font-semibold">
            {balance?.balance ?? 0} {balance?.currency || "TON"}
          </div>

          <div className="flex flex-col gap-2">
            <TonConnectButton />

            {wallet && (
              <div className="text-xs text-muted-foreground">
                Connected: {wallet.account.address.slice(0, 6)}…{wallet.account.address.slice(-4)}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder={t("profilePage.depositPlaceholder") || "Enter amount"}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button onClick={handleDeposit}>{t("profilePage.deposit") || "Deposit"}</Button>
              <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>
                {t("wallet.withdraw") || "Withdraw"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">{t("wallet.transactions") || "Transactions"}</div>
          {ledger.length === 0 && (
            <div className="text-muted-foreground text-sm">{t("wallet.empty") || "No transactions yet."}</div>
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
                <div className="font-semibold">{tx.amount} {tx.currency}</div>
                <div className="text-xs opacity-70">{new Date(tx.createdAt).toLocaleString()}</div>
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
            <Input placeholder="Enter TON wallet address" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} />
            <Input placeholder="Enter amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                await apiRequest("POST", "/api/payouts", {
                  amount: Number(withdrawAmount),
                  toAddress: withdrawAddress,
                });
                toast({ title: "Payout request submitted" });
                setWithdrawOpen(false);
                qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
              }}
            >
              {t("wallet.withdraw")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}