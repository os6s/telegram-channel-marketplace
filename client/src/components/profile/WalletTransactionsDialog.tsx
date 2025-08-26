// client/src/components/profile/WalletTransactionsDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletTransactionsDialog({ open, onOpenChange }: Props) {
  const { t } = useLanguage();

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ["/api/wallet/ledger"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/wallet/ledger");
      return Array.isArray(r)
        ? r
            .sort(
              (a: any, b: any) =>
                +new Date(b.createdAt) - +new Date(a.createdAt)
            )
            .slice(0, 10)
        : [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>
            {t("wallet.transactionsTitle") || "Wallet Transactions"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("common.loading") || "Loading…"}
          </div>
        ) : ledger.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {t("wallet.empty") || "No transactions yet."}
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {ledger.map((tx: any) => (
              <div
                key={tx.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <div className="text-sm font-medium">
                    {tx.refType} {tx.direction === "in" ? "🟢" : "🔴"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tx.note}
                  </div>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}