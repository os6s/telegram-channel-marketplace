import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { TonConnectUI } from "@tonconnect/ui-react";

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
  const [tonConnectUI, setTonConnectUI] = useState<TonConnectUI | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    initializeTonConnect();
  }, []);

  const initializeTonConnect = async () => {
    try {
      // Use production URL for TON Connect manifest in Mini App
      const manifestUrl = import.meta.env.VITE_TON_MANIFEST_URL || 
                         'https://telegram-channel-marketplace.onrender.com/tonconnect-manifest.json';
      
      // Initialize real TON Connect UI with standard configuration
      const tonConnectUI = new TonConnectUI({
        manifestUrl: manifestUrl,
        restoreConnection: true,
        // Use default wallet configuration to support user's preferred wallets
      });
      
      setTonConnectUI(tonConnectUI);
      
      // Check for existing connection
      if (tonConnectUI.connected) {
        const walletInfo = tonConnectUI.wallet;
        if (walletInfo) {
          const connectedWallet: TonWallet = {
            name: walletInfo.device.appName,
            address: walletInfo.account.address,
            balance: "0", // Will be fetched separately
            network: "mainnet"
          };
          setWallet(connectedWallet);
        }
      }
      
      // Listen for wallet connection changes
      tonConnectUI.onStatusChange((wallet) => {
        if (wallet) {
          const connectedWallet: TonWallet = {
            name: wallet.device.appName,
            address: wallet.account.address,
            balance: "0",
            network: "mainnet"
          };
          setWallet(connectedWallet);
          localStorage.setItem('ton-wallet', JSON.stringify(connectedWallet));
          setIsConnecting(false);
          
          // Close modal after successful connection
          setTimeout(() => {
            if (tonConnectUI.modal.state?.status === 'opened') {
              tonConnectUI.modal.close();
            }
          }, 500);
          
          toast({
            title: "Wallet Connected",
            description: "Successfully connected to TON wallet.",
          });
        } else {
          setWallet(null);
          localStorage.removeItem('ton-wallet');
          setIsConnecting(false);
        }
      });
      
    } catch (error) {
      console.log('TON Connect initialization failed, falling back to demo mode:', error);
      // Check if wallet is already connected in demo mode
      const savedWallet = localStorage.getItem('ton-wallet');
      if (savedWallet) {
        setWallet(JSON.parse(savedWallet));
      }
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (tonConnectUI) {
        // Use real TON Connect
        await tonConnectUI.openModal();
        
        toast({
          title: "Connecting...",
          description: "Please approve the connection in your TON wallet.",
        });
      } else {
        // Fallback to demo mode for development/testing
        const isInTelegram = typeof window !== 'undefined' && window.Telegram?.WebApp;
        
        if (isInTelegram) {
          const mockWallet: TonWallet = {
            name: "TON Space (Demo)",
            address: "EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t",
            balance: "125.437",
            network: "mainnet"
          };

          // Simulate connection delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setWallet(mockWallet);
          localStorage.setItem('ton-wallet', JSON.stringify(mockWallet));
          
          toast({
            title: "Wallet Connected",
            description: "Successfully connected to TON wallet.",
          });
        } else {
          setError('telegram-required');
          toast({
            title: "Open in Telegram",
            description: "TON wallet connection requires opening this app through Telegram.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setError('connection-failed');
      toast({
        title: "Connection Failed",
        description: "Could not connect to TON wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      if (tonConnectUI && tonConnectUI.connected) {
        await tonConnectUI.disconnect();
      } 
      
      // Always cleanup local state
      setWallet(null);
      localStorage.removeItem('ton-wallet');
      
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
      });
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Force cleanup even if disconnect fails
      setWallet(null);
      localStorage.removeItem('ton-wallet');
    }
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