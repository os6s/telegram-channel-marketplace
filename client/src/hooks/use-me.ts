// client/src/hooks/use-me.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** ✅ Fetch current user (via /api/me)
 * Includes: user info + balance + walletAddress
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000, // cache for 1 min
    retry: false,
    queryFn: async () => {
      return await apiRequest("GET", "/api/me");
    },
  });
}

/** ✅ Listings for current user (by sellerUsername) */
export function useMyListings(username?: string) {
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["listings/by-seller-username", uname],
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/listings?sellerUsername=${encodeURIComponent(uname)}`
        );
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });
}

/** ✅ Activities for current user */
export function useMyActivities(username?: string) {
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["activities/by-seller-username", uname],
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/activities?sellerUsername=${encodeURIComponent(uname)}`
        );
        return Array.isArray(res) ? res : [];
      } catch {
        // 400 / 401 / 5xx -> رجّع مصفوفة فاضية بدون رمي خطأ
        return [];
      }
    },
  });
}

/** ✅ Update wallet address (via /api/me/wallet) */
export function useUpdateWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (walletAddress: string) => {
      return await apiRequest("POST", "/api/me/wallet", { walletAddress });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] }); // refresh user data with new wallet
    },
  });
}

/** ✅ Disputes for current user */
export function useMyDisputes(username?: string | null) {
  const uname = (username || "").trim().toLowerCase();
  return useQuery({
    enabled: !!uname,
    queryKey: ["disputes/by-user", uname],
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/disputes?user=${encodeURIComponent(uname)}`);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });
}