import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage, ChatRole, Order } from "@/store/mock-orders";
import { postMessage, sellerMarkDelivered, buyerConfirmReceived } from "@/store/mock-orders";

export function MockChat({
  order,
  me,                  // "buyer" | "seller" | "admin"
}: {
  order: Order;
  me: ChatRole;
}) {
  const [tick, setTick] = useState(0); // refresh بسيط
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const roleInfo = useMemo(() => ({
    buyer:  { label: order.buyer.name || "Buyer",  badge:"bg-sky-600 text-white" },
    seller: { label: order.seller.name|| "Seller", badge:"bg-emerald-600 text-white" },
    admin:  { label: "Admin",                      badge:"bg-purple-600 text-white" },
  }), [order.buyer.name, order.seller.name]);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [order.thread.length, tick]);

  const send = () => {
    const body = text.trim(); if(!body) return;
    const author = me==="buyer"? order.buyer : me==="seller"? order.seller : {id:"admin",name:"Admin"};
    postMessage(order.id, { role: me, text: body, author });
    setText(""); setTick(x=>x+1);
  };

  const onSellerDelivered = () => {
    sellerMarkDelivered(order.id, order.seller.id);
    setTick(x=>x+1);
  };

  const onBuyerConfirm = async () => {
    const ok = window.prompt('Type: "استلمت الطلب" to confirm')?.trim() === "استلمت الطلب";
    if (!ok) return;
    buyerConfirmReceived(order.id, order.buyer.id);
    setTick(x=>x+1);
  };

  const canSellerDeliver = me==="seller" && (order.status==="held" || order.status==="disputed");
  const canBuyerConfirm = me==="buyer" && order.status==="awaiting_buyer_confirm";

  return (
    <div className="flex flex-col h-[70vh] max-h-[80vh] rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Order #{order.id}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Badge className="bg-sky-600 text-white">Buyer</Badge>
            <Badge className="bg-emerald-600 text-white">Seller</Badge>
            <Badge className="bg-purple-600 text-white">Admin</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSellerDeliver && (
            <Button size="sm" onClick={onSellerDelivered}>سلّمت الطلب</Button>
          )}
          {canBuyerConfirm && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onBuyerConfirm}>
              تأكيد استلام الطلب
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {order.thread.map((m: ChatMessage) => (
          <div key={m.id} className="rounded-md border p-2 bg-background/60">
            <div className="flex items-center gap-2 text-xs mb-1">
              <Badge className={
                m.role==="admin" ? "bg-purple-600 text-white" :
                m.role==="buyer" ? "bg-sky-600 text-white" :
                m.role==="seller"? "bg-emerald-600 text-white" :
                "bg-zinc-500 text-white"
              }>
                {m.role}
              </Badge>
              <span className="text-muted-foreground">
                {new Date(m.at).toLocaleString()}
              </span>
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="p-3 border-t space-y-2">
        <Textarea rows={2} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Type a message…" />
        <div className="flex justify-end"><Button onClick={send}>Send</Button></div>
      </div>
    </div>
  );
}