// client/src/components/profile/DisputesTab.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DisputeActionMenu } from "./DisputeActionMenu";
import { useLanguage } from "@/contexts/language-context";

type Dispute = {
  id: string;
  status: "open" | "pending" | "resolved" | "cancelled";
  createdAt?: string;

  // product info
  listingId?: string;
  listingTitle?: string;
  listingPrice?: string;
  listingCurrency?: string;

  // payment info
  paymentAmount?: string;
  paymentCurrency?: string;

  // users
  buyerUsername?: string;
  sellerUsername?: string;

  // dispute info
  reason?: string;
  resolvedAt?: string;
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
          <CardContent className="p-4 flex flex-col gap-2">
            {/* Header: ID + Status */}
            <div className="flex items-center justify-between">
              <div className="font-medium">#{d.id}</div>
              <Badge className={statusStyle[d.status]}>
                {t(`disputes.status.${d.status}`) || d.status}
              </Badge>
            </div>

            {/* Product Info */}
            <div className="text-sm text-foreground">
              <strong>{t("disputes.product") || "Product"}:</strong>{" "}
              {d.listingTitle || t("disputes.listing") || "Listing"}{" "}
              {d.listingPrice && d.listingCurrency && (
                <span className="text-muted-foreground">
                  ({d.listingPrice} {d.listingCurrency})
                </span>
              )}
            </div>

            {/* Payment Info */}
            {d.paymentAmount && (
              <div className="text-sm text-foreground">
                <strong>{t("disputes.payment") || "Payment"}:</strong>{" "}
                {d.paymentAmount} {d.paymentCurrency || "TON"}
              </div>
            )}

            {/* Buyer & Seller */}
            <div className="text-sm text-foreground">
              <strong>{t("disputes.buyer") || "Buyer"}:</strong>{" "}
              @{d.buyerUsername || "—"}
            </div>
            <div className="text-sm text-foreground">
              <strong>{t("disputes.seller") || "Seller"}:</strong>{" "}
              @{d.sellerUsername || "—"}
            </div>

            {/* Reason */}
            {d.reason && (
              <div className="text-sm text-muted-foreground">
                <strong>{t("disputes.reason") || "Reason"}:</strong> {d.reason}
              </div>
            )}

            {/* Dates */}
            <div className="text-xs text-muted-foreground">
              {t("disputes.created") || "Created"}:{" "}
              {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
              {d.status === "resolved" && d.resolvedAt && (
                <> · {t("disputes.resolvedAt") || "Resolved"}:{" "}
                {new Date(d.resolvedAt).toLocaleString()}</>
              )}
            </div>

            {/* Actions */}
            <div className="mt-2 flex justify-end">
              <DisputeActionMenu
                onOpenChat={() => (window.location.href = `/disputes/${d.id}`)}
                onViewDetails={() =>
                  (window.location.href = `/disputes/${d.id}`)
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}