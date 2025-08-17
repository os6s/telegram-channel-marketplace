// client/src/pages/admin.tsx
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MockChat } from "@/components/chat/mock-chat";

// استخدم الـ store الصحيح
import {
  type Order,
  type OrderStatus,
  listAllOrders,
  postMessage,
  refund as storeRefund,
  release as storeRelease,
} from "@/store/mock-orders";

/* -------- Helpers -------- */
function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// نحسب unlockAt = createdAt + 24 ساعة
function calcUnlockAt(o: Order) {
  return new Date(new Date(o.createdAt).getTime() + 24 * 3600_000);
}

/* ============== Page ============== */
export default function AdminPage() {
  const { toast } = useToast();

  // نعيد القراءة كل تغيّر rev
  const [rev, setRev] = useState(0);
  const orders = useMemo(() => listAllOrders(), [rev]);

  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [openChat, setOpenChat] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);

  // تيك كل ثانية لتحديث العدادات
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const blob = `${o.id} ${o.buyer.id} ${o.seller.id} ${o.buyer.name ?? ""} ${o.seller.name ?? ""}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, statusFilter, q]);

  const onRelease = (id: string) => {
    storeRelease(id);
    setRev(x => x + 1);
    toast({ title: "Released", description: `Order ${id} funds released.` });
  };
  const onRefund = (id: string) => {
    storeRefund(id);
    setRev(x => x + 1);
    toast({ title: "Refunded", description: `Order ${id} refunded.` });
  };

  const onOpenChat = (o: Order) => {
    setSelected(o);
    setOpenChat(true);
  };

  // إرسال رسالة من الأدمن (الـ MockChat نفسه يستدعي postMessage داخليًا عند الإرسال)
  const adminQuickNote = (o: Order) => {
    postMessage(o.id, { role: "admin", text: "Admin joined the dispute", author: { id: "admin", name: "Admin" } });
    setRev(x => x + 1);
  };

  // جاهز للإفراج؟
  const canRelease = (o: Order) => {
    if (o.status === "awaiting_buyer_confirm") return true;
    if (o.status !== "held") return false;
    return tick >= calcUnlockAt(o).getTime();
  };

  const statusBadge = (s: OrderStatus) => {
    if (s === "held") return <Badge className="bg-amber-500 text-white">Held</Badge>;
    if (s === "disputed") return <Badge className="bg-red-600 text-white">Disputed</Badge>;
    if (s === "awaiting_buyer_confirm") return <Badge className="bg-blue-600 text-white">Awaiting confirm</Badge>;
    if (s === "released") return <Badge className="bg-emerald-600 text-white">Released</Badge>;
    if (s === "refunded") return <Badge className="bg-sky-600 text-white">Refunded</Badge>;
    return <Badge className="bg-muted text-foreground">{s}</Badge>;
  };

  const timerBadge = (o: Order) => {
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
        {filtered.map((o) => {
          const ready = canRelease(o);
          const buyer = o.buyer.name || o.buyer.id;
          const seller = o.seller.name || o.seller.id;
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
                  <Button size="sm" variant="secondary" disabled={o.status !== "held" && o.status !== "disputed"} onClick={() => onRefund(o.id)}>
                    Refund
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { adminQuickNote(o); onOpenChat(o); }}>
                    Dispute {o.thread?.length ? `(${o.thread.length})` : ""}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="text-sm text-muted-foreground">No results.</div>}
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

            {selected && (
              <MockChat
                order={selected}
                me="admin"
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}