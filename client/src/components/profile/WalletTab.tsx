// client/src/components/profile/WalletTab.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";

export default function WalletTab() {
  const { t } = useLanguage();

  const { data: balance } = useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/balance"),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => await apiRequest("GET", "/api/wallet/ledger"),
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