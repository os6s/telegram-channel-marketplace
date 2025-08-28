// client/src/components/profile/ProfileHeader.tsx
import { useState, useEffect, useMemo } from "react";
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
import { useTonWallet, useTonConnectUI } from "@tonconnect/ui-react";
import { useWalletAddress } from "@/hooks/use-wallet";
import { beginCell } from "@ton/ton"; // ⬅️ لإضافة تعليق "For TG Marketplace"

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => { const s = S(v); return s ? s[0].toUpperCase() : "U"; };

// ✅ لا يفتح المودال إلا إذا غير متصل
async function waitForConnect(tonConnectUI: any, timeoutMs = 15000) {
  const addrNow = tonConnectUI?.wallet?.account?.address;
  if (addrNow) return addrNow;

  if (typeof tonConnectUI?.openModal === "function") {
    await tonConnectUI.openModal();
  }

  const start = Date.now();
  return await new Promise<string>((resolve, reject) => {
    const iv = setInterval(() => {
      const addr = tonConnectUI?.wallet?.account?.address;
      if (addr) { clearInterval(iv); resolve(addr); }
      else if (Date.now() - start > timeoutMs) { clearInterval(iv); reject(new Error("Connection timeout")); }
    }, 250);
  });
}

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
  const { data: linkedWallet, updateWallet } = useWalletAddress();

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const address = useMemo(() => wallet?.account?.address || "", [wallet?.account?.address]);

  useEffect(() => { if (address) updateWallet(address); }, [address, updateWallet]);

  async function handleConnect() {
    try {
      setBusy(true);
      const addr = await waitForConnect(tonConnectUI);
      if (!addr) throw new Error("Wallet not connected");
      updateWallet(addr);
    } catch (e: any) {
      toast({ title: t("toast.connectFailed"), description: e?.message || "", variant: "destructive" });
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
    let r: any;
    let tx: any;

    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }

      // ✅ لا تستدعِ waitForConnect إذا كان متصلاً أصلاً
      const isConnected = !!tonConnectUI?.wallet?.account?.address;
      if (!isConnected) {
        const addr = await waitForConnect(tonConnectUI);
        if (!addr) throw new Error("Wallet not connected");
      }

      // تحقق توافق الشبكة
      const appNet = (import.meta as any).env?.VITE_TON_NETWORK === "TESTNET" ? "TESTNET" : "MAINNET";
      const chain = tonConnectUI?.wallet?.account?.chain; // "-239" mainnet, "-3" testnet
      const walletNet = chain === "-3" ? "TESTNET" : "MAINNET";
      if (walletNet !== appNet) throw new Error(`Wallet on ${walletNet}. Switch to ${appNet}.`);

      // اطلب تهيئة الإرسال من السيرفر
      r = await apiRequest("POST", "/api/wallet/deposit/initiate", { amountTon: amt });
      console.log("Deposit txPayload (raw):", r?.txPayload);

      // ✅ تحضير آمن مع مهلة أكبر والتحقق من وجود رسائل
      const raw = r?.txPayload || {};
      const messages = Array.isArray(raw.messages) ? raw.messages : [];
      if (messages.length === 0) throw new Error("No messages in txPayload");

      tx = {
        validUntil: Number(raw.validUntil) > 0 ? Number(raw.validUntil) : Math.floor(Date.now() / 1000) + 900, // 15m
        messages: messages.map((m: any) => ({
          address: String(m.address),
          amount: String(m.amount),
          ...(m.payload   ? { payload:   String(m.payload) }   : {}),
          ...(m.stateInit ? { stateInit: String(m.stateInit) } : {}),
        })),
      };

      // ⬇️ إضافة تعليق "For TG Marketplace" إذا ماكو payload بالرسالة
      const commentCell = beginCell()
        .storeUint(0, 32) // comment opcode
        .storeStringTail("For TG Marketplace")
        .endCell();
      const commentB64 = commentCell.toBoc().toString("base64");

      tx.messages = tx.messages.map((m: any) =>
        m.payload ? m : { ...m, payload: commentB64 }
      );

      console.log("Deposit txPayload (normalized + comment):", tx);

      // ✅ إرسال مرة واحدة فقط
      await tonConnectUI.sendTransaction(tx);
      toast({ title: t("toast.confirmDeposit") });

      // تتبّع التأكيد
      const poll = async () => {
        const status = await apiRequest("POST", "/api/wallet/deposit/status", { code: r.code, minTon: amt });
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
      // احتمال unlink
      if (String(e?.message || "").toLowerCase().includes("unlinked")) {
        try { await tonConnectUI?.disconnect(); } catch {}
      }

      const normalizeError = (err: any) => {
        if (!err) return { name: "UnknownError", message: "Empty rejection from SDK" };
        if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
        const msg = String(err?.message || err?.reason || err?.toString?.() || "Unknown");
        const name = String(err?.name || "SDKError");
        return { name, message: msg, raw: err };
      };

      const details = normalizeError(e);
      const safe = (_k: string, v: any) => (typeof v === "bigint" ? v.toString() : v);

      console.log("[TON] wallet account:", tonConnectUI?.wallet?.account);
      console.log("[TON] last txPayload (raw):", r?.txPayload);
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
          init: r,
          wallet: tonConnectUI?.wallet?.account,
          url: window.location.href,
          ua: navigator.userAgent,
          ts: new Date().toISOString(),
        }),
      });

      const msgShort = details.message || "Transaction failed";
      toast({ title: "Deposit failed", description: msgShort, variant: "destructive" });
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
                <Badge variant="secondary">{t("profilePage.memberSince")} {new Date().getFullYear()}</Badge>
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