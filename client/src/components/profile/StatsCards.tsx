// client/src/components/profile/StatsCards.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Plus, DollarSign, List } from "lucide-react";
import { WalletTransactionsDialog } from "./WalletTransactionsDialog";
import { useState } from "react";

export function StatsCards({
  activeCount,
  totalValue,
}: {
  activeCount: number;
  totalValue: string | number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {/* Active Listings */}
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Plus className="w-5 h-5 text-telegram-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{activeCount}</div>
            <div className="text-sm text-muted-foreground">Active listings</div>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">{totalValue}</div>
            <div className="text-sm text-muted-foreground">Total value (TON)</div>
          </CardContent>
        </Card>

        {/* Wallet Transactions */}
        <Card
          className="cursor-pointer hover:shadow-md transition"
          onClick={() => setOpen(true)}
        >
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <List className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">Logs</div>
            <div className="text-sm text-muted-foreground">Wallet transactions</div>
          </CardContent>
        </Card>
      </div>

      <WalletTransactionsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}