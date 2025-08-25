import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

type Tx = {
  id: string;
  direction: "in" | "out";
  amount: string;
  currency: string;
  refType: string;
  note?: string;
  createdAt?: string;
};

export function WalletTab() {
  const { data: balance } = useQuery({
    queryKey: ["/api/me/balance"],
    queryFn: () => apiRequest("GET", "/api/me/balance"),
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["/api/me/transactions"],
    queryFn: () => apiRequest("GET", "/api/me/transactions"),
  });

  return (
    <div className="space-y-4">
      {/* Balance */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold">Wallet Balance</h2>
          {Array.isArray(balance) ? (
            <div className="mt-2 space-y-1">
              {balance.map((b: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{b.currency}</span>
                  <span className="font-mono">{b.balance}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>—</div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b font-semibold">Transactions</div>
          <div className="divide-y">
            {txs.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">
                No transactions yet.
              </div>
            )}
            {txs.map((tx: Tx) => (
              <div key={tx.id} className="p-3 flex items-center gap-3">
                {tx.direction === "in" ? (
                  <ArrowDownCircle className="text-green-500 w-5 h-5" />
                ) : (
                  <ArrowUpCircle className="text-red-500 w-5 h-5" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {tx.note || tx.refType}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="text-sm font-mono">
                  {tx.direction === "in" ? "+" : "-"} {tx.amount}{" "}
                  {tx.currency}
                </div>
                <Badge variant="outline">{tx.refType}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}