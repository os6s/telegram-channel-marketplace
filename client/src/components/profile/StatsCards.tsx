import { Card, CardContent } from "@/components/ui/card";
import { Plus, DollarSign, Users } from "lucide-react";

export function StatsCards({
  activeCount, totalValue, totalSubs,
}: { activeCount: number; totalValue: string | number; totalSubs: number; }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card><CardContent className="p-4 text-center">
        <div className="flex items-center justify-center mb-2"><Plus className="w-5 h-5 text-telegram-500" /></div>
        <div className="text-2xl font-bold text-foreground">{activeCount}</div>
        <div className="text-sm text-muted-foreground">Active listings</div>
      </CardContent></Card>

      <Card><CardContent className="p-4 text-center">
        <div className="flex items-center justify-center mb-2"><DollarSign className="w-5 h-5 text-green-500" /></div>
        <div className="text-2xl font-bold text-foreground">{totalValue}</div>
        <div className="text-sm text-muted-foreground">Total value (TON)</div>
      </CardContent></Card>

      <Card><CardContent className="p-4 text-center">
        <div className="flex items-center justify-center mb-2"><Users className="w-5 h-5 text-blue-500" /></div>
        <div className="text-2xl font-bold text-foreground">
          {totalSubs > 1000 ? `${(totalSubs / 1000).toFixed(1)}K` : totalSubs}
        </div>
        <div className="text-sm text-muted-foreground">Total reach</div>
      </CardContent></Card>
    </div>
  );
}