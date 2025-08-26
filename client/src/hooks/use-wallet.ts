import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** جلب/تحديث عنوان المحفظة */
export function useWalletAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ✅ GET wallet address
  const query = useQuery<string | null>({
    queryKey: ["/api/wallet/address"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wallet/address");
      return res?.walletAddress || null;
    },
    staleTime: 30_000,
  });

  // ✅ POST/DELETE wallet address
  const mutation = useMutation({
    mutationFn: async (addr: string | null) => {
      if (addr) {
        const normalized = String(addr).trim();
        return await apiRequest("POST", "/api/wallet/address", {
          walletAddress: normalized,
        });
      } else {
        return await apiRequest("DELETE", "/api/wallet/address");
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/wallet/address"] });
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });

      const a = res?.walletAddress;
      if (a) {
        toast({
          title: "Wallet linked",
          description: a.slice(0, 6) + "…" + a.slice(-4),
        });
      } else {
        toast({ title: "Wallet unlinked" });
      }
    },
    onError: (e: any) => {
      let msg = "Unknown error";
      if (typeof e === "string") msg = e;
      else if (e?.error) msg = e.error;
      else if (e?.message) msg = e.message;

      toast({
        title: "Wallet update failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  return {
    ...query,
    updateWallet: mutation.mutate, // 🔥 call updateWallet(address | null)
    linking: mutation.isPending,
  };
}

/** رصيد المحفظة */
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