export type AnyListing = {
  id: string;

  // common
  kind?: "username" | "account" | "channel" | "service";
  platform?: "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok";
  title?: string | null;
  description?: string | null;
  price?: string;                     // من الباك كسلسلة بدقة 9
  currency?: "TON" | "USDT";
  isActive?: boolean;
  isVerified?: boolean;               // اختياري للعرض فقط
  createdAt?: string;

  // usernames
  username?: string | null;
  tgUserType?: string | null;

  // relations (للاستخدام داخل الفرونت)
  sellerId?: string;
  sellerUsername?: string | null;

  // channel
  channelMode?: "subscribers" | "gifts";
  subscribersCount?: number | null;
  giftsCount?: number | null;
  giftKind?: string | null;

  // account
  followersCount?: number | null;
  accountCreatedAt?: string | null;   // YYYY-MM

  // service
  serviceType?: "followers" | "members" | "boost_channel" | "boost_group";
  target?: "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok";
  serviceCount?: number | null;
};

let LISTINGS: AnyListing[] = [];

type Sub = () => void;
const subs = new Set<Sub>();
function notify() { subs.forEach(fn => fn()); }

export function onListingsChange(fn: Sub) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function listLocalListings(): AnyListing[] {
  return LISTINGS.slice().reverse();
}

export function upsertListing(l: AnyListing) {
  const i = LISTINGS.findIndex(x => x.id === l.id);
  if (i >= 0) LISTINGS[i] = { ...LISTINGS[i], ...l };
  else LISTINGS.push(l);
  notify();
}

export function clearListings() {
  LISTINGS = [];
  notify();
}