import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DisputeThread, type AdminOrder, type DisputeMessage } from "@/components/dispute-thread";

// ---- Mock data (بدّلها لاحقاً ببياناتك) ----
const MOCK_ORDERS: AdminOrder[] = [
  {
    id: "ord_1001",
    buyer: "u12345",
    seller: "u77777",
    amount: 120,
    currency: "USDT",
    status: "held",
    createdAt: new Date(Date.now()-3600_000).toISOString(),
    disputeThread: [
      { id:"m1", role:"buyer", text:"Seller didn’t respond yet.", at:new Date(Date.now()-3500_000).toISOString() }
    ]
  },
  {
    id: "ord_1002",
    buyer: "u88888",
    seller: "u77777",
    amount: 50,
    currency: "TON",
    status: "disputed",
    createdAt: new Date(Date.now()-7200_000).toISOString(),
    disputeThread: [
      { id:"m2", role:"seller", text:"Buyer got access already.", at:new Date(Date.now()-7000_000).toISOString() },
      { id:"m3", role:"buyer", text:"No, access not granted.", at:new Date(Date.now()-6800_000).toISOString() }
    ]
  },
  {
    id: "ord_1003",
    buyer: "u99999",
    seller: "u22222",
    amount: 300,
    currency: "USDT",
    status: "released",
    createdAt: new Date(Date.now()-86400_000).toISOString(),
  },
];

export default function AdminPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[]>(MOCK_ORDERS);
  const [statusFilter, setStatusFilter] = useState<"all"|"held"|"disputed"|"released"|"refunded">("all");
  const [q, setQ] = useState("");
  const [openDispute, setOpenDispute] = useState(false);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const filtered = useMemo(()=>{
    return orders.filter(o=>{
      if (statusFilter!=="all" && o.status!==statusFilter) return false;
      if (q) {
        const blob = `${o.id} ${o.buyer} ${o.seller}`.toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  },[orders,statusFilter,q]);

  const setStatus = (id:string, next:AdminOrder["status"])=>{
    setOrders(prev => prev.map(o => o.id===id ? {...o, status: next} : o));
  };

  const onRelease = (id:string)=>{
    setStatus(id,"released");
    toast({ title:"Released", description:`Order ${id} funds released.` });
  };
  const onRefund = (id:string)=>{
    setStatus(id,"refunded");
    toast({ title:"Refunded", description:`Order ${id} refunded.` });
  };

  const onOpenDispute = (o:AdminOrder)=>{
    setSelected(o);
    setOpenDispute(true);
  };

  const onPostDispute = (orderId: string, msg: Omit<DisputeMessage,"id"|"at">) => {
    setOrders(prev => prev.map(o=>{
      if (o.id!==orderId) return o;
      const thread = o.disputeThread || [];
      const nextMsg: DisputeMessage = {
        id: `m_${Date.now()}`,
        at: new Date().toISOString(),
        role: msg.role,
        text: msg.text
      };
      return { ...o, status: o.status==="held" ? "disputed" : o.status, disputeThread: [...thread, nextMsg] };
    }));
    toast({ title:"Message sent", description:"Your message was added to the dispute." });
  };

  const statusBadge = (s: AdminOrder["status"]) => {
    if (s==="held") return <Badge className="bg-amber-500 text-white">Held</Badge>;
    if (s==="disputed") return <Badge className="bg-red-600 text-white">Disputed</Badge>;
    if (s==="released") return <Badge className="bg-emerald-600 text-white">Released</Badge>;
    return <Badge className="bg-sky-600 text-white">Refunded</Badge>;
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
              onChange={(e)=>setStatusFilter(e.target.value as any)}
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
              onChange={(e)=>setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      <div className="space-y-3">
        {filtered.map(o=>(
          <Card key={o.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Order #{o.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString()} · {o.amount} {o.currency} · buyer:{o.buyer} · seller:{o.seller}
                  </div>
                </div>
                {statusBadge(o.status)}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={o.status!=="held"} onClick={()=>onRelease(o.id)}>Release</Button>
                <Button size="sm" variant="secondary" disabled={o.status!=="held"} onClick={()=>onRefund(o.id)}>Refund</Button>
                <Button size="sm" variant="outline" onClick={()=>onOpenDispute(o)}>
                  Dispute {o.disputeThread?.length ? `(${o.disputeThread.length})` : ""}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length===0 && (
          <div className="text-sm text-muted-foreground">No results.</div>
        )}
      </div>

      {/* Dispute drawer/dialog */}
      <DisputeThread
        open={openDispute}
        onOpenChange={setOpenDispute}
        order={selected}
        onPost={onPostDispute}
      />
    </div>
  );
}