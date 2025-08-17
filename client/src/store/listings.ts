// client/src/store/listings.ts
import type { Channel } from "@shared/schema";

/** نفس الشكل الموحّد اللي تستعمله الماركت */
export type Kind = "username" | "account" | "channel" | "service" | "";
export type Platform = "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok" | "";
export type ChannelMode = "subscribers" | "gifts" | "";
export type ServiceType = "followers" | "members" | "boost_channel" | "boost_group" | "";

export type AnyListing = Partial<Channel> & {
  id: string;
  kind?: Kind;
  platform?: Platform;
  channelMode?: ChannelMode;
  serviceType?: ServiceType;
  price?: string | number;
  isVerified?: boolean;
  subscribers?: number;
  name?: string;
  username?: string;
  title?: string;
  sellerId?: string;      // لربطها بصاحبها
  createdAt?: string;     // عرض مرتب
};

let LISTINGS: AnyListing[] = [];

// بسيط للتحديث (pub/sub)
type Sub = () => void;
const subs = new Set<Sub>();
function notify(){ subs.forEach(fn => fn()); }

export function onListingsChange(fn: Sub){ subs.add(fn); return () => subs.delete(fn); }
export function listLocalListings(): AnyListing[] { return LISTINGS.slice().reverse(); }
export function upsertListing(l: AnyListing){
  const i = LISTINGS.findIndex(x => x.id === l.id);
  if (i >= 0) LISTINGS[i] = { ...LISTINGS[i], ...l };
  else LISTINGS.push(l);
  notify();
}
export function seedListing(l: AnyListing){ upsertListing(l); }
export function clearListings(){ LISTINGS = []; notify(); }