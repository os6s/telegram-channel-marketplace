import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";

export default function WalletTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");

  const { data: balance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/ledger"),
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["/api/payouts/me"],
    queryFn: async () => await apiRequest("GET", "/api/payouts/me"),
  });

  // ====== Deposit ======
  const depositMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(depositAmount);
      if (!amt || amt <= 0) throw new Error("Invalid amount");
      const r = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });
      const url = r.deeplinks?.tonkeeperWeb || r.deeplinks?.ton;
      if (!url) throw new Error("No deposit link");
      window.open(url, "_blank");
      return r;
    },
    onSuccess: (r, vars) => {
      toast({ title: t("toast.confirmDeposit") || "Confirm deposit in your wallet" });
      // Poll status
      const amt = Number(depositAmount);
      const check = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", {
          code: r.code,
          minTon: amt,
        });
        if (status.status === "paid") {
          toast({ title: t("toast.depositConfirmed") || "Deposit confirmed ✅" });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
          qc.invalidateQueries({ queryKey: ["/api/wallet/ledger"] });
        } else {
          setTimeout(check, 5000);
        }
      };
      setTimeout(check, 5000);
    },
    onError: (e: any) => {
      toast({
        title: t("toast.depositFailed") || "Deposit failed",
        description: e?.message || "",
        variant: "destructive",
      });
    },
  });

  // ====== Payout ======
  const payoutMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(payoutAmount);
      if (!amt || amt <= 0) throw new Error("Invalid amount");
      if (!payoutAddress) throw new Error("Address required");
      return await apiRequest("POST", "/api/payouts", {
        amount: amt,
        toAddress: payoutAddress,
      });
    },
    onSuccess: () => {
      toast({ title: t("toast.success") || "Payout request submitted" });
      setPayoutAmount("");
      setPayoutAddress("");
      qc.invalidateQueries({ queryKey: ["/api/payouts/me"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet/ledger"] });
    },
    onError: (e: any) => {
      toast({
        title: t("toast.error") || "Error",
        description: e?.message || "Failed to request payout",
        variant: "destructive",
      });
    },
  });

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
        <CardContent className="p-4 space-y-2">
          <div className="font-semibold">{t("wallet.deposit") || "Deposit"}</div>
          <div className="flex gap-2">
            <Input
              placeholder={t("wallet.enterAmount") || "Enter amount"}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button
              onClick={() => depositMutation.mutate()}
              disabled={depositMutation.isPending}
            >
              {t("wallet.deposit") || "Deposit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Request Payout */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="font-semibold">{t("wallet.payout") || "Request Payout"}</div>
          <Input
            placeholder={t("wallet.enterAmount") || "Enter amount"}
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
          />
          <Input
            placeholder={t("wallet.enterAddress") || "Enter TON wallet address"}
            value={payoutAddress}
            onChange={(e) => setPayoutAddress(e.target.value)}
          />
          <Button
            onClick={() => payoutMutation.mutate()}
            disabled={payoutMutation.isPending}
          >
            {t("wallet.requestPayout") || "Request Payout"}
          </Button>
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

      {/* Payout Requests */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="font-semibold">{t("wallet.payouts") || "My Payout Requests"}</div>
          {payouts.length === 0 && (
            <div className="text-muted-foreground text-sm">
              {t("wallet.noPayouts") || "No payout requests yet."}
            </div>
          )}
          {payouts.map((p: any) => {
            let statusColor = "text-yellow-500"; // pending
            let statusIcon = "⏳";
            if (p.status === "completed") {
              statusColor = "text-green-600";
              statusIcon = "✅";
            } else if (p.status === "failed") {
              statusColor = "text-red-600";
              statusIcon = "❌";
            } else if (p.status === "processing") {
              statusColor = "text-blue-600";
              statusIcon = "🔄";
            }

            return (
              <div key={p.id} className="flex justify-between items-center border-b py-2">
                <div>
                  <div className="text-sm font-medium">
                    {p.amount} {p.currency}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.toAddress} • <span className={statusColor}>{statusIcon} {p.status}</span>
                  </div>
                </div>
                <div className="text-right text-xs opacity-70">
                  {new Date(p.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}