import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/* ===============================
   1) Wallet Balance
=============================== */
export function useWalletBalance() {
  return useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/wallet/balance");
      return r;
    },
    staleTime: 15_000, // cache balance for 15s
  });
}

/* ===============================
   2) Wallet Ledger (history)
=============================== */
export function useWalletLedger(limit: number = 10) {
  return useQuery({
    queryKey: ["/api/wallet/ledger", limit],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/wallet/ledger?limit=${limit}`);
      return Array.isArray(r.rows) ? r.rows : [];
    },
    staleTime: 5_000, // refresh more frequently
  });
}

/* ===============================
   3) Wallet Address (link/unlink)
=============================== */
export function useWalletAddress() {
  const qc = useQueryClient();

  // Get current wallet address
  const addressQuery = useQuery({
    queryKey: ["/api/wallet/address"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/wallet/address");
      return r.walletAddress ?? null;
    },
    staleTime: Infinity,
  });

  // Link wallet
  const link = useMutation({
    mutationFn: async (walletAddress: string) =>
      await apiRequest("POST", "/api/wallet/address", { walletAddress }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wallet/address"] });
    },
  });

  // Unlink wallet
  const unlink = useMutation({
    mutationFn: async () => await apiRequest("DELETE", "/api/wallet/address"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/wallet/address"] });
    },
  });

  return {
    address: addressQuery.data,
    isLoading: addressQuery.isLoading,
    link,
    unlink,
    refetch: addressQuery.refetch,
  };
}