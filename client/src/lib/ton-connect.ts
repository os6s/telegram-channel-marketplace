// client/src/lib/ton-connect.ts
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

export interface TonWallet {
  address: string;
  balance: string;
  network: "mainnet" | "testnet";
}

export interface TonTransaction {
  to: string;
  amount: string;          // TON كـ string
  payloadBase64?: string;   // اختياري: BOC/Base64 جاهز فقط
}

async function fetchBalanceTON(addr: string): Promise<string> {
  try {
    const r = await fetch(
      `https://toncenter.com/api/v2/getAddressInformation?address=${addr}`
    );
    const j = await r.json();
    if (j?.ok && j?.result?.balance) {
      const ton = (Number(j.result.balance) / 1e9).toFixed(3);
      return ton;
    }
  } catch (_) {}
  return "0.000";
}

/**
 * Hook واجهة موحّدة للـ TonConnect UI Provider
 * يضمن عدم وجود أي تهيئة ثانية.
 */
export function useTon() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const isConnected = !!wallet?.account;

  const connectedWallet: TonWallet | null = wallet?.account
    ? {
        address: wallet.account.address,
        balance: "0.000", // تحدّث عبر getBalance()
        network: wallet.account.chain === "-239" ? "mainnet" : "testnet",
      }
    : null;

  async function connect(): Promise<TonWallet> {
    if (!tonConnectUI) throw new Error("TonConnect UI not ready");
    if (isConnected) {
      return {
        address: wallet!.account.address,
        balance: await fetchBalanceTON(wallet!.account.address),
        network: wallet!.account.chain === "-239" ? "mainnet" : "testnet",
      };
    }
    await tonConnectUI.openModal();
    // ننتظر المستخدم يختار المحفظة. الستاندر ما يوفر Promise للاتصال،
    // فنعيد محاولة قراءة الحالة بشكل بسيط.
    const started = Date.now();
    while (Date.now() - started < 30000) {
      await new Promise((r) => setTimeout(r, 400));
      if (tonConnectUI.wallet?.account) {
        const addr = tonConnectUI.wallet.account.address;
        return {
          address: addr,
          balance: await fetchBalanceTON(addr),
          network:
            tonConnectUI.wallet.account.chain === "-239" ? "mainnet" : "testnet",
        };
      }
    }
    throw new Error("Connection timeout");
  }

  async function disconnect(): Promise<void> {
    if (!tonConnectUI) return;
    await tonConnectUI.disconnect();
  }

  async function sendTransaction(tx: TonTransaction): Promise<string> {
    if (!tonConnectUI?.wallet?.account) throw new Error("Wallet not connected");

    const amountNano = Math.round(Number(tx.amount) * 1e9).toString();

    // ملاحظة: payload لازم يكون BOC/Base64 صحيح. لا تستخدم btoa للنص.
    const request = {
      validUntil: Math.floor(Date.now() / 1000) + 300,
      messages: [
        {
          address: tx.to,
          amount: amountNano,
          ...(tx.payloadBase64 ? { payload: tx.payloadBase64 } : {}),
        },
      ],
    } as const;

    const res = await tonConnectUI.sendTransaction(request);
    return res.boc; // BOC الخاص بالصفقة
  }

  async function getBalance(): Promise<string> {
    if (!tonConnectUI?.wallet?.account) throw new Error("Wallet not connected");
    return fetchBalanceTON(tonConnectUI.wallet.account.address);
  }

  return {
    tonConnectUI,
    wallet: connectedWallet,
    isConnected,
    connect,
    disconnect,
    sendTransaction,
    getBalance,
  };
}