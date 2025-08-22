// client/src/components/admin-controls.tsx
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Shield, Crown, Wallet, RotateCcw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnyListing } from "@/store/listings";

export type PaymentStatus = "held" | "released" | "refunded" | "disputed";
export interface EscrowPayment {
  id: string;
  amount: number | string;
  currency: string;
  status: PaymentStatus;
  buyerId: string;
  sellerId: string;
  listingId?: string | null;
  createdAt?: string;
}

interface AdminControlsProps {
  channel: AnyListing & { sellerUsername?: string | null };
  currentUser?: { username?: string | null | undefined };
  payment?: EscrowPayment | null;
}

export function AdminControls({ channel, currentUser, payment }: AdminControlsProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = (currentUser?.username || "").toLowerCase() === "os6s7";
  if (!isAdmin) return null;

  const statusBadge = useMemo(() => {
    const s = payment?.status;
    if (!s) return { label: "No Payment", cls: "bg-muted text-foreground" };
    if (s === "held") return { label: "Held", cls: "bg-amber-500 text-white" };
    if (s === "released") return { label: "Released", cls: "bg-emerald-600 text-white" };
    if (s === "refunded") return { label: "Refunded", cls: "bg-sky-600 text-white" };
    return { label: "Disputed", cls: "bg-red-600 text-white" };
  }, [payment?.status]);

  const releaseMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await apiRequest("POST", `/api/admin/payments/${paymentId}/release`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Funds Released", description: "Amount sent to seller successfully." });
    },
    onError: (e: any) => {
      toast({ title: "Release Failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await apiRequest("POST", `/api/admin/payments/${paymentId}/refund`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Refund Issued", description: "Amount returned to buyer." });
    },
    onError: (e: any) => {
      toast({ title: "Refund Failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (listingId: string) => {
      setIsDeleting(true);
      await apiRequest("DELETE", `/api/listings/${listingId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "Listing Deleted", description: `Removed “${channel.title || channel.username || channel.id}”.` });
      setIsDeleting(false);
    },
    onError: (e: any) => {
      toast({ title: "Deletion Failed", description: e?.message || "Try again.", variant: "destructive" });
      setIsDeleting(false);
    },
  });

  const canAction = !!payment && payment.status === "held";
  const isBusy = releaseMutation.isPending || refundMutation.isPending || isDeleting;

  const paymentAmount = payment ? Number(payment.amount) : NaN;

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 mt-3">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <Crown className="h-4 w-4" />
          Admin Controls
          <Badge variant="destructive" className="text-xs">@Os6s7 Only</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Escrow / Payment panel */}
        <div className="rounded-lg border p-3 bg-background/60">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                Payment{payment?.id ? ` #${payment.id.slice(0, 6)}…` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {payment
                  ? `${payment.amount} ${payment.currency} • buyer:${payment.buyerId} • seller:${payment.sellerId}`
                  : "No payment attached"}
              </div>
            </div>
            <Badge className={statusBadge.cls}>{statusBadge.label}</Badge>
          </div>

          <div className="mt-3 flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-2" disabled={!canAction || isBusy}>
                  <CheckCircle2 className="h-4 w-4" />
                  Release to Seller
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Release funds to seller?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the order as completed and release the funds to the seller.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => payment && releaseMutation.mutate(payment.id)}
                  >
                    Confirm Release
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2" disabled={!canAction || isBusy}>
                  <RotateCcw className="h-4 w-4" />
                  Refund to Buyer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refund payment to buyer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the order as refunded and return the funds to the buyer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-sky-600 text-white hover:bg-sky-700"
                    onClick={() => payment && refundMutation.mutate(payment.id)}
                  >
                    Confirm Refund
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" size="sm" className="ml-auto gap-2" disabled>
              <Wallet className="h-4 w-4" />
              {payment ? `${isNaN(paymentAmount) ? payment.amount : paymentAmount.toLocaleString()} ${payment.currency}` : "—"}
            </Button>
          </div>
        </div>

        {/* Listing row + delete */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
          <div>
            <p className="font-medium text-sm">
              Listing: {channel.title || channel.username || channel.id}
            </p>
            {channel.username ? (
              <p className="text-xs text-muted-foreground">@{channel.username}</p>
            ) : null}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-3 w-3" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Listing</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently delete “{channel.title || channel.username || channel.id}”? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteChannelMutation.mutate(channel.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="text-xs text-muted-foreground bg-background/30 p-2 rounded">
          <Shield className="h-3 w-3 inline mr-1" />
          Admin privilege: Escrow control & full listing management
        </div>
      </CardContent>
    </Card>
  );
}