// client/src/components/profile/DisputesTab.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisputeActionMenu } from "./DisputeActionMenu";

type Dispute = {
  id: string;
  orderId?: string;
  listingTitle?: string;
  status: "open"|"pending"|"resolved"|"cancelled";
  createdAt?: string;
};

export function DisputesTab({
  disputes = [],
  isLoading,
}: {
  disputes?: Dispute[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading disputes…</CardContent></Card>
    );
  }
  if (!disputes.length) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No disputes.</CardContent></Card>
    );
  }
  return (
    <div className="space-y-3">
      {disputes.map((d) => (
        <Card key={d.id}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">#{d.id} · {d.listingTitle || "Listing"}</div>
                <Badge variant="secondary">{d.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Order: {d.orderId || "—"} · {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
              </div>
            </div>
            <DisputeActionMenu
              onOpenChat={() => (window.location.href = `/disputes/${d.id}`)}
              onViewDetails={() => (window.location.href = `/disputes/${d.id}`)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}