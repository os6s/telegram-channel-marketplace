// موحّد: حالة الطلب + الرسائل + أوامر تحديث بسيطة
export type ChatRole = "buyer" | "seller" | "admin" | "system";
export type OrderStatus = "held" | "delivered" | "awaiting_buyer_confirm" | "released" | "refunded" | "disputed";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string;                  // ISO
  author?: { id: string; name?: string };
};

export type Order = {
  id: string;
  buyer: { id: string; name?: string };
  seller: { id: string; name?: string };
  amount: number;
  currency: "TON" | "USDT";
  status: OrderStatus;
  createdAt: string;           // ISO
  thread: ChatMessage[];
};

let ORDERS: Order[] = [
  {
    id: "ord_1001",
    buyer: { id: "u12345", name: "Buyer_123" },
    seller: { id: "u77777", name: "Seller_777" },
    amount: 120, currency: "USDT",
    status: "held",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    thread: [{ id:"m1", role:"buyer", text:"Hi, I purchased this.", at:new Date(Date.now()-3500_000).toISOString(), author:{id:"u12345"} }]
  },
];

export function listOrdersForUser(userId: string): Order[] {
  return ORDERS.filter(o => o.buyer.id === userId || o.seller.id === userId);
}
export function getOrder(id: string): Order | undefined { return ORDERS.find(o=>o.id===id); }
function pushMsg(o: Order, m: ChatMessage){ o.thread.push(m); }

export function postMessage(orderId: string, msg: Omit<ChatMessage,"id"|"at">) {
  const o = getOrder(orderId); if(!o) return;
  pushMsg(o, { id:`m_${Date.now()}`, at:new Date().toISOString(), ...msg });
  // لو أرسل أحدهم رسالة بالـ held → يتحول disputed
  if (o.status === "held" && msg.role !== "system") o.status = "disputed";
}

export function sellerMarkDelivered(orderId: string, sellerId: string){
  const o = getOrder(orderId); if(!o || o.seller.id!==sellerId) return;
  o.status = "awaiting_buyer_confirm";
  pushMsg(o,{ id:`m_${Date.now()}`, at:new Date().toISOString(), role:"system",
    text:"Seller marked as delivered. Buyer please confirm receipt." });
}

export function buyerConfirmReceived(orderId: string, buyerId: string){
  const o = getOrder(orderId); if(!o || o.buyer.id!==buyerId) return;
  o.status = "released";
  pushMsg(o,{ id:`m_${Date.now()}`, at:new Date().toISOString(), role:"system",
    text:"Buyer confirmed receipt. Funds can be released." });
}

export function refund(orderId:string){ const o=getOrder(orderId); if(!o)return; o.status="refunded"; }
export function release(orderId:string){ const o=getOrder(orderId); if(!o)return; o.status="released"; }