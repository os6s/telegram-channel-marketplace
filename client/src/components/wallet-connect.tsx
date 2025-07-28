import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, CheckCircle, Loader2 } from "lucide-react";
import { tonConnect, type TonWallet } from "@/lib/ton-connect";
import { useToast } from "@/hooks/use-toast";

interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
}

export function WalletConnect({ onWalletConnect }: WalletConnectProps) {
  const [wallet, setWallet] = useState<TonWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Try to restore connection on mount
    tonConnect.restoreConnection().then((restoredWallet) => {
      if (restoredWallet) {
        setWallet(restoredWallet);
        onWalletConnect?.(restoredWallet);
      }
    });
  }, [onWalletConnect]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connectedWallet = await tonConnect.connect();
      setWallet(connectedWallet);
      onWalletConnect?.(connectedWallet);
      setIsOpen(false);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${connectedWallet.address.slice(0, 6)}...${connectedWallet.address.slice(-4)}`,
      });
    } catch (error) {
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
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet",
        variant: "destructive",
      });
    }
  };

  if (wallet) {
    return (
      <Button
        variant="outline"
        className="bg-ton-500 text-white border-ton-600 hover:bg-ton-600"
        onClick={handleDisconnect}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-ton-500 text-white hover:bg-ton-600">
          <Wallet className="w-4 h-4 mr-2" />
          Connect TON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect TON Wallet</DialogTitle>
        </DialogHeader>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-ton-500 rounded-full flex items-center justify-center mx-auto">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Connect your TON wallet</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Connect your TON wallet to buy and sell channels securely with automated escrow.
                </p>
              </div>
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full bg-ton-500 hover:bg-ton-600 text-white"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect with TON Connect
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-400">
                We use TON Connect to securely connect to your wallet. Your private keys never leave your device.
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
