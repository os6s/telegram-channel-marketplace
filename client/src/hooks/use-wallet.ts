import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook: Fetch linked wallet address from backend
 */
export function useWalletAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ✅ Fetch linked wallet
  const query = useQuery({
    queryKey: ["/api/me/wallet"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/wallet");
      return res?.walletAddress || null;
    },
    staleTime: 30_000,
  });

  // ✅ Mutation: update wallet
  const mutation = useMutation({
    mutationFn: async (addr: string | null) => {
      if (!addr) {
        return await apiRequest("POST", "/api/me/wallet", { walletAddress: "" });
      }
      return await apiRequest("POST", "/api/me/wallet", { walletAddress: addr });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/me/wallet"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      if (res?.walletAddress) {
        toast({
          title: "Wallet linked",
          description: res.walletAddress.slice(0, 6) + "…" + res.walletAddress.slice(-4),
        });
      } else {
        toast({ title: "Wallet unlinked" });
      }
    },
    onError: (e: any) => {
      toast({
        title: "Wallet update failed",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    ...query,
    updateWallet: mutation.mutate, // call updateWallet(address | null)
  };
}

/**
 * Hook: Fetch wallet balance
 */
export function useWalletBalance() {
  return useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wallet/balance");
      return {
        balance: Number(res.balance ?? 0),
        currency: res.currency || "TON",
      };
    },
    staleTime: 15_000,
  });
}