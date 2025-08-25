import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";

export default function WalletTab() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  // === Queries ===
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  const { data: ledger = [], refetch: refetchLedger } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/ledger"),
  });

  // === Mutations ===
  const depositMutation = useMutation({
    mutationFn: async (amountTon: number) =>
      await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon }),
    onSuccess: (r, amt) => {
      const url = r.deeplinks?.tonkeeperWeb || r.deeplinks?.ton;
      if (url) {
        window.open(url, "_blank");
        toast({ title: t("wallet.confirmDeposit") || "Confirm deposit in your wallet" });

        const check = async () => {
          const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: r.code, minTon: amt });
          if (status.status === "paid") {
            toast({ title: t("wallet.depositConfirmed") || "Deposit confirmed ✅" });
            refetchBalance();
            refetchLedger();
          } else {
            setTimeout(check, 5000);
          }
        };
        setTimeout(check, 5000);
      }
    },
    onError: (e: any) =>
      toast({ title: t("wallet.depositFailed") || "Deposit failed", description: e?.message || "", variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ address, amount }: { address: string; amount: number }) =>
      await apiRequest("POST", "/api/payouts/request", { toAddress: address, amount }),
    onSuccess: () => {
      toast({ title: t("wallet.withdrawRequested") || "Withdrawal request sent ✅" });
      setWithdrawAmount("");
      setWithdrawAddress("");
      refetchLedger();
    },
    onError: (e: any) =>
      toast({ title: t("wallet.withdrawFailed") || "Withdraw failed", description: e?.message || "", variant: "destructive" }),
  });

  // === Handlers ===
  function handleDeposit() {
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) {
      toast({ title: t("wallet.invalidAmount") || "Invalid amount", variant: "destructive" });
      return;
    }
    depositMutation.mutate(amt);
  }

  function handleWithdraw() {
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0 || !withdrawAddress.trim()) {
      toast({ title: t("wallet.invalidWithdraw") || "Enter valid address and amount", variant: "destructive" });
      return;
    }
    withdrawMutation.mutate({ address: withdrawAddress.trim(), amount: amt });
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm">{t("wallet.balance") || "Balance"}</div>
          <div className="text-2xl font-semibold">
            {balance?.balance ?? 0} {balance?.currency || "TON"}
          </div>
        </CardContent>
      </Card>

      {/* Deposit */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">{t("wallet.deposit") || "Deposit"}</div>
          <div className="flex gap-2">
            <Input
              placeholder={t("wallet.depositPlaceholder") || "Enter amount TON"}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button onClick={handleDeposit} disabled={depositMutation.isPending}>
              {t("wallet.deposit") || "Deposit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Withdraw */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">{t("wallet.withdraw") || "Withdraw"}</div>
          <Input
            placeholder={t("wallet.withdrawAddress") || "Destination TON Address"}
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <Input
              placeholder={t("wallet.withdrawAmount") || "Enter amount TON"}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button onClick={handleWithdraw} disabled={withdrawMutation.isPending}>
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
    </div>
  );
}