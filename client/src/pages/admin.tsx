// client/src/pages/admin.tsx
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/* -------- Types aligned with backend -------- */
type AdminOrderStatus =
  | "held"
  | "awaiting_buyer_confirm"
  | "disputed"
  | "released"
  | "refunded"
  | "cancelled";

type AdminUserRef = { id: string; username?: string | null; name?: string | null };

type AdminOrder = {
  id: string;               // paymentId
  listingId: string;
  createdAt: string;
  amount: string;
  currency: "TON" | "USDT";
  status: AdminOrderStatus;
  buyer: AdminUserRef;
  seller: AdminUserRef;
  unlockAt?: string | null;
  disputeId?: string | null;
};

type AdminPayoutStatus = "queued" | "sent" | "confirmed" | "failed";
type AdminPayout = {
  id: string;
  paymentId: string;
  sellerId: string;
  toAddress: string;
  amount: string;
  status: AdminPayoutStatus;
  txHash?: string | null;
  createdAt: string;
  sentAt?: string | null;
  confirmedAt?: string | null;
  seller?: AdminUserRef;
};

type DisputeMsg = { id: string; senderId: string; content: string; createdAt: string };

/* -------- Helpers -------- */
function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function calcUnlockAt(o: AdminOrder) {
  return new Date(o.unlockAt || new Date(new Date(o.createdAt).getTime() + 24 * 3600_000).toISOString());
}

/* ============== Page ============== */
export default function AdminPage() {
  const { toast } = useToast();

  const [tab, setTab] = useState<"orders" | "payouts">("orders");

  // Orders state
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | AdminOrderStatus>("all");
  const [q, setQ] = useState("");

  // Payouts state
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  // Dispute chat
  const [openChat, setOpenChat] = useState(false);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  // Tick for timers
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---- Loaders
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdminOrder[];
      setOrders(data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load orders", variant: "destructive" });
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadPayouts = async () => {
    setLoadingPayouts(true);
    try {
      const res = await fetch("/api/admin/payouts");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdminPayout[];
      setPayouts(data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load payouts", variant: "destructive" });
    } finally {
      setLoadingPayouts(false);
    }
  };

  useEffect(() => { loadOrders(); loadPayouts(); }, []);

  // ---- Orders helpers/actions
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const buyerName = o.buyer.username || o.buyer.name || o.buyer.id;
        const sellerName = o.seller.username || o.seller.name || o.seller.id;
        const blob = `${o.id} ${o.listingId} ${buyerName} ${sellerName}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, statusFilter, q]);

  const onRelease = async (paymentId: string) => {
    try {
      await apiRequest("POST", `/api/admin/payments/${paymentId}/release`, {});
      toast({ title: "Released", description: `Order ${paymentId} funds released.` });
      loadOrders();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Release failed", variant: "destructive" });
    }
  };
  const onRefund = async (paymentId: string) => {
    try {
      await apiRequest("POST", `/api/admin/payments/${paymentId}/refund`, {});
      toast({ title: "Refunded", description: `Order ${paymentId} refunded.` });
      loadOrders();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Refund failed", variant: "destructive" });
    }
  };
  const onOpenChat = (o: AdminOrder) => { setSelected(o); setOpenChat(true); };
  const canRelease = (o: AdminOrder) => {
    if (o.status === "awaiting_buyer_confirm") return true;
    if (o.status !== "held") return false;
    return tick >= calcUnlockAt(o).getTime();
  };
  const statusBadgeOrder = (s: AdminOrderStatus) => {
    if (s === "held") return <Badge className="bg-amber-500 text-white">Held</Badge>;
    if (s === "disputed") return <Badge className="bg-red-600 text-white">Disputed</Badge>;
    if (s === "awaiting_buyer_confirm") return <Badge className="bg-blue-600 text-white">Awaiting confirm</Badge>;
    if (s === "released") return <Badge className="bg-emerald-600 text-white">Released</Badge>;
    if (s === "refunded") return <Badge className="bg-sky-600 text-white">Refunded</Badge>;
    if (s === "cancelled") return <Badge className="bg-zinc-500 text-white">Cancelled</Badge>;
    return <Badge className="bg-muted text-foreground">{s}</Badge>;
  };
  const timerBadge = (o: AdminOrder) => {
    if (o.status !== "held") return null;
    const ms = calcUnlockAt(o).getTime() - tick;
    if (ms <= 0) return <Badge className="bg-emerald-600 text-white">Ready</Badge>;
    return (
      <Badge className="bg-zinc-700 text-white dark:bg-zinc-600 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {formatRemaining(ms)}
      </Badge>
    );
  };

  // ---- Payouts actions
  const markPayoutSent = async (payoutId: string) => {
    try {
      await apiRequest("POST", `/api/admin/payouts/${payoutId}/sent`, {});
      toast({ title: "Marked as sent", description: `Payout ${payoutId} marked as sent.` });
      loadPayouts();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Mark sent failed", variant: "destructive" });
    }
  };
  const markPayoutConfirmed = async (payoutId: string) => {
    try {
      await apiRequest("POST", `/api/admin/payouts/${payoutId}/confirm`, {});
      toast({ title: "Confirmed", description: `Payout ${payoutId} confirmed.` });
      loadPayouts();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Confirm failed", variant: "destructive" });
    }
  };
  const statusBadgePayout = (s: AdminPayoutStatus) => {
    if (s === "queued") return <Badge className="bg-amber-500 text-white">Queued</Badge>;
    if (s === "sent") return <Badge className="bg-blue-600 text-white">Sent</Badge>;
    if (s === "confirmed") return <Badge className="bg-emerald-600 text-white">Confirmed</Badge>;
    if (s === "failed") return <Badge className="bg-red-600 text-white">Failed</Badge>;
    return <Badge className="bg-muted text-foreground">{s}</Badge>;
    };

  return (
    <div className="min-h-screen p-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "orders" ? "default" : "outline"} onClick={() => setTab("orders")}>
          Orders
        </Button>
        <Button variant={tab === "payouts" ? "default" : "outline"} onClick={() => setTab("payouts")}>
          Payouts
        </Button>
      </div>

      {tab === "orders" && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4 grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Status</div>
                <select
                  className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="held">Held</option>
                  <option value="disputed">Disputed</option>
                  <option value="awaiting_buyer_confirm">Awaiting confirm</option>
                  <option value="released">Released</option>
                  <option value="refunded">Refunded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs text-muted-foreground">Search (order / buyer / seller)</div>
                <input
                  className="w-full rounded-md border px-3 py-2 bg-background text-foreground"
                  placeholder="ord_1001, u12345…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Orders */}
          <div className="space-y-3">
            {loadingOrders && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loadingOrders && filteredOrders.map((o) => {
              const ready = canRelease(o);
              const buyer = o.buyer.username || o.buyer.name || o.buyer.id;
              const seller = o.seller.username || o.seller.name || o.seller.id;
              return (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Order #{o.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleString()} · {o.amount} {o.currency} · buyer:{buyer} · seller:{seller}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {timerBadge(o)}
                        {statusBadgeOrder(o.status)}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" disabled={!ready} onClick={() => onRelease(o.id)}>
                        Release
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!(o.status === "held" || o.status === "disputed")}
                        onClick={() => onRefund(o.id)}
                      >
                        Refund
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onOpenChat(o)}>
                        Dispute
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!loadingOrders && filteredOrders.length === 0 && <div className="text-sm text-muted-foreground">No results.</div>}
          </div>

          {/* Chat Dialog */}
          <Dialog.Root open={openChat} onOpenChange={setOpenChat}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/40" />
              <Dialog.Content className="fixed left-1/2 top-1/2 w-[96vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-0 shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="text-sm font-semibold">Dispute chat · #{selected?.id}</div>
                  <Button variant="ghost" size="icon" onClick={() => setOpenChat(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {selected && <RealDisputeChat paymentId={selected.id} />}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}

      {tab === "payouts" && (
        <>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Payouts</div>
              <Button variant="outline" size="sm" onClick={loadPayouts}>Refresh</Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {loadingPayouts && <div className="text-sm text-muted-foreground">Loading…</div>}
            {!loadingPayouts && payouts.map((p) => {
              const sellerName = p.seller?.username || p.seller?.name || p.sellerId;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Payout #{p.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleString()} · {p.amount} TON · seller:{sellerName} · addr:{p.toAddress}
                          {p.txHash ? ` · tx:${p.txHash}` : ""}
                        </div>
                      </div>
                      {statusBadgePayout(p.status)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!(p.status === "queued" || p.status === "failed")}
                        onClick={() => markPayoutSent(p.id)}
                      >
                        Mark as Sent
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!(p.status === "sent")}
                        onClick={() => markPayoutConfirmed(p.id)}
                      >
                        Mark as Confirmed
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!loadingPayouts && payouts.length === 0 && (
              <div className="text-sm text-muted-foreground">No payouts.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== RealDisputeChat ===== */
function RealDisputeChat({ paymentId }: { paymentId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<DisputeMsg[]>([]);
  const [text, setText] = useState("");
  const [disputeId, setDisputeId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const dRes = await fetch(`/api/disputes/by-payment/${paymentId}`);
      if (!dRes.ok) throw new Error(await dRes.text());
      const d = await dRes.json();
      setDisputeId(d.id);

      const r = await fetch(`/api/disputes/${d.id}/messages`);
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as DisputeMsg[];
      setMsgs(data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load dispute", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [paymentId]);

  const send = async () => {
    if (!text.trim() || !disputeId) return;
    try {
      await apiRequest("POST", `/api/disputes/${disputeId}/messages`, { content: text });
      setText("");
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Send failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="h-72 overflow-auto rounded border p-2">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && msgs.map((m) => (
          <div key={m.id} className="text-sm mb-3">
            <div className="opacity-60 text-xs">{new Date(m.createdAt).toLocaleString()}</div>
            <div>{m.content}</div>
          </div>
        ))}
        {!loading && msgs.length === 0 && (
          <div className="text-sm text-muted-foreground">No messages.</div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 bg-background text-foreground"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة…"
        />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}