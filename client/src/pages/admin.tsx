// client/src/pages/admin.tsx
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MockChat, type ChatMessage } from "@/components/chat/mock-chat";

/* ---------------- Types ---------------- */
type OrderStatus = "held" | "released" | "refunded" | "disputed";

type AdminOrder = {
  id: string;
  buyer: string;
  seller: string;
  amount: number;
  currency: "TON" | "USDT";
  status: OrderStatus;
  createdAt: string;          // ISO
  unlockAt?: string;          // ISO - متى يتهيأ التحويل تلقائياً
  buyerConfirmed?: boolean;   // إذا المشتري أكد الاستلام، يتحول جاهز فوراً
  disputeThread?: ChatMessage[];
};

/* -------------- Mock orders -------------- */
const now = Date.now();
const MOCK_ORDERS: AdminOrder[] = [
  {
    id: "ord_1001",
    buyer: "u12345",
    seller: "u77777",
    amount: 120,
    currency: "USDT",
    status: "held",
    createdAt: new Date(now - 3_600_000).toISOString(),          // قبل ساعة
    unlockAt: new Date(now + 23 * 3_600_000).toISOString(),      // يكمل بعد 23 ساعة
    buyerConfirmed: false,
    disputeThread: [
      { id: "m1", role: "buyer", text: "Seller didn’t respond yet.", at: new Date(now - 3_500_000).toISOString() },
    ],
  },
  {
    id: "ord_1002",
    buyer: "u88888",
    seller: "u77777",
    amount: 50,
    currency: "TON",
    status: "disputed",
    createdAt: new Date(now - 7_200_000).toISOString(),
    unlockAt: new Date(now + 10 * 3_600_000).toISOString(),
    buyerConfirmed: false,
    disputeThread: [
      { id: "m2", role: "seller", text: "Buyer got access already.", at: new Date(now - 7_000_000).toISOString() },
      { id: "m3", role: "buyer", text: "No, access not granted.", at: new Date(now - 6_800_000).toISOString() },
    ],
  },
  {
    id: "ord_1003",
    buyer: "u99999",
    seller: "u22222",
    amount: 300,
    currency: "USDT",
    status: "released",
    createdAt: new Date(now - 86_400_000).toISOString(),
    buyerConfirmed: true,
  },
];

/* -------- Helpers -------- */
function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* ============== Page ============== */
export default function AdminPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>(MOCK_ORDERS);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [openChat, setOpenChat] = useState(false);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  // تيك كل ثانية حتى نحدّث العدادات
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (q) {
        const blob = `${o.id} ${o.buyer} ${o.seller}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, statusFilter, q]);

  const setStatus = (id: string, next: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
  };

  const onRelease = (id: string) => {
    setStatus(id, "released");
    toast({ title: "Released", description: `Order ${id} funds released.` });
  };
  const onRefund = (id: string) => {
    setStatus(id, "refunded");
    toast({ title: "Refunded", description: `Order ${id} refunded.` });
  };

  const onOpenChat = (o: AdminOrder) => {
    setSelected(o);
    setOpenChat(true);
  };

  // إضافة رسالة جديدة وتحويل إلى "disputed" إذا كان "held"
  const onSendChat = (msg: Omit<ChatMessage, "id" | "at">) => {
    if (!selected) return;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== selected.id) return o;
        const nextMsg: ChatMessage = {
          id: `m_${Date.now()}`,
          at: new Date().toISOString(),
          role: msg.role,
          text: msg.text,
          author: msg.author,
        };
        return {
          ...o,
          status: o.status === "held" ? "disputed" : o.status,
          disputeThread: [...(o.disputeThread || []), nextMsg],
        };
      })
    );
  };

  const statusBadge = (o: AdminOrder) => {
    const s = o.status;
    if (s === "held") return <Badge className="bg-amber-500 text-white">Held</Badge>;
    if (s === "disputed") return <Badge className="bg-red-600 text-white">Disputed</Badge>;
    if (s === "released") return <Badge className="bg-emerald-600 text-white">Released</Badge>;
    return <Badge className="bg-sky-600 text-white">Refunded</Badge>;
  };

  // هل الطلب جاهز للتحويل؟
  const canRelease = (o: AdminOrder) => {
    if (o.status !== "held") return false;
    if (o.buyerConfirmed) return true;
    if (!o.unlockAt) return false;
    return tick >= new Date(o.unlockAt).getTime();
    // بدّل الشرط لاحقاً حسب منطقك الحقيقي
  };

  // شارة العدّاد
  const timerBadge = (o: AdminOrder) => {
    if (o.status !== "held") return null;
    if (o.buyerConfirmed) {
      return <Badge className="bg-emerald-600 text-white">Buyer confirmed</Badge>;
    }
    if (!o.unlockAt) {
      return <Badge className="bg-muted text-foreground">No unlockAt</Badge>;
    }
    const ms = new Date(o.unlockAt).getTime() - tick;
    if (ms <= 0) {
      return <Badge className="bg-emerald-600 text-white">Ready</Badge>;
    }
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
          return (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Order #{o.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString()} · {o.amount} {o.currency} · buyer:{o.buyer} · seller:{o.seller}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {timerBadge(o)}
                    {statusBadge(o)}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={!ready} onClick={() => onRelease(o.id)}>
                    Release
                  </Button>
                  <Button size="sm" variant="secondary" disabled={o.status !== "held"} onClick={() => onRefund(o.id)}>
                    Refund
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onOpenChat(o)}>
                    Dispute {o.disputeThread?.length ? `(${o.disputeThread.length})` : ""}
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
                orderId={selected.id}
                me="admin"
                buyer={{ id: selected.buyer, name: `Buyer ${selected.buyer}` }}
                seller={{ id: selected.seller, name: `Seller ${selected.seller}` }}
                admin={{ id: "admin", name: "Admin" }}
                initial={selected.disputeThread}
                onSend={(m) => onSendChat(m)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}