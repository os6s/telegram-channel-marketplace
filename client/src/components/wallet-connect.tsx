import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { tonConnect, type TonWallet } from "@/lib/ton-connect";
import { useToast } from "@/hooks/use-toast";

interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
}

export function WalletConnect({ onWalletConnect }: WalletConnectProps) {
  const [wallet, setWallet] = useState<TonWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Try to restore connection on mount
    tonConnect.restoreConnection().then((restoredWallet) => {
      if (restoredWallet) {
        setWallet(restoredWallet);
        onWalletConnect?.(restoredWallet);
      }
    });

    // Set up a periodic check for wallet status
    const interval = setInterval(async () => {
      const currentWallet = await tonConnect.restoreConnection();
      if (currentWallet && (!wallet || currentWallet.address !== wallet.address)) {
        setWallet(currentWallet);
        onWalletConnect?.(currentWallet);
      } else if (!currentWallet && wallet) {
        setWallet(null);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [onWalletConnect, wallet]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connectedWallet = await tonConnect.connect();
      setWallet(connectedWallet);
      onWalletConnect?.(connectedWallet);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${connectedWallet.address.slice(0, 6)}...${connectedWallet.address.slice(-4)}`,
      });
    } catch (error) {
      console.error('Wallet connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await tonConnect.disconnect();
      setWallet(null);
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected",
      });
    } catch (error) {
      console.error('Wallet disconnection error:', error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  if (wallet) {
    return (
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          className="bg-green-500 text-white border-green-600 hover:bg-green-600"
          onClick={() => {
            // Open TON blockchain explorer
            window.open(`https://tonapi.io/account/${wallet.address}`, '_blank');
          }}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          <ExternalLink className="w-3 h-3 ml-1" />
        </Button>
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
      {/* TON Connect Button Container - This is where the real TON Connect UI will render */}
      <div id="ton-connect-button" className="hidden"></div>
      
      <Button 
        onClick={handleConnect}
        disabled={isConnecting}
        className="bg-blue-500 text-white hover:bg-blue-600"
      >
        {isConnecting ? (
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
      
      {/* Info card about TON Connect */}
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
        </Card>
      </DialogContent>
    </Dialog>
  );
}
