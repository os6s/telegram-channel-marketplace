// client/src/components/profile/DisputesTab.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DisputeActionMenu } from "./DisputeActionMenu";
import { useLanguage } from "@/contexts/language-context";

type Dispute = {
  id: string;
  orderId?: string;
  listingTitle?: string;
  status: "open" | "pending" | "resolved" | "cancelled";
  createdAt?: string;
};

const statusStyle: Record<Dispute["status"], string> = {
  open: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-200 text-gray-700",
};

export function DisputesTab({
  disputes = [],
  isLoading,
}: {
  disputes?: Dispute[];
  isLoading?: boolean;
}) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!disputes.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          {t("disputes.empty") || "No disputes."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {disputes.map((d) => (
        <Card key={d.id}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">
                  #{d.id} · {d.listingTitle || t("disputes.listing") || "Listing"}
                </div>
                <Badge className={statusStyle[d.status]}>
                  {t(`disputes.status.${d.status}`) || d.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {t("disputes.order") || "Order"}: {d.orderId || "—"} ·{" "}
                {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
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