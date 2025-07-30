import { useState, useEffect, useCallback, useMemo } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WebApp } from '@telegram-web-app/core';

export interface TonWallet {
  address: string;
  balance: string;
  network: 'mainnet' | 'testnet';
}

interface WalletConnectProps {
  onWalletConnect?: (wallet: TonWallet) => void;
  onWalletDisconnect?: () => void;
  enableTelegramWallet?: boolean;
}

export function WalletConnect({ 
  onWalletConnect, 
  onWalletDisconnect,
  enableTelegramWallet = true
}: WalletConnectProps) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [balance, setBalance] = useState<string>('0.000');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Telegram WebApp instance and initialization
  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const isTelegramEnv = useMemo(() => typeof window !== 'undefined' && window.Telegram?.WebApp, []);

  useEffect(() => {
    if (isTelegramEnv) {
      const tgWebApp = new WebApp(window.Telegram.WebApp);
      setWebApp(tgWebApp);
      
      // Initialize Telegram WebApp
      tgWebApp.ready();
      tgWebApp.expand();
      tgWebApp.setBackgroundColor('#ffffff');
      tgWebApp.enableClosingConfirmation();
      
      // Set up back button behavior
      tgWebApp.BackButton.onClick(() => {
        if (localWallet) {
          handleDisconnect();
        } else {
          tgWebApp.BackButton.hide();
        }
      });

      return () => {
        tgWebApp.BackButton.offClick();
      };
    }
  }, [isTelegramEnv, localWallet]);

  // Improved balance fetching with caching
  const fetchBalance = useCallback(async (address: string): Promise<string> => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://toncenter.com/api/v2/getAddressInformation?address=${address}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_TON_API_KEY || ''
          }
        }
      );
      
      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      const balanceInNano = data.result?.balance || '0';
      const balanceInTon = (parseInt(balanceInNano) / 1_000_000_000).toFixed(3);
      return balanceInTon;
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      toast({
        title: "Balance Error",
        description: "Could not fetch wallet balance",
        variant: "destructive",
      });
      return '0.000';
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Wallet state management
  useEffect(() => {
    if (!wallet) {
      if (localWallet) {
        setLocalWallet(null);
        setBalance('0.000');
        onWalletDisconnect?.();
        if (webApp) {
          webApp.BackButton.hide();
        }
      }
      return;
    }

    const initializeWallet = async () => {
      const balanceInTon = await fetchBalance(wallet.account.address);
      const tonWallet: TonWallet = {
        address: wallet.account.address,
        balance: balanceInTon,
        network: wallet.account.chain === '-239' ? 'mainnet' : 'testnet',
      };

      setLocalWallet(tonWallet);
      setBalance(balanceInTon);
      onWalletConnect?.(tonWallet);

      if (webApp) {
        webApp.BackButton.show();
      }

      toast({
        title: "Wallet Connected",
        description: `Connected to ${formatAddress(wallet.account.address)}`,
      });
    };

    initializeWallet();
  }, [wallet, fetchBalance, onWalletConnect, onWalletDisconnect, toast, localWallet, webApp]);

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected successfully",
      });
      onWalletDisconnect?.();
    } catch (error) {
      console.error('Wallet disconnection error:', error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Telegram Wallet integration
  const connectTelegramWallet = () => {
    if (!webApp) return;
    
    webApp.openInvoice({
      currency: 'TON',
      amount: '0', // Just to open the wallet
      description: 'Connect your Telegram Wallet'
    }, (status) => {
      if (status === 'paid') {
        toast({
          title: "Telegram Wallet Connected",
          description: "Your Telegram Wallet is now connected",
        });
      }
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main wallet connection UI */}
      {!localWallet && (
        <TonConnectButton className="w-full mb-4" />
      )}

      {/* Connected wallet display */}
      {localWallet && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-800"
              onClick={() => window.open(`https://tonviewer.com/${localWallet.address}`, '_blank')}
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
            Disconnect
          </Button>
        </div>
      )}

      {/* Telegram Wallet button (only in Telegram environment) */}
      {enableTelegramWallet && webApp && !localWallet && (
        <div className="mt-3">
          <Button 
            onClick={connectTelegramWallet}
            className="w-full bg-telegram-500 hover:bg-telegram-600 text-white"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {webApp.initDataUnsafe.user?.first_name 
              ? `Connect ${webApp.initDataUnsafe.user.first_name}'s Wallet` 
              : 'Connect Telegram Wallet'}
          </Button>
        </div>
      )}

      {/* Fallback UI for non-Telegram environments */}
      {!localWallet && !webApp && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="pt-4">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Secure TON Wallet Connection</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Connect your TON wallet to interact with the app. Your private keys never leave your device.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Export for backward compatibility
export { WalletConnect as EnhancedWalletConnect };