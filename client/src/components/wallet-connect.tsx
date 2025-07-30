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
}

export function WalletConnect({ onWalletConnect }: WalletConnectProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const fetchBalance = async (address: string) => {
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

  useEffect(() => {
    const setupWallet = async () => {
      if (
        wallet &&
        wallet.account?.address &&
        wallet.account.walletStateInit !== "mock"
      ) {
        const balance = await fetchBalance(wallet.account.address);
        const tonWallet: TonWallet = {
          address: wallet.account.address,
          balance,
          network: wallet.account.chain === "-239" ? "mainnet" : "testnet"
        };

        setLocalWallet(tonWallet);
        onWalletConnect?.(tonWallet);

        toast({
          title: "Wallet Connected",
          description: `Connected to ${wallet.account.address.slice(
            0,
            6
          )}...${wallet.account.address.slice(-4)}`
        });
      } else {
        setLocalWallet(null);
      }
    };

    setupWallet();
  }, [wallet, onWalletConnect, toast]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await tonConnectUI.connectWallet();
    } catch (err) {
      console.error("Wallet connection failed:", err);
      toast({
        title: "Connection Failed",
        description: "Could not connect to wallet",
        variant: "destructive"
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
        description: "Your wallet has been disconnected"
      });
    } catch (error) {
      console.error("Wallet disconnection error:", error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive"
      });
    }
  };

  if (localWallet) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="bg-green-500 text-white border-green-600 hover:bg-green-600"
          onClick={() =>
            window.open(
              `https://tonapi.io/account/${localWallet.address}`,
              "_blank"
            )
          }
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {localWallet.address.slice(0, 6)}...
          {localWallet.address.slice(-4)}
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
        <div className="text-sm text-muted-foreground">{localWallet.balance} TON</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                Connect your TON wallet to buy and sell channels securely. Your private keys never leave your device.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
