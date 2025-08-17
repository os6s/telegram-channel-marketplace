export type OrderStatus = "held" | "released" | "refunded" | "disputed";

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  currency: "USDT" | "TON";
  status: OrderStatus;        // يبدي "held"
  createdAt: string;          // ISO
  unlockAt: string;           // createdAt + 24h
  buyerConfirmed?: boolean;   // يضغط المشتري "استلمت"
}