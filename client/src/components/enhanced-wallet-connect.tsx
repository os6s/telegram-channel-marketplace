import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

// TON Connect integration types
interface TonWallet {
  name: string;
  address: string;
  balance?: string;
  network?: string;
}

export function EnhancedWalletConnect() {
  const [wallet, setWallet] = useState<TonWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Check if TON Connect is available
  const isTonConnectAvailable = typeof window !== 'undefined' && 
    (window as any).TON?.Connect !== undefined;

  useEffect(() => {
    // Initialize TON Connect
    if (isTonConnectAvailable) {
      initializeTonConnect();
    }
  }, []);

  const initializeTonConnect = async () => {
    try {
      // Check if wallet is already connected
      const savedWallet = localStorage.getItem('ton-wallet');
      if (savedWallet) {
        setWallet(JSON.parse(savedWallet));
      }
    } catch (error) {
      console.log('TON Connect initialization failed:', error);
    }
  };

  const connectWallet = async () => {
    if (!isTonConnectAvailable) {
      // Fallback for non-TON environments
      toast({
        title: "TON Wallet",
        description: "Please open this app in a TON-compatible wallet or browser.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Mock TON Connect implementation for development
      // In production, this would use actual TON Connect SDK
      const mockWallet: TonWallet = {
        name: "TON Wallet",
        address: "UQA...", // Mock address
        balance: "10.50",
        network: "mainnet"
      };

      setWallet(mockWallet);
      localStorage.setItem('ton-wallet', JSON.stringify(mockWallet));
      
      toast({
        title: "Wallet Connected",
        description: "Your TON wallet has been connected successfully.",
      });
    } catch (error) {
      setError("Failed to connect wallet");
      toast({
        title: "Connection Failed",
        description: "Unable to connect to TON wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    localStorage.removeItem('ton-wallet');
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const copyAddress = async () => {
    if (wallet?.address) {
      try {
        await navigator.clipboard.writeText(wallet.address);
        toast({
          title: "Address Copied",
          description: "Wallet address copied to clipboard.",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Unable to copy address to clipboard.",
          variant: "destructive",
        });
      }
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!wallet) {
    return (
      <Button 
        onClick={connectWallet} 
        disabled={isConnecting}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : t('connectWallet')}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Card className="w-64 bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{wallet.name}</p>
                <Badge variant="outline" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('walletConnected')}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnectWallet}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Address:</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-mono">{formatAddress(wallet.address)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {wallet.balance && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Balance:</span>
                <span className="text-sm font-semibold text-foreground">
                  {wallet.balance} TON
                </span>
              </div>
            )}

            {wallet.network && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network:</span>
                <Badge variant="secondary" className="text-xs">
                  {wallet.network}
                </Badge>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}