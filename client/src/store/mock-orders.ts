// client/src/store/mock-orders.ts

export type ChatRole = "buyer" | "seller" | "admin" | "system";
export type OrderStatus =
  | "held"
  | "delivered"
  | "awaiting_buyer_confirm"
  | "released"
  | "refunded"
  | "disputed";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: string;
  author?: { id: string; name?: string };
};

export type Order = {
  id: string;
  buyer: { id: string; name?: string };
  seller: { id: string; name?: string };
  amount: number;
  currency: "TON" | "USDT";
  status: OrderStatus;
  createdAt: string;
  thread: ChatMessage[];
};

let ORDERS: Order[] = [
  {
    id: "ord_1001",
    buyer: { id: "u12345", name: "Buyer_123" },
    seller: { id: "u77777", name: "Seller_777" },
    amount: 120,
    currency: "USDT",
    status: "held",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    thread: [
      {
        id: "m1",
        role: "buyer",
        text: "Hi, I purchased this.",
        at: new Date(Date.now() - 3500_000).toISOString(),
        author: { id: "u12345" },
      },
    ],
  },
  {
    id: "ord_1002",
    buyer: { id: "u99999", name: "Buyer_999" },
    seller: { id: "u22222", name: "Seller_222" },
    amount: 300,
    currency: "TON",
    status: "disputed",
    createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    thread: [
      {
        id: "m2",
        role: "seller",
        text: "I sent admin rights already.",
        at: new Date(Date.now() - 5.5 * 3600_000).toISOString(),
        author: { id: "u22222" },
      },
      {
        id: "m3",
        role: "buyer",
        text: "I still don't see it.",
        at: new Date(Date.now() - 5.3 * 3600_000).toISOString(),
        author: { id: "u99999" },
      },
    ],
  },
];

// ---------------- Queries ----------------
export function listOrdersForUser(userId: string): Order[] {
  return ORDERS.filter(
    (o) => o.buyer.id === userId || o.seller.id === userId
  );
}

export function listAllOrders(): Order[] {
  return ORDERS.map((o) => ({ ...o, thread: [...o.thread] }));
}

export function getOrder(id: string): Order | undefined {
  return ORDERS.find((o) => o.id === id);
}

// ---------------- Seeding ----------------
export function seedOrdersFor(userId: string) {
  if (listOrdersForUser(userId).length) return;
  ORDERS = ORDERS.map((o, i) =>
    i === 0 ? { ...o, buyer: { ...o.buyer, id: userId, name: "You" } } : o
  );
}

// ---------------- Internal ----------------
function pushMsg(o: Order, m: ChatMessage) {
  o.thread.push(m);
}

// ---------------- Actions ----------------
export function postMessage(orderId: string, msg: Omit<ChatMessage, "id" | "at">) {
  const o = getOrder(orderId);
  if (!o) return;
  pushMsg(o, { id: `m_${Date.now()}`, at: new Date().toISOString(), ...msg });
  if (o.status === "held" && msg.role !== "system") o.status = "disputed";
}

export function sellerMarkDelivered(orderId: string, sellerId: string) {
  const o = getOrder(orderId);
  if (!o || o.seller.id !== sellerId) return;
  o.status = "awaiting_buyer_confirm";
  pushMsg(o, {
    id: `m_${Date.now()}`,
    at: new Date().toISOString(),
    role: "system",
    text: "Seller marked as delivered. Buyer please confirm receipt.",
  });
}

export function buyerConfirmReceived(orderId: string, buyerId: string) {
  const o = getOrder(orderId);
  if (!o || o.buyer.id !== buyerId) return;
  o.status = "released";
  pushMsg(o, {
    id: `m_${Date.now()}`,
    at: new Date().toISOString(),
    role: "system",
    text: "Buyer confirmed receipt. Funds can be released.",
  });
}

export function refund(orderId: string) {
  const o = getOrder(orderId);
  if (!o) return;
  o.status = "refunded";
}

export function release(orderId: string) {
  const o = getOrder(orderId);
  if (!o) return;
  o.status = "released";
}