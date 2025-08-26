import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/** جلب/تحديث عنوان المحفظة */
export function useWalletAddress() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // GET العنوان
  const query = useQuery({
    queryKey: ["/api/wallet/address"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wallet/address");
      return res?.walletAddress || null;
    },
    staleTime: 30_000,
  });

  // POST/DELETE تحديث العنوان
  const mutation = useMutation({
    mutationFn: async (addr: string | null) => {
      if (addr) {
        // ربط
        return await apiRequest("POST", "/api/wallet/address", { walletAddress: addr });
      } else {
        // إلغاء الربط
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
      toast({
        title: "Wallet update failed",
        description: e?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    ...query,
    updateWallet: mutation.mutate, // updateWallet(address | null)
  };
}

/** رصيد المحفظة داخل المنصّة */
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