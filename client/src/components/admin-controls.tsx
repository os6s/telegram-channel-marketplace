// client/src/components/admin-controls.tsx
import { useState, useMemo } from "react";
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
import { type Channel } from "@shared/schema";

// نموذج مبسّط لدفعة الضمان (Escrow)
export type PaymentStatus = "held" | "released" | "refunded" | "disputed";
export interface EscrowPayment {
  id: string;
  amount: number;
  currency: "TON" | "USDT" | string;
  status: PaymentStatus;
  buyerId: string;
  sellerId: string;
  listingId?: string;
  createdAt?: string;
}

interface AdminControlsProps {
  channel: Channel;
  currentUser?: { username?: string };
  payment?: EscrowPayment | null; // لو موجود، نعرض أدوات الدفع
}

export function AdminControls({ channel, currentUser, payment }: AdminControlsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // فقط الأدمن
  const isAdmin = currentUser?.username === "Os6s7";
  if (!isAdmin) return null;

  // ألوان حالة الدفع
  const statusBadge = useMemo(() => {
    const s = payment?.status;
    if (!s) return { label: "No Payment", cls: "bg-muted text-foreground" };
    if (s === "held") return { label: "Held", cls: "bg-amber-500 text-white" };
    if (s === "released") return { label: "Released", cls: "bg-emerald-600 text-white" };
    if (s === "refunded") return { label: "Refunded", cls: "bg-sky-600 text-white" };
    return { label: "Disputed", cls: "bg-red-600 text-white" };
  }, [payment?.status]);

  // ===== Mutations (بدّل fetch بروابطك لما تجهز API) =====
  const releaseMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // مثال API:
      // const r = await fetch(`/api/payments/${paymentId}/release`, { method: "POST" });
      // if (!r.ok) throw new Error("Release failed");
      await new Promise((res) => setTimeout(res, 600)); // محاكاة
      return paymentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Funds Released", description: "Amount sent to seller successfully." });
    },
    onError: (e: any) => {
      toast({ title: "Release Failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // مثال API:
      // const r = await fetch(`/api/payments/${paymentId}/refund`, { method: "POST" });
      // if (!r.ok) throw new Error("Refund failed");
      await new Promise((res) => setTimeout(res, 600)); // محاكاة
      return paymentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Refund Issued", description: "Amount returned to buyer." });
    },
    onError: (e: any) => {
      toast({ title: "Refund Failed", description: e?.message || "Try again.", variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      setIsDeleting(true);
      // const r = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
      // if (!r.ok) throw new Error("Failed to delete channel");
      await new Promise((res) => setTimeout(res, 800)); // محاكاة
      return channelId;
    },
    onSuccess: (deletedChannelId) => {
      queryClient.setQueryData(['/api/channels'], (old: Channel[] | undefined) =>
        old?.filter((ch) => ch.id !== deletedChannelId) || []
      );
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      toast({ title: "Channel Deleted", description: `Removed "${channel.name}".` });
      setIsDeleting(false);
    },
    onError: (e: any) => {
      toast({ title: "Deletion Failed", description: e?.message || "Try again.", variant: "destructive" });
      setIsDeleting(false);
    },
  });

  const canAction = payment && payment.status === "held";
  const isBusy = releaseMutation.isPending || refundMutation.isPending || isDeleting;

  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
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
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!canAction || isBusy}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Release to Seller
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Release funds to seller?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will transfer the held amount to the seller. Action is irreversible.
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
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={!canAction || isBusy}
                >
                  <RotateCcw className="h-4 w-4" />
                  Refund to Buyer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refund payment to buyer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The held amount will be returned to the buyer. Action is irreversible.
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

            {/* فقط للعرض: زر يعرض أن الرصيد معلق */}
            <Button variant="outline" size="sm" className="ml-auto gap-2" disabled>
              <Wallet className="h-4 w-4" />
              {payment ? `${payment.amount} ${payment.currency}` : "—"}
            </Button>
          </div>
        </div>

        {/* Channel row + delete */}
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
          <div>
            <p className="font-medium text-sm">Channel: {channel.name}</p>
            <p className="text-xs text-muted-foreground">@{channel.username}</p>
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
                <AlertDialogTitle>Delete Channel Listing</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently delete “{channel.name}”? This cannot be undone.
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
          Admin privilege: Escrow control & full channel management
        </div>
      </CardContent>
    </Card>
  );
}