// client/src/components/profile/ProfileHeader.tsx
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Settings, ArrowLeft, Plus } from "lucide-react";
import tonIconUrl from "@/assets/icons/ton.svg?url";
import { useLanguage } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useTonWallet, useTonConnectUI } from "@tonconnect/ui-react";

const S = (v: unknown) => (typeof v === "string" ? v : "");
const initialFrom = (v: unknown) => {
  const s = S(v);
  return s ? s[0].toUpperCase() : "U";
};

async function ensureConnected(tonConnectUI: any, timeoutMs = 15000) {
  const addrNow = tonConnectUI?.wallet?.account?.address;
  if (addrNow) return addrNow;
  if (typeof tonConnectUI?.openModal === "function") await tonConnectUI.openModal();
  const start = Date.now();
  return await new Promise<string>((resolve, reject) => {
    const iv = setInterval(() => {
      const addr = tonConnectUI?.wallet?.account?.address;
      if (addr) {
        clearInterval(iv);
        resolve(addr);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error("Connection timeout"));
      }
    }, 250);
  });
}

function openDeepLink(url: string) {
  try {
    // @ts-ignore
    const twa = window?.Telegram?.WebApp;
    if (twa?.openTelegramLink) {
      twa.openTelegramLink(url);
      return;
    }
  } catch {}
  window.location.href = url;
}

export function ProfileHeader({
  telegramUser,
  onBack,
  onOpenSettings,
  walletBalance,
}: {
  telegramUser: any;
  onBack: () => void;
  onOpenSettings: () => void;
  walletBalance?: { balance: number; currency: string } | null;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  // Popup للرابط العميق
  const [deepOpen, setDeepOpen] = useState(false);
  const [deepUrl, setDeepUrl] = useState("");

  const address = useMemo(() => wallet?.account?.address || "", [wallet?.account?.address]);

  async function handleConnect() {
    try {
      setBusy(true);
      await ensureConnected(tonConnectUI);
    } catch (e: any) {
      toast({ title: t("toast.connectFailed"), description: e?.message || "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    try {
      setBusy(true);
      await tonConnectUI?.disconnect?.();
    } catch {}
    finally {
      setBusy(false);
    }
  }

  async function handleDeposit() {
    let resp: any;
    try {
      setBusy(true);
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        toast({ title: t("toast.invalidAmount"), variant: "destructive" });
        return;
      }

      // 1) طلب من السيرفر
      resp = await apiRequest("POST", "/api/wallet/deposit", { amount: amt });

      // 2) جرّب TonConnect
      try {
        await ensureConnected(tonConnectUI);
        const tx = resp?.deposit?.tonConnectTx;
        if (tx?.messages?.length) {
          const prepared = {
            validUntil:
              Number(tx.validUntil) > 0
                ? Number(tx.validUntil)
                : Math.floor(Date.now() / 1000) + 900,
            messages: tx.messages.map((m: any) => ({
              address: String(m.address),
              amount: String(m.amount),
              ...(m.payload ? { payload: String(m.payload) } : {}),
              ...(m.stateInit ? { stateInit: String(m.stateInit) } : {}),
            })),
          };
          await tonConnectUI.sendTransaction(prepared);
          toast({ title: t("toast.confirmDeposit") || "تم إرسال المعاملة." });
          setDepositOpen(false);
          setAmount("");
          return;
        }
        // لا رسائل → نعرض ديب لنك
        const deep = resp?.deposit?.tonDeepLink;
        if (deep) {
          setDeepUrl(deep);
          setDeepOpen(true);
          setDepositOpen(false);
          return;
        }
        throw new Error("no tx and no deeplink");
      } catch {
        // فشل TonConnect → نعرض ديب لنك
        const deep = resp?.deposit?.tonDeepLink;
        if (deep) {
          setDeepUrl(deep);
          setDeepOpen(true);
          setDepositOpen(false);
          return;
        }
        throw new Error("TonConnect and deeplink both unavailable");
      }
    } catch (e: any) {
      const msg = String(e?.message || "Transaction failed");
      toast({ title: "Deposit failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
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
                {(walletBalance?.balance ?? 0).toLocaleString()} {walletBalance?.currency || "TON"}
              </span>
              <button
                onClick={() => setDepositOpen(true)}
                className="ml-1 h-8 w-8 rounded-full bg-secondary grid place-items-center"
                aria-label="Deposit"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {!address ? (
              <div className="flex gap-2">
                <Button onClick={handleConnect} className="rounded-full px-5" disabled={busy}>
                  <img src={tonIconUrl} alt="" className="w-4 h-4 mr-2" />
                  {busy ? "…" : "Connect Wallet"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="truncate max-w-[200px]">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </Badge>
                <Button
                  onClick={handleDisconnect}
                  className="rounded-full px-4"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                >
                  Disconnect
                </Button>
              </div>
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
                <Badge variant="secondary">{new Date().getFullYear()}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog إدخال مبلغ */}
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
            <Button onClick={handleDeposit} disabled={busy}>
              {busy ? "…" : t("wallet.deposit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog عرض رابط الإيداع للموافقة */}
      <Dialog open={deepOpen} onOpenChange={setDeepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.deposit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">افتح الرابط للموافقة داخل محفظتك:</p>
            <div className="text-xs break-all rounded bg-muted p-2">{deepUrl}</div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              onClick={() => {
                if (deepUrl) openDeepLink(deepUrl);
              }}
            >
              فتح بالمحفظة
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(deepUrl || "");
                  toast({ title: "تم نسخ الرابط" });
                } catch {
                  toast({ title: "فشل نسخ الرابط", variant: "destructive" });
                }
              }}
            >
              نسخ الرابط
            </Button>
            <Button variant="ghost" onClick={() => setDeepOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}