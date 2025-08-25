import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Send, CheckCircle2, XCircle, Scale } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { telegramWebApp } from "@/lib/telegram";

type Dispute = {
  id: string;
  orderId?: string;                 // == paymentId
  listingTitle?: string;
  status: "open" | "pending" | "resolved" | "cancelled";
  createdAt?: string;
  buyer?: { username?: string|null };
  seller?: { username?: string|null };
  lastUpdateAt?: string;
};

type DisputeMessage = {
  id: string;
  disputeId: string;
  sender?: { username?: string|null };
  text: string;
  createdAt?: string;
};

const statusColor: Record<Dispute["status"], string> = {
  open: "bg-amber-500 text-white",
  pending: "bg-blue-500 text-white",
  resolved: "bg-emerald-600 text-white",
  cancelled: "bg-gray-400 text-white",
};

export default function DisputeDetailsPage({ params }: { params: { id: string } }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const id = params?.id;
  const [msg, setMsg] = useState("");

  const meUsername = telegramWebApp?.user?.username || null;

  // ===== Fetch dispute =====
  const { data: dispute, isLoading: dLoading } = useQuery({
    enabled: !!id,
    queryKey: ["/api/disputes", id],
    queryFn: async () => (await apiRequest("GET", `/api/disputes/${id}`)) as Dispute,
    refetchOnWindowFocus: true,
  });

  // ===== Fetch messages =====
  const { data: messages = [], isLoading: mLoading } = useQuery({
    enabled: !!id,
    queryKey: ["/api/disputes", id, "messages"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/disputes/${id}/messages`);
      return Array.isArray(r) ? (r as DisputeMessage[]) : [];
    },
    refetchInterval: 5000,
  });

  // ===== Send message =====
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiRequest("POST", `/api/disputes/${id}/messages`, { text });
    },
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["/api/disputes", id, "messages"] });
    },
    onError: (e: any) => {
      toast({ title: t("toast.error"), description: e?.message || "Failed to send", variant: "destructive" });
    },
  });

  // ===== Buyer confirm receipt =====
  const confirmReceipt = useMutation({
    mutationFn: async () => await apiRequest("POST", `/api/disputes/${id}/resolve`, { action: "seller_wins" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/disputes", id] });
      toast({ title: t("disputePage.confirmReceipt") });
    },
    onError: (e: any) => {
      toast({ title: t("toast.error"), description: e?.message || "Failed", variant: "destructive" });
    },
  });

  // ===== Admin resolve (for seller / buyer) =====
  const resolveSeller = useMutation({
    mutationFn: async () => await apiRequest("POST", `/api/disputes/${id}/resolve`, { action: "seller_wins" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/disputes", id] });
      toast({ title: t("disputePage.resolveSeller") });
    },
  });
  const resolveBuyer = useMutation({
    mutationFn: async () => await apiRequest("POST", `/api/disputes/${id}/resolve`, { action: "buyer_wins" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/disputes", id] });
      toast({ title: t("disputePage.resolveBuyer") });
    },
  });

  // ===== Admin cancel =====
  const cancelMutation = useMutation({
    mutationFn: async () => await apiRequest("POST", `/api/disputes/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/disputes", id] });
      toast({ title: t("disputePage.cancel") });
    },
  });

  // ===== User role checks =====
  const isBuyer = useMemo(() => {
    const me = meUsername?.toLowerCase() || "";
    const by = dispute?.buyer?.username?.toLowerCase() || "";
    return !!me && !!by && me === by;
  }, [meUsername, dispute?.buyer?.username]);

  const isAdmin = useMemo(() => {
    const adminIds = (process.env.ADMIN_TG_IDS || "").split(",").map(x => x.trim().toLowerCase());
    return meUsername && adminIds.includes(meUsername.toLowerCase());
  }, [meUsername]);

  const headerBadge = useMemo(() => {
    const s = (dispute?.status || "open") as Dispute["status"];
    return <Badge className={statusColor[s]}>{s}</Badge>;
  }, [dispute?.status]);

  useEffect(() => { try { telegramWebApp?.expand?.(); } catch {} }, []);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">Dispute #{id?.slice(0,6)}…</h1>
                {headerBadge}
              </div>
              <p className="text-xs text-muted-foreground">
                {dispute?.listingTitle || "Listing"} · Order {dispute?.orderId || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Buyer: Confirm receipt */}
            {isBuyer && dispute?.status === "open" && (
              <Button
                size="sm"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={confirmReceipt.isPending}
                onClick={() => confirmReceipt.mutate()}
              >
                <CheckCircle2 className="w-4 h-4" />
                {t("disputePage.confirmReceipt")}
              </Button>
            )}

            {/* Admin actions */}
            {isAdmin && dispute?.status === "open" && (
              <>
                <Button
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={resolveSeller.isPending}
                  onClick={() => resolveSeller.mutate()}
                >
                  <Scale className="w-4 h-4" /> {t("disputePage.resolveSeller")}
                </Button>
                <Button
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={resolveBuyer.isPending}
                  onClick={() => resolveBuyer.mutate()}
                >
                  <Scale className="w-4 h-4" /> {t("disputePage.resolveBuyer")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  <XCircle className="w-4 h-4" /> {t("disputePage.cancel")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Details + Messages */}
      <div className="px-4 py-6 space-y-4">
        <Card>
          <CardContent className="p-4 text-sm">
            {dLoading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : !dispute ? (
              <div className="text-destructive">Dispute not found.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-muted-foreground">Listing</div><div className="font-medium">{dispute.listingTitle || "—"}</div></div>
                <div><div className="text-muted-foreground">Order</div><div className="font-medium">{dispute.orderId || "—"}</div></div>
                <div><div className="text-muted-foreground">Buyer</div><div className="font-medium">@{dispute.buyer?.username || "—"}</div></div>
                <div><div className="text-muted-foreground">Seller</div><div className="font-medium">@{dispute.seller?.username || "—"}</div></div>
                <div><div className="text-muted-foreground">Created</div><div className="font-medium">{dispute.createdAt ? new Date(dispute.createdAt).toLocaleString() : "—"}</div></div>
                <div><div className="text-muted-foreground">Last update</div><div className="font-medium">{dispute.lastUpdateAt ? new Date(dispute.lastUpdateAt).toLocaleString() : "—"}</div></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b flex items-center gap-2">
              <div className="text-sm font-semibold">Dispute Chat</div>
            </div>

            <div className="max-h-[50vh] overflow-auto p-3 space-y-3">
              {mLoading ? (
                <div className="text-sm text-muted-foreground">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages yet.</div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender?.username && meUsername && m.sender.username.toLowerCase() === meUsername.toLowerCase();
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`rounded-lg px-3 py-2 text-sm ${mine ? "bg-telegram-500 text-white" : "bg-muted"}`}>
                        <div className="opacity-80 text-[11px] mb-0.5">
                          @{m.sender?.username || "user"} · {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ""}
                        </div>
                        <div>{m.text}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t flex items-center gap-2">
              <Input
                placeholder="Type a message…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter" && msg.trim() && !sendMutation.isPending) handleSend(); }}
              />
              <Button onClick={handleSend} disabled={!msg.trim() || sendMutation.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  function handleSend() {
    const text = msg.trim();
    if (!text) return;
    sendMutation.mutate(text);
  }
}