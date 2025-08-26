// client/src/components/profile/DisputeActionMenu.tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  MessageSquare,
  Eye,
  CheckCircle,
  XCircle,
  Scale,
} from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";

export function DisputeActionMenu({
  onOpenChat,
  onViewDetails,
  isAdmin = false, // ✅ optional: pass true if admin
  onResolveSeller,
  onRefundBuyer,
  onResolveDispute,
}: {
  onOpenChat: () => void;
  onViewDetails: () => void;
  isAdmin?: boolean;
  onResolveSeller?: () => void;
  onRefundBuyer?: () => void;
  onResolveDispute?: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();

  // ✅ Simple confirm wrapper
  function confirmAndRun(action: () => void, message: string) {
    if (window.confirm(message)) {
      action();
      toast({ title: message, variant: "default" });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("disputes.actions.menuLabel") || "Dispute actions"}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {/* 🟢 User actions */}
        <DropdownMenuItem
          onClick={onOpenChat}
          className="flex items-center gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          {t("disputes.actions.openChat") || "Open chat"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onViewDetails}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          {t("disputes.actions.viewDetails") || "View details"}
        </DropdownMenuItem>

        {/* 🟡 Admin-only actions */}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                onResolveSeller &&
                confirmAndRun(
                  onResolveSeller,
                  t("disputes.actions.resolveSellerConfirm") ||
                    "Approve seller & resolve dispute?"
                )
              }
              className="flex items-center gap-2 text-emerald-700"
            >
              <CheckCircle className="h-4 w-4" />
              {t("disputes.actions.resolveSeller") || "Resolve for Seller"}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                onRefundBuyer &&
                confirmAndRun(
                  onRefundBuyer,
                  t("disputes.actions.refundBuyerConfirm") ||
                    "Refund buyer & close dispute?"
                )
              }
              className="flex items-center gap-2 text-red-700"
            >
              <XCircle className="h-4 w-4" />
              {t("disputes.actions.refundBuyer") || "Refund Buyer"}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                onResolveDispute &&
                confirmAndRun(
                  onResolveDispute,
                  t("disputes.actions.resolveDisputeConfirm") ||
                    "Mark dispute as resolved?"
                )
              }
              className="flex items-center gap-2 text-amber-700"
            >
              <Scale className="h-4 w-4" />
              {t("disputes.actions.resolveDispute") || "Resolve Dispute"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}