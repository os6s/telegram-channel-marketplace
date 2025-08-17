// client/src/pages/sell/sellpage.tsx
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

function getSchema(kind: string) {
  if (kind === "username") return usernameSchema;
  if (kind === "account") return accountSchema;
  if (kind === "channel") return channelSchema;
  if (kind === "service") return serviceSchema;
  return undefined as any;
}

function normUsername(v: string) {
  return String(v || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();
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
    const sellerId = localStorage.getItem("sellerId");
    if (!sellerId) {
      toast({ title: t("toast.error") || "Error", description: "افتح الميني-أب من تيليجرام أولًا لتسجيل المستخدم", variant: "destructive" });
      return;
    }
    const priceStr = String(data.price ?? "").replace(",", ".").trim();
    if (!priceStr) {
      toast({ title: t("toast.error") || "Error", description: t("sell.price") || "Price required", variant: "destructive" });
      return;
    }

    // توحيد اسم القناة
    let username = data.username;
    if (data.type === "channel") {
      username = normUsername(data.channelUsername || data.link || data.username || "");
    } else {
      username = normUsername(username || "");
    }

    const payload: any = {
      sellerId,                              // ← الأهم
      kind: data.type || kind || "channel",
      platform: data.platform || platform || "telegram",
      channelMode: data.channelMode || "subscribers",
      username,
      title: data.title,
      subscribers: data.subscribersCount ? Number(data.subscribersCount) : undefined,
      price: priceStr,
      currency: data.currency || "TON",
      description: data.description || "",
      isVerified: false,
    };

    const url = "/api/listings"; // موحّد
    try {
      await apiRequest("POST", url, payload);
      toast({ title: "OK", description: t("sell.sent") });
      form.reset(); setKind(null); setPlatform("");
    } catch (e: any) {
      toast({ title: t("toast.error") || "Error", description: e?.message || "Error", variant: "destructive" });
    }
  };

  // الخطوة 1
  if (!kind) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{t("sell.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{t("sell.platform")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 min-h-screen p-4">
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setKind(null); setPlatform(""); form.reset(); }}
            >
              {t("sell.back")}
            </Button>
            <div className="ml-auto text-sm opacity-70">
              {kind} {platform && `· ${platform}`}
            </div>
          </div>

          {kind === "username" && <UsernameForm form={form} platform={platform} />}
          {kind === "account"  && <AccountForm  form={form} platform={platform} />}
          {kind === "channel"  && <ChannelForm  form={form} />}
          {kind === "service"  && <ServiceForm  form={form} />}

          <div className="grid grid-cols-3 gap-3">
            <FormField name="price" control={form.control} render={({ field }) => (
              <FormItem className="col-span-2">
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
        </Card>
      </form>
    </Form>
  );
}