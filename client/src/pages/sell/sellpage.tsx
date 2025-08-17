// client/src/pages/sell.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import UsernameForm from "./parts/UsernameForm";
import AccountForm from "./parts/AccountForm";
import ChannelForm from "./parts/ChannelForm";
import ServiceForm from "./parts/ServiceForm";
import { usernameSchema, accountSchema, channelSchema, serviceSchema } from "./utils/schemas";

// ستور الماركت المحلي حتى تظهر المعروضات فورًا
import { upsertListing, type AnyListing } from "@/store/listings";

function getSchema(kind: string) {
  if (kind === "username") return usernameSchema;
  if (kind === "account") return accountSchema;
  if (kind === "channel") return channelSchema;
  if (kind === "service") return serviceSchema;
  return undefined as any;
}

export default function SellPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [kind, setKind] = useState<"username" | "account" | "channel" | "service" | null>(null);
  const [platform, setPlatform] = useState<"telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok" | "">("");

  useEffect(() => { try { telegramWebApp?.expand?.(); } catch {} }, []);

  const schema = useMemo(() => getSchema(kind || ""), [kind]);

  const form = useForm<any>({
    resolver: schema ? zodResolver(schema) : undefined,
    mode: "onChange",
    shouldUnregister: true,
    defaultValues: {
      type: kind || undefined,
      platform: platform || "",
      // common
      price: "", currency: "TON", description: "",
      // username
      username: "", tgUserType: "",
      // account
      createdAt: "", followersCount: "",
      // channel
      channelMode: "subscribers", link: "", channelUsername: "",
      subscribersCount: "", giftsCount: "", giftKind: "regular",
      // service
      serviceType: "followers", target: "instagram", count: "",
    },
  });

  useEffect(() => {
    form.setValue("type", kind || undefined, { shouldValidate: true });
  }, [kind, form]);

  useEffect(() => {
    form.setValue("platform", platform || "", { shouldValidate: true });
  }, [platform, form]);

  const numericKeyGuard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End","Enter","."];
    const isNumber = e.key >= "0" && e.key <= "9";
    if (!isNumber && !allowed.includes(e.key)) e.preventDefault();
  };

  const submit = async (data: any) => {
    if (!telegramWebApp?.user) {
      toast({ title: t("toast.error") || "Error", description: t("sell.openFromTelegram"), variant: "destructive" });
      return;
    }

    const sellerId = String(telegramWebApp.user.id);
    const payload: any = { ...data, telegramId: sellerId };

    // توحيد حقول القناة
    if (data.type === "channel") {
      payload.username = (data.channelUsername || data.link || "").trim();
      delete payload.link;
      delete payload.channelUsername;
    }

    // حفظ على السيرفر
    const url = data.type === "channel" ? "/api/sell" : "/api/listings";
    try {
      const saved = await apiRequest("POST", url, payload); // يُفضّل أن يرجّع {id,...}
      toast({ title: "OK", description: t("sell.sent") });

      // دفع نسخة محلية للماركت فورًا
      const local: AnyListing = {
        id: String(saved?.id || `local_${Date.now()}`),
        kind: data.type,
        platform: data.platform || platform || "",
        channelMode: data.channelMode,
        serviceType: data.serviceType,
        price: data.price,
        subscribers: Number(data.subscribersCount || 0),
        name: data.name,                // إن وُجدت من أحد الفورمات
        username: data.username || payload.username,
        title: data.title,              // إن وُجدت
        isVerified: !!data.isVerified,
        sellerId,
        createdAt: new Date().toISOString(),
        // أي حقول أخرى يحتاجها ChannelCard تُمرّر هنا
      };
      upsertListing(local);

      form.reset(); setKind(null); setPlatform("");
    } catch (e: any) {
      toast({ title: t("toast.error") || "Error", description: e?.message || "Error", variant: "destructive" });
    }
  };

  // الخطوة 1
  if (!kind) {
    return (
      <Card className="min-h-screen bg-card text-foreground">
        <CardHeader>
          <CardTitle>{t("sell.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Button className="w-full" onClick={() => setKind("username")}>{t("sell.username")}</Button>
          <Button className="w-full" onClick={() => setKind("account")}>{t("sell.account")}</Button>
          <Button className="w-full" onClick={() => setKind("channel")}>{t("sell.channel")}</Button>
          <Button className="w-full" onClick={() => setKind("service")}>{t("sell.service")}</Button>
        </CardContent>
      </Card>
    );
  }

  // الخطوة 2: اختيار المنصّة لليوزر/الحساب
  if ((kind === "username" || kind === "account") && !platform) {
    const list = ["telegram","twitter","instagram","discord","snapchat","tiktok"];
    return (
      <Card className="min-h-screen bg-card text-foreground">
        <CardHeader>
          <CardTitle>{t("sell.platform")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {list.map(p => (
            <Button
              key={p}
              className="w-full"
              variant={platform === p ? "default" : "outline"}
              onClick={() => setPlatform(p as any)}
            >
              {p}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setKind(null)}>{t("sell.back")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form key={`form-${kind || "none"}`} {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="min-h-screen p-4 bg-background text-foreground">
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setKind(null); setPlatform(""); form.reset(); }}
              >
                {t("sell.back")}
              </Button>
              <CardTitle className="ml-2">{t("sell.title")}</CardTitle>
              <div className="ml-auto text-sm text-muted-foreground">
                {kind} {platform && `· ${platform}`}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* الأجزاء */}
            {kind === "username" && <UsernameForm form={form} platform={platform} />}
            {kind === "account"  && <AccountForm  form={form} platform={platform} />}
            {kind === "channel"  && <ChannelForm  form={form} />}
            {kind === "service"  && <ServiceForm  form={form} />}

            {/* السعر + العملة + الوصف */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField name="price" control={form.control} render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t("sell.price")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="decimal"
                      placeholder="0.0"
                      className="bg-background"
                      onKeyDown={numericKeyGuard}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="currency" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sell.currency")}</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full rounded-md border px-3 py-2 bg-background text-foreground">
                      <option value="TON">TON</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>{t("sell.desc")}</FormLabel>
                <FormControl>
                  <Textarea {...field} className="bg-background" rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setKind(null); setPlatform(""); form.reset(); }}
              >
                {t("sell.back")}
              </Button>
              <Button type="submit" variant="default" disabled={form.formState.isSubmitting || !schema}>
                {t("sell.post")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}