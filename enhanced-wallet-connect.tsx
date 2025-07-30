import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { useEffect, useRef } from 'react';
import { toast } from "@/components/ui/use-toast";

export function WalletConnect() {
  const wallet = useTonWallet();
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (wallet?.account?.address && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      toast.success("Wallet connected!");
      console.log("Wallet Address:", wallet.account.address);
    }
  }, [wallet]);

  return <TonConnectButton />;
}