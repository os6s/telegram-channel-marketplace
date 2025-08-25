// client/src/pages/sell/sellpage.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";
import { useQuery } from "@tanstack/react-query";

import UsernameForm from "./parts/UsernameForm";
import AccountForm from "./parts/AccountForm";
import ChannelForm from "./parts/ChannelForm";
import ServiceForm from "./parts/ServiceForm";
import {
  usernameSchema,
  accountSchema,
  channelSchema,
  serviceSchema
} from "./utils/schemas";

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
  const [platform, setPlatform] = useState<
    "telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "tiktok" | ""
  >("");

  useEffect(() => {
    try {
      telegramWebApp?.expand?.();
    } catch {}
  }, []);

  // ✅ 1. جلب المستخدم الحالي (me)
  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => await apiRequest("GET", "/api/me"),
    staleTime: 0,
    retry: false,
  });

  const schema = useMemo(() => getSchema(kind || ""), [kind]);

  const form = useForm<any>({
    resolver: schema ? zodResolver(schema) : undefined,
    mode: "onChange",
    shouldUnregister: true,
    defaultValues: {
      type: kind || undefined,
      platform: platform || "",
      // common
      price: "",
      currency: "TON",
      description: "",
      title: "",
      // username
      username: "",
      tgUserType: "",
      // account
      createdAt: "",
      followersCount: "",
      // channel
      channelMode: "subscribers",
      link: "",
      subscribersCount: "",
      giftsCount: "",
      giftKind: "regular",
      // service
      serviceType: "followers",
      target: "instagram",
      count: ""
    }
  });

  useEffect(() => {
    form.setValue("type", kind || undefined, { shouldValidate: true });
  }, [kind, form]);

  useEffect(() => {
    form.setValue("platform", platform || "", { shouldValidate: true });
  }, [platform, form]);

  const numericKeyGuard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End",
      "Enter",
      "."
    ];
    const isNumber = e.key >= "0" && e.key <= "9";
    if (!isNumber && !allowed.includes(e.key)) e.preventDefault();
  };

  // ✅ 2. تعديل submit لإرسال sellerId و sellerUsername
  const submit = async (data: any) => {
    if (!me?.id || !me?.username) {
      toast({
        title: t("toast.error") || "Error",
        description: "لازم تدخل من تيليجرام حتى نربط الإعلان بحسابك",
        variant: "destructive"
      });
      return;
    }

    const priceStr = String(data.price ?? "").replace(",", ".").trim();
    if (!priceStr) {
      toast({
        title: t("toast.error") || "Error",
        description: t("sell.price") || "Price required",
        variant: "destructive"
      });
      return;
    }

    let username = data.username;
    if (data.type === "channel") {
      username = normUsername(data.link || "");
    } else {
      username = normUsername(username || "");
    }

    const titleFallback =
      (data.title && String(data.title).trim()) ||
      (data.type === "channel"
        ? username
          ? `@${username}`
          : "Channel"
        : data.type === "username"
        ? username || "Username"
        : data.type === "account"
        ? `${data.platform || platform || ""} account`.trim()
        : `${data.serviceType || "service"} ${data.target || ""}`.trim());

    const basePayload: any = {
      sellerId: me.id,                // ✅
      sellerUsername: me.username,    // ✅
      kind: data.type || kind || "channel",
      platform: data.platform || platform || "telegram",
      channelMode: data.channelMode || "subscribers",
      username,
      title: titleFallback,
      price: priceStr,
      currency: data.currency || "TON",
      description: data.description || "",
      isActive: true
    };

    if (basePayload.kind === "channel") {
      basePayload.subscribersCount = data.subscribersCount ? Number(data.subscribersCount) : undefined;
      basePayload.giftsCount = data.giftsCount ? Number(data.giftsCount) : undefined;
      basePayload.giftKind = data.giftKind || "regular";
    }
    if (basePayload.kind === "account") {
      basePayload.followersCount = data.followersCount ? Number(data.followersCount) : undefined;
      basePayload.createdAt = data.createdAt || undefined;
      basePayload.tgUserType = data.tgUserType || undefined;
    }
    if (basePayload.kind === "service") {
      basePayload.serviceType = data.serviceType || "followers";
      basePayload.target = data.target || "instagram";
      basePayload.count = data.count ? Number(data.count) : undefined;
    }
    if (basePayload.kind === "username") {
      basePayload.tgUserType = data.tgUserType || undefined;
    }

    try {
      await apiRequest("POST", "/api/listings", basePayload);
      toast({ title: "OK", description: t("sell.sent") || "Sent" });
      form.reset();
      setKind(null);
      setPlatform("");
    } catch (e: any) {
      const msg = e?.message || e?.response?.data?.message || "Error";
      toast({
        title: t("toast.error") || "Error",
        description: msg,
        variant: "destructive"
      });
    }
  };

  // الخطوة 1
  if (!kind) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader>
          <CardTitle>{t("sell.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setKind("username")}>
            {t("sell.username")}
          </Button>
          <Button className="w-full" onClick={() => setKind("account")}>
            {t("sell.account")}
          </Button>
          <Button className="w-full" onClick={() => setKind("channel")}>
            {t("sell.channel")}
          </Button>
          <Button className="w-full" onClick={() => setKind("service")}>
            {t("sell.service")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // الخطوة 2: اختيار المنصة
  if ((kind === "username" || kind === "account") && !platform) {
    const list = ["telegram", "twitter", "instagram", "discord", "snapchat", "tiktok"];
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader>
          <CardTitle>{t("sell.platform")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((p) => (
            <Button
              key={p}
              className="w-full"
              variant={platform === p ? "default" : "outline"}
              onClick={() => setPlatform(p as any)}
            >
              {p}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setKind(null)}>
            {t("sell.back")}
          </Button>
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
              onClick={() => {
                setKind(null);
                setPlatform("");
                form.reset();
              }}
            >
              {t("sell.back")}
            </Button>
            <div className="ml-auto text-sm opacity-70">
              {kind} {platform && `· ${platform}`}
            </div>
          </div>

          {kind === "username" && <UsernameForm form={form} platform={platform} />}
          {kind === "account" && <AccountForm form={form} platform={platform} />}
          {kind === "channel" && <ChannelForm form={form} />}
          {kind === "service" && <ServiceForm form={form} />}

          <div className="grid grid-cols-3 gap-3">
            <FormField
              name="price"
              control={form.control}
              render={({ field }) => (
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
              )}
            />
            <FormField
              name="currency"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sell.currency")}</FormLabel>
                  <FormControl>
                    <select className="w-full rounded-md border px-3 py-2 bg-background text-foreground" {...field}>
                      <option value="TON">TON</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("sell.desc")}</FormLabel>
                <FormControl>
                  <Textarea {...field} className="bg-background" rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setKind(null);
                setPlatform("");
                form.reset();
              }}
            >
              {t("sell.back")}
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={form.formState.isSubmitting || !schema}
            >
              {t("sell.post")}
            </Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}