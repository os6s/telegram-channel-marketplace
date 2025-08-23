// client/src/hooks/use-me.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";

/** يجلب/ينشئ المستخدم بالاعتماد على Telegram ID ثم يرجعه */
export function useMe() {
  const tg = telegramWebApp.user;
  const telegramId = tg?.id ? String(tg.id) : undefined;

  return useQuery({
    enabled: !!telegramId,
    queryKey: ["me", telegramId],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/users/by-telegram/${telegramId}`, { credentials: "include" });
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
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["listings/by-seller-username", uname],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch(`/api/listings?sellerUsername=${encodeURIComponent(uname)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

/** Activities حسب sellerUsername */
export function useMyActivities(username?: string) {
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["activities/by-seller-username", uname],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch(`/api/activities?sellerUsername=${encodeURIComponent(uname)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return await res.json();
    },
  });
}

/** تحديث المحفظة عبر username فقط (بدون id) */
export function useUpdateWallet() {
  const qc = useQueryClient();
  const tg = telegramWebApp.user;
  const username = tg?.username ? tg.username.trim().toLowerCase() : undefined;

  return useMutation({
    mutationFn: async (walletAddress: string) => {
      if (!username) return null;
      return await apiRequest(
        "PATCH",
        `/api/users/by-username/${encodeURIComponent(username)}`,
        { tonWallet: walletAddress }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      if (username) {
        qc.invalidateQueries({ queryKey: ["listings/by-seller-username", username] });
        qc.invalidateQueries({ queryKey: ["activities/by-seller-username", username] });
        qc.invalidateQueries({ queryKey: ["disputes/by-user", username] });
      }
    },
  });
}

/** Disputes حسب username */
export function useMyDisputes(username?: string | null) {
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["disputes/by-user", uname],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/disputes?user=${encodeURIComponent(uname)}`);
      return Array.isArray(res) ? res : [];
    },
    staleTime: 30_000,
  });
}