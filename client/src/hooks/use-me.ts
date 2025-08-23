import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";

export function useMe() {
  const tg = telegramWebApp.user;
  const telegramId = tg?.id ? String(tg.id) : undefined;
  return useQuery({
    enabled: !!telegramId,
    queryKey: ["me", telegramId],
    queryFn: async () => {
      // ابقِ نفس الـ upsert بالباك ثم ارجع الـ user
      const r = await fetch(`/api/users/by-telegram/${telegramId}`);
      if (r.ok) return await r.json();
      return await apiRequest("POST", "/api/users", {
        telegramId,
        username: tg?.username,
        firstName: tg?.first_name,
        lastName: tg?.last_name,
      });
    },
  });
}

/** Listings حسب sellerUsername */
export function useMyListings(username?: string) {
  return useQuery({
    enabled: !!username,
    queryKey: ["listings/by-seller-username", username],
    queryFn: async () => {
      const res = await fetch(`/api/listings?sellerUsername=${encodeURIComponent(username!)}`);
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

/** Activities حسب sellerUsername */
export function useMyActivities(username?: string) {
  return useQuery({
    enabled: !!username,
    queryKey: ["activities/by-seller-username", username],
    queryFn: async () => {
      const res = await fetch(`/api/activities?sellerUsername=${encodeURIComponent(username!)}`);
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

/** تحديث المحفظة عبر username فقط */
export function useUpdateWallet() {
  const qc = useQueryClient();
  const tg = telegramWebApp.user;
  const username = tg?.username;

  return useMutation({
    mutationFn: async (walletAddress: string) => {
      if (!username) return null;
      // باك يقبل PATCH by-username
      return await apiRequest("PATCH", `/api/users/by-username/${encodeURIComponent(username)}`, {
        tonWallet: walletAddress,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}