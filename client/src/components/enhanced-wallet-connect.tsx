// client/src/components/enhanced-wallet-connect.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WebApp } from '@telegram-web-app/core';
import { useLanguage } from "@/contexts/language-context";

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
  const { t } = useLanguage();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [localWallet, setLocalWallet] = useState<TonWallet | null>(null);
  const [balance, setBalance] = useState<string>('0.000');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tgWebApp = new WebApp(window.Telegram.WebApp);
      setWebApp(tgWebApp);
      tgWebApp.ready();
      tgWebApp.expand();
      tgWebApp.setBackgroundColor('#ffffff');
      tgWebApp.enableClosingConfirmation();

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
  }, [localWallet]);

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
        title: t("wallet.balanceErrorTitle"),
        description: t("wallet.balanceErrorDesc"),
        variant: "destructive",
      });
      return '0.000';
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (!wallet) {
      if (localWallet) {
        setLocalWallet(null);
        setBalance('0.000');
        onWalletDisconnect?.();
      }
      toastShownRef.current = false;
      if (webApp) webApp.BackButton.hide();
      return;
    }

    if (wallet && !toastShownRef.current) {
      toastShownRef.current = true;

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

        if (webApp) webApp.BackButton.show();

        toast({
          title: t("wallet.connected"),
          description: t("wallet.connectedTo", { address: formatAddress(wallet.account.address) }),
          duration: 3000,
        });
      };

      initializeWallet();
    }
  }, [wallet, fetchBalance, onWalletConnect, onWalletDisconnect, toast, webApp, t]);

  const formatAddress = (address: string): string => {
    if (!address) return '';
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      toast({
        title: t("wallet.disconnected"),
        description: t("wallet.disconnectedDesc"),
      });
      onWalletDisconnect?.();
      toastShownRef.current = false;
      if (webApp) webApp.BackButton.hide();
      setLocalWallet(null);
      setBalance('0.000');
    } catch (error) {
      console.error('Wallet disconnection error:', error);
      toast({
        title: t("wallet.disconnectFailedTitle"),
        description: t("wallet.disconnectFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const connectTelegramWallet = () => {
    if (!webApp) return;

    webApp.openInvoice(
      {
        currency: 'TON',
        amount: '0',
        description: t("wallet.connectTgDesc"),
      },
      (status) => {
        if (status === 'paid') {
          toast({
            title: t("wallet.tgConnected"),
            description: t("wallet.tgConnectedDesc"),
          });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!localWallet && (
        <TonConnectButton className="w-full mb-4" />
      )}

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
            {t("wallet.disconnect")}
          </Button>
        </div>
      )}

      {enableTelegramWallet && webApp && !localWallet && (
        <div className="mt-3">
          <Button
            onClick={connectTelegramWallet}
            className="w-full bg-telegram-500 hover:bg-telegram-600 text-white"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {webApp.initDataUnsafe.user?.first_name
              ? t("wallet.connectTgWithName", { name: webApp.initDataUnsafe.user.first_name })
              : t("wallet.connectTg")}
          </Button>
        </div>
      )}

      {!localWallet && !webApp && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="pt-4">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{t("wallet.secureTitle")}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  {t("wallet.secureDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { WalletConnect as EnhancedWalletConnect };