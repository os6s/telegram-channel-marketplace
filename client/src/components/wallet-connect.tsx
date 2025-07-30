import { useState, useEffect, useRef } from "react";
import {
  useTonConnectUI,
  useTonWallet
} from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Address } from "ton-core";

export interface TonWallet {
  address: string;
  balance: string;
  network: "mainnet" | "testnet";
}

interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
  onWalletDisconnect?: () => void;
}

const formatAddress = (address: string): string => {
  if (!address) return "غير متوفر";
  try {
    // تحقق من العنوان باستخدام ton-core
    new Address(address);
  } catch {
    return "عنوان غير صالح";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export function WalletConnect({ onWalletConnect, onWalletDisconnect }: WalletConnectProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [balance, setBalance] = useState("0.000");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();
  const balanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBalance = async (address: string): Promise<string> => {
    if (!address || address.length < 10) return "0.000";

    try {
      const response = await fetch(
        `https://toncenter.com/api/v2/getAddressInformation?address=${address}`
      );
      const data = await response.json();
      if (data.ok && data.result.balance) {
        return (parseInt(data.result.balance) / 1e9).toFixed(3);
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
    return "0.000";
  };

  // إعداد تحديث الرصيد كل 30 ثانية فقط إذا العنوان مختلف أو جديد
  useEffect(() => {
    if (localWallet?.address) {
      // تنظيف أي interval قديم
      if (balanceIntervalRef.current) clearInterval(balanceIntervalRef.current);

      balanceIntervalRef.current = setInterval(async () => {
        const newBalance = await fetchBalance(localWallet.address);
        if (newBalance !== balance) {
          setBalance(newBalance);
          setLocalWallet((prev) =>
            prev ? { ...prev, balance: newBalance } : prev
          );
        }
      }, 30000);
    }

    // تنظيف عند إلغاء التركيب أو تغير العنوان
    return () => {
      if (balanceIntervalRef.current) {
        clearInterval(balanceIntervalRef.current);
        balanceIntervalRef.current = null;
      }
    };
  }, [localWallet?.address, balance]);

  useEffect(() => {
    if (!wallet) {
      if (localWallet) {
        setLocalWallet(null);
        setBalance("0.000");
        onWalletDisconnect?.();
      }
      return;
    }

    // تفعيل الإشعار فقط عند اتصال محفظة جديدة (تجنب التكرار)
    if (wallet.account.address !== localWallet?.address) {
      const initializeWallet = async () => {
        const balanceInTon = await fetchBalance(wallet.account.address);
        const tonWallet = {
          address: wallet.account.address,
          balance: balanceInTon,
          network: wallet.account.chain === "-239" ? "mainnet" : "testnet",
        };

        setLocalWallet(tonWallet);
        setBalance(balanceInTon);
        onWalletConnect?.(tonWallet);

        toast({
          title: "Wallet Connected",
          description: `Connected to ${formatAddress(wallet.account.address)}`,
          duration: 3000,
        });
      };

      initializeWallet();
    }
  }, [wallet, localWallet?.address, onWalletConnect, onWalletDisconnect, toast]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await tonConnectUI.connectWallet();
    } catch (err) {
      console.error("Wallet connection failed:", err);
      toast({
        title: "Connection Failed",
        description: "Could not connect to wallet",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
      });
      setLocalWallet(null);
      setBalance("0.000");
      onWalletDisconnect?.();
    } catch (error) {
      console.error("Wallet disconnection error:", error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      {localWallet ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-green-100 dark:bg-green-900"
              onClick={() =>
                window.open(`https://tonscan.org/address/${localWallet.address}`, "_blank")
              }
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              <span className="font-mono">{formatAddress(localWallet.address)}</span>
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
            className="text-red-600 dark:text-red-400"
          >
            قطع الاتصال
          </Button>
        </>
      ) : (
        <>
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Connect TON Wallet
              </>
            )}
          </Button>

          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">Secure TON Wallet Connection</h4>
                  <p className="text-gray-500 text-xs mt-1">
                    Connect your TON wallet to buy and sell channels securely. Your private
                    keys never leave your device.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}