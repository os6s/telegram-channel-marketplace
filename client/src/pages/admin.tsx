// client/src/pages/admin.tsx
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MockChat } from "@/components/chat/mock-chat";
import { apiRequest } from "@/lib/queryClient";

/* -------- Types aligned with backend -------- */
type AdminOrderStatus =
  | "held"                    // الأموال محتجزة بالإسكرو
  | "awaiting_buyer_confirm"  // ننتظر تأكيد المشتري
  | "disputed"                // نزاع مفتوح
  | "released"                // أُفرجت للبائع
  | "refunded"                // رُدّت للمشتري
  | "cancelled";              // أُلغيت

type AdminOrder = {
  id: string;               // paymentId أو orderId حسب الباك
  listingId: string;
  createdAt: string;
  amount: string;
  currency: "TON" | "USDT";
  status: AdminOrderStatus;
  buyer: { id: string; username?: string | null; name?: string | null };
  seller: { id: string; username?: string | null; name?: string | null };
  // اختياري:
  unlockAt?: string | null; // إن كان في تايمر (24h)
  thread?: { role: "buyer"|"seller"|"admin"; text: string; at: string; author?: {id:string;name?:string} }[];
};

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
  // إن لم يرسل الباك unlockAt نحتسب 24h افتراضيًا من createdAt
  return new Date(o.unlockAt || new Date(new Date(o.createdAt).getTime() + 24 * 3600_000).toISOString());
}

/* ============== Page ============== */
export default function AdminPage() {
  const { toast } = useToast();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | AdminOrderStatus>("all");
  const [q, setQ] = useState("");
  const [openChat, setOpenChat] = useState(false);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // fetch orders from backend
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdminOrder[];
      setOrders(data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
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
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Release failed", variant: "destructive" });
    }
  };

  const onRefund = async (paymentId: string) => {
    try {
      await apiRequest("POST", `/api/admin/payments/${paymentId}/refund`, {});
      toast({ title: "Refunded", description: `Order ${paymentId} refunded.` });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Refund failed", variant: "destructive" });
    }
  };

  const onOpenChat = (o: AdminOrder) => {
    // مؤقتًا نبقي MockChat لحد ما نربط /api/disputes/:id/messages
    setSelected(o);
    setOpenChat(true);
  };

  const canRelease = (o: AdminOrder) => {
    if (o.status === "awaiting_buyer_confirm") return true;
    if (o.status !== "held") return false;
    return tick >= calcUnlockAt(o).getTime();
  };

  const statusBadge = (s: AdminOrderStatus) => {
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

  return (
    <div className="min-h-screen p-4 space-y-4">
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
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.map((o) => {
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
                    {statusBadge(o.status)}
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
                    Dispute {o.thread?.length ? `(${o.thread.length})` : ""}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && filtered.length === 0 && <div className="text-sm text-muted-foreground">No results.</div>}
      </div>

      {/* Chat Dialog (placeholder until disputes API wired) */}
      <Dialog.Root open={openChat} onOpenChange={setOpenChat}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        </Dialog.Portal>
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[96vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-0 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-semibold">Dispute chat · #{selected?.id}</div>
            <Button variant="ghost" size="icon" onClick={() => setOpenChat(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {selected && <MockChat order={{
            // تكييف مؤقت لواجهة MockChat
            id: selected.id,
            createdAt: selected.createdAt,
            amount: selected.amount,
            currency: selected.currency,
            status: selected.status as any,
            buyer: { id: selected.buyer.id, name: selected.buyer.username || selected.buyer.name },
            seller: { id: selected.seller.id, name: selected.seller.username || selected.seller.name },
            thread: selected.thread || [],
          } as any} me="admin" />}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}