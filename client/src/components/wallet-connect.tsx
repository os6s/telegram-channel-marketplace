import { useState, useEffect } from "react";
import {
  useTonConnectUI,
  useTonWallet
} from "@tonconnect/ui-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface TonWallet {
  address: string;
  balance: string;
  network: "mainnet" | "testnet";
}
interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
  onWalletDisconnect?: () => void;
}

const formatAddress = (address: string): string =>
  address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "N/A";

export function WalletConnect({
  onWalletConnect,
  onWalletDisconnect
}: WalletConnectProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [balance, setBalance] = useState("0.000");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const fetchBalance = async (address: string): Promise<string> => {
    try {
      if (!address || address.length < 10) return "0.000";
      const response = await fetch(
        `https://toncenter.com/api/v2/getAddressInformation?address=${address}`
      );
      const data = await response.json();
      if (!data.ok) throw new Error("Invalid TON response");
      const nano = parseInt(data.result.balance || "0");
      return (nano / 1e9).toFixed(3);
    } catch (err) {
      console.error("Error fetching TON balance:", err);
      return "0.000";
    }
  };

  useEffect(() => {
    if (!wallet) {
      setLocalWallet(null);
      setBalance("0.000");
      onWalletDisconnect?.();
      return;
    }
    if (wallet.account.address !== localWallet?.address) {
      (async () => {
        const bal = await fetchBalance(wallet.account.address);
        const tonWallet = {
          address: wallet.account.address,
          balance: bal,
          network: wallet.account.chain === "-239" ? "mainnet" : "testnet",
        };
        setLocalWallet(tonWallet);
        setBalance(bal);
        onWalletConnect?.(tonWallet);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${formatAddress(wallet.account.address)}`,
          duration: 3000,
        });
      })();
    }
  }, [wallet, localWallet?.address, onWalletConnect, onWalletDisconnect, toast]);

  useEffect(() => {
    if (localWallet?.address) {
      const interval = setInterval(async () => {
        const newBal = await fetchBalance(localWallet.address);
        if (newBal !== balance) {
          setBalance(newBal);
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [localWallet?.address, balance]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await tonConnectUI.connectWallet();
    } catch (err) {
      console.error("Wallet connection failed:", err);
      toast({
        title: "Connection Failed",
        description: "Could not connect wallet",
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
    } catch (err) {
      console.error("Disconnect error:", err);
      toast({
        title: "Disconnection Failed",
        description: "Could not disconnect wallet",
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
                window.open(
                  `https://tonscan.org/address/${localWallet.address}`,
                  "_blank"
                )
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
            Disconnect
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
                <h4 className="font-medium text-sm">Secure TON Wallet Connection</h4>
                <p className="text-gray-500 text-xs mt-1">
                  Connect your TON wallet securely — your keys stay on your device.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}