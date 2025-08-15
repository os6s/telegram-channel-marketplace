// client/src/components/wallet-connect.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet as WalletIcon, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export interface TonWallet {
  address: string;
  balance: string;
  network: "mainnet" | "testnet";
}

interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
  onWalletDisconnect?: () => void;
  enableTelegramWallet?: boolean;
}

export function WalletConnect({
  onWalletConnect,
  onWalletDisconnect,
  enableTelegramWallet = true,
}: WalletConnectProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [balance, setBalance] = useState<string>("0.000");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const toastShownRef = useRef(false);

  // Telegram init (اختياري وآمن)
  useEffect(() => {
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setBackgroundColor?.("#ffffff");
      tg?.enableClosingConfirmation?.();
      tg?.BackButton?.onClick?.(() => {
        if (localWallet) handleDisconnect();
        else tg?.BackButton?.hide?.();
      });
      return () => tg?.BackButton?.offClick?.();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWallet]);

  const fetchBalance = useCallback(
    async (address: string): Promise<string> => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `https://toncenter.com/api/v2/getAddressInformation?address=${address}`,
          {
            headers: {
              Accept: "application/json",
              "X-API-Key": (import.meta as any).env?.VITE_TON_API_KEY || "",
            },
          }
        );
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        const balanceInNano = data.result?.balance || "0";
        const balanceInTon = (parseInt(balanceInNano) / 1_000_000_000).toFixed(3);
        return balanceInTon;
      } catch {
        toast({ title: t("toast.error"), description: t("toast.somethingWrong"), variant: "destructive" });
        return "0.000";
      } finally {
        setIsLoading(false);
      }
    },
    [toast, t]
  );

  useEffect(() => {
    if (!wallet) {
      if (localWallet) {
        setLocalWallet(null);
        setBalance("0.000");
        onWalletDisconnect?.();
      }
      toastShownRef.current = false;
      tg?.BackButton?.hide?.();
      return;
    }

    if (wallet && !toastShownRef.current) {
      toastShownRef.current = true;
      (async () => {
        const balanceInTon = await fetchBalance(wallet.account.address);
        const tonWallet: TonWallet = {
          address: wallet.account.address,
          balance: balanceInTon,
          network: wallet.account.chain === "-239" ? "mainnet" : "testnet",
        };
        setLocalWallet(tonWallet);
        setBalance(balanceInTon);
        onWalletConnect?.(tonWallet);
        tg?.BackButton?.show?.();
        toast({ title: t("wallet.connected"), description: formatAddress(wallet.account.address), duration: 3000 });
      })();
    }
  }, [wallet, fetchBalance, onWalletConnect, onWalletDisconnect, toast, t, tg, localWallet]);

  const formatAddress = (address: string): string =>
    !address ? "" : address.length <= 10 ? address : `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      toast({ title: t("wallet.disconnect") });
      onWalletDisconnect?.();
      toastShownRef.current = false;
      tg?.BackButton?.hide?.();
      setLocalWallet(null);
      setBalance("0.000");
    } catch {
      toast({ title: t("toast.error"), description: t("toast.somethingWrong"), variant: "destructive" });
    }
  };

  // زر “محفظة تيليجرام” (اختياري – مجرد مثال)
  const connectTelegramWallet = () => {
    if (!tg) return;
    tg.openInvoice?.(
      { currency: "TON", amount: "0", description: t("wallet.connectTelegram") },
      (status: string) => {
        if (status === "paid") toast({ title: t("wallet.connected") });
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!localWallet && <TonConnectButton className="w-full mb-4" />}

      {localWallet && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-800"
              onClick={() => window.open(`https://tonviewer.com/${localWallet.address}`, "_blank")}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {formatAddress(localWallet.address)}
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
            <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-sm font-medium">
              {balance} TON
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
          >
            {t("wallet.disconnect")}
          </Button>
        </div>
      )}

      {enableTelegramWallet && tg && !localWallet && (
        <div className="mt-3">
          <Button onClick={connectTelegramWallet} className="w-full bg-telegram-500 hover:bg-telegram-600 text-white">
            <WalletIcon className="w-4 h-4 mr-2" />
            {t("wallet.connectTelegram")}
          </Button>
        </div>
      )}

      {!localWallet && !tg && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="pt-4">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{t("wallet.connect")}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{t("toast.openFromTelegram")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Backward alias
export { WalletConnect as EnhancedWalletConnect };