export type AnyListing = {
  id: string;
  sellerId?: string;
  kind?: "channel"|"username"|"account"|"service";
  platform?: "telegram"|"twitter"|"instagram"|"discord"|"snapchat"|"tiktok";
  channelMode?: "subscribers"|"gifts";
  serviceType?: "followers"|"members"|"boost_channel"|"boost_group";
  username?: string;
  title?: string;
  subscribers?: number;
  price?: number;
  currency?: "TON"|"USDT";
  description?: string;
  isVerified?: boolean;
  createdAt?: string;
};

let LISTINGS: AnyListing[] = [];
type Sub = () => void;
const subs = new Set<Sub>();
function notify(){ subs.forEach(fn=>fn()); }

export function onListingsChange(fn: Sub){ subs.add(fn); return () => subs.delete(fn); }
export function listLocalListings(): AnyListing[] { return LISTINGS.slice().reverse(); }
export function upsertListing(l: AnyListing){
  const i = LISTINGS.findIndex(x=>x.id===l.id);
  if (i>=0) LISTINGS[i] = { ...LISTINGS[i], ...l };
  else LISTINGS.push(l);
  notify();
}
export function clearListings(){ LISTINGS = []; notify(); }