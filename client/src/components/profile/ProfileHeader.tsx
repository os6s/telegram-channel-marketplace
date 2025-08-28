// client/src/components/profile/ProfileHeader.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings, ArrowLeft, Plus, Minus } from "lucide-react";
import tonIconUrl from "@/assets/icons/ton.svg?url";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  useTonWallet,
  useTonConnectUI,
  useTonConnectModal,
  useIsConnectionRestored,
} from "@tonconnect/ui-react";
import { useWalletAddress } from "@/hooks/use-wallet";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "U";
};

export function ProfileHeader({
  telegramUser,
  onBack,
  onOpenSettings,
  balance,
}: {
  telegramUser: any;
  onBack: () => void;
  onOpenSettings: () => void;
  balance?: { balance: number; currency: string } | null;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const { open, state } = useTonConnectModal();
  const connectionRestored = useIsConnectionRestored();

  const { data: linkedWallet, updateWallet } = useWalletAddress();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const sendingRef = useRef(false); // منع الإرسال المزدوج

  const address = useMemo(() => wallet?.account?.address || "", [wallet?.account?.address]);

  useEffect(() => {
    if (address) updateWallet(address);
  }, [address, updateWallet]);

  const ensureConnected = async () => {
    if (wallet) return true; // متصل
    if (state?.status !== "opened") await open(); // افتح المودال فقط إذا مغلق
    return false; // لسة ما متصل، ينتظر المستخدم
  };

  async function handleConnect() {
    try {
      setBusy(true);
      await ensureConnected();
    } catch (e: any) {
      toast({
        title: t("toast.connectFailed"),
        description: e?.message || "",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    try {
      setBusy(true);
      await tonConnectUI?.disconnect();
      updateWallet(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeposit() {
    if (sendingRef.current) return;
    let initResp: any;
    let tx: any;

    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }

      // لا نفتح المودال إذا متصل؛ إن لم يكن متصل نفتح ونوقف هنا حتى يختار
      const isConnected = !!wallet;
      if (!isConnected) {
        await ensureConnected();
        return; // ننتظر المستخدم يربط، ثم يعيد المحاولة
      }

      // تحقق من توافق الشبكة
      const appNet = (import.meta as any).env?.VITE_TON_NETWORK === "TESTNET" ? "TESTNET" : "MAINNET";
      const chain = wallet?.account?.chain; // "-239" mainnet, "-3" testnet
      const walletNet = chain === "-3" ? "TESTNET" : "MAINNET";
      if (walletNet !== appNet) throw new Error(`Wallet on ${walletNet}. Switch to ${appNet}.`);

      if (!connectionRestored) throw new Error("Connection is not restored yet");

      sendingRef.current = true;
      setBusy(true);

      // طلب إعداد المعاملة
      initResp = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });
      const raw = initResp?.txPayload || {};
      const messages = Array.isArray(raw.messages) ? raw.messages : [];
      if (messages.length === 0) throw new Error("No messages in txPayload");

      tx = {
        validUntil:
          Number(raw.validUntil) > 0 ? Number(raw.validUntil) : Math.floor(Date.now() / 1000) + 900, // 15m
        messages: messages.map((m: any) => ({
          address: String(m.address),
          amount: String(m.amount),
          ...(m.payload ? { payload: String(m.payload) } : {}),
          ...(m.stateInit ? { stateInit: String(m.stateInit) } : {}),
        })),
      };

      // إرسال مرة واحدة فقط
      await tonConnectUI.sendTransaction(tx);
      toast({ title: t("toast.confirmDeposit") });

      // تتبع التأكيد
      const poll = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", {
          code: initResp.code,
          minTon: amt,
        });
        if (status.status === "paid") {
          toast({ title: t("toast.depositConfirmed"), description: `Tx: ${status.txHash}` });
          qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
        } else {
          setTimeout(poll, 5000);
        }
      };
      setTimeout(poll, 5000);

      setDepositOpen(false);
      setAmount("");
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("unlinked")) {
        try {
          await tonConnectUI?.disconnect();
        } catch {}
      }

      // تطبيع الخطأ
      const normalizeError = (err: any) => {
        if (!err) return { name: "UnknownError", message: "Empty rejection from SDK" };
        if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
        const msg = String(err?.message || err?.reason || err?.toString?.() || "Unknown");
        const name = String(err?.name || "SDKError");
        return { name, message: msg, raw: err };
      };

      const details = normalizeError(e);
      const safe = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

      console.log("[TON] wallet account:", wallet?.account);
      console.log("[TON] last txPayload (raw):", initResp?.txPayload);
      console.log("[TON] last txPayload (normalized):", tx);
      console.error("TonConnect error raw:", details);

      alert(`TonConnect error:\n${JSON.stringify(details, safe, 2)}`);

      fetch("/api/log-client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "deposit/sendTransaction",
          details,
          tx,
          init: initResp,
          wallet: wallet?.account,
          url: window.location.href,
          ua: navigator.userAgent,
          ts: new Date().toISOString(),
        }),
      });

      const msgShort = details.message || "Transaction failed";
      toast({ title: "Deposit failed", description: msgShort, variant: "destructive" });
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0 || (balance?.balance || 0) < amt) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }
      await apiRequest("POST", "/api/payouts", { amount: amt });
      toast({ title: t("wallet.withdrawRequest") || "Withdrawal request sent" });
      qc.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      setWithdrawOpen(false);
      setAmount("");
    } catch (e: any) {
      toast({ title: "Withdraw failed", description: e?.message || "", variant: "destructive" });
    }
  }

  return (
    <>
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{t("profilePage.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("profilePage.subtitle")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="pt-6 flex items-start justify-between gap-6">
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 bg-muted rounded-full pl-3 pr-2 py-1">
              <img src={tonIconUrl} alt="TON" className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {(balance?.balance ?? 0).toLocaleString()} {balance?.currency || "TON"}
              </span>
              <button
                onClick={() => setDepositOpen(true)}
                className="ml-1 h-8 w-8 rounded-full bg-secondary grid place-items-center"
                aria-label="Deposit"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setWithdrawOpen(true)}
                className="h-8 w-8 rounded-full bg-secondary grid place-items-center"
                aria-label="Withdraw"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>

            {!address ? (
              <Button onClick={handleConnect} className="rounded-full px-5" disabled={busy}>
                <img src={tonIconUrl} alt="" className="w-4 h-4 mr-2" />
                {busy ? "…" : "Connect Wallet"}
              </Button>
            ) : (
              <Button onClick={handleDisconnect} className="rounded-full px-5" variant="secondary" disabled={busy}>
                Disconnect
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={telegramUser?.photo_url} />
              <AvatarFallback className="bg-telegram-500 text-white text-xl">
                {initialFrom(telegramUser?.first_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-[200px]">
              <h2 className="text-xl font-semibold">
                {S(telegramUser?.first_name)} {S(telegramUser?.last_name)}
              </h2>
              {telegramUser?.username && <p className="text-muted-foreground">@{telegramUser.username}</p>}
              <div className="flex items-center gap-2 mt-2">
                {telegramUser?.is_premium && <Badge variant="secondary">⭐</Badge>}
                <Badge variant="secondary">
                  {t("profilePage.memberSince")} {new Date().getFullYear()}
                </Badge>
                {linkedWallet && (
                  <Badge variant="secondary" className="truncate max-w-[180px]">
                    <img src={tonIconUrl} className="w-3 h-3 mr-1" alt="" />
                    {linkedWallet.slice(0, 6)}…{linkedWallet.slice(-4)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.deposit")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("profilePage.depositPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
          <DialogFooter>
            <Button onClick={handleDeposit} disabled={busy || !address}>
              {busy ? "…" : t("wallet.deposit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.withdraw")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("profilePage.depositPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
          <DialogFooter>
            <Button onClick={handleWithdraw} disabled={busy}>
              {busy ? "…" : t("wallet.withdraw")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}