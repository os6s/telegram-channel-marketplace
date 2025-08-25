import { db } from "../../../db.js";
import { activities } from "@shared/schema";

type AddMarketActivityArgs = {
  listingId: string;
  kind: "list" | "sold";
  sellerId: string;
  buyerId?: string | null;
  amount: string;
  currency: string;
};

export async function addMarketActivity({
  listingId,
  kind,
  sellerId,
  buyerId = null,
  amount,
  currency,
}: AddMarketActivityArgs) {
  await db.insert(activities).values({
    listingId,
    sellerId,
    buyerId,
    type: kind,      // "list" أو "sold"
    status: "completed",
    amount,
    currency,
    note: { tag: kind } as any,
  });
}