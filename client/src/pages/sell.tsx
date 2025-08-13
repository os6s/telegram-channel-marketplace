// client/src/pages/sell.tsx
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";

/* ---------- utils ---------- */
const normalizeUsername = (s: string) =>
  String(s || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^t\.me\//i, "")
    .toLowerCase();

/* Telegram usernames: 4–15, letters/digits/underscore only (NO dot) */
const RE_TG_USER = /^[a-z0-9_]{4,15}$/;

/* Generic usernames (twitter/instagram/discord/snapchat): 2–15, letters/digits/_/dot */
const RE_GENERIC_USER = /^[a-z0-9._]{2,15}$/;

/* Price: numeric up to 9 decimals */
const RE_PRICE = /^\d+(\.\d{1,9})?$/;

const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";

/* ---------- i18n ---------- */
const T = {
  ar: {
    title: "بيع / Sell",
    chooseType: "اختر نوع الإعلان",
    sellUsername: "بيع يوزر",
    sellAccount: "بيع حساب",
    sellChannel: "بيع",
    sellService: "بيع خدمة",
    platform: "المنصة",
    choosePlatform: "اختر المنصة",
    usernameLabel: "اسم/رابط (بدون @ أو t.me/)",
    tgInvalid: "اسم تيليجرام غير صالح: 4-15 حروف/أرقام و _ فقط، بدون .",
    genInvalid: "اسم غير صالح: 2-15 حروف/أرقام و _ و .",
    tgUserType: "نوع اليوزر",
    NFT: "NFT",
    NORMAL: "عادي",
    price: "السعر",
    currency: "العملة",
    desc: "الوصف (اختياري)",
    post: "نشر",
    back: "رجوع",
    openFromTelegram: "افتح من تيليجرام",
    sent: "تم إرسال الإعلان",
    channelMode: "نوع القناة",
    modeSubscribers: "قناة مشتركين",
    modeGifts: "قناة هدايا",
    channelLinkOpt: "رابط القناة (اختياري)",
    channelUserOpt: "يوزر القناة (اختياري)",
    needLinkOrUser: "أدخل رابط أو يوزر",
    subsCount: "عدد المشتركين",
    giftsCount: "عدد الهدايا",
    giftKind: "نوع الهدايا",
    upgraded: "مطوّرة",
    regular: "غير مطوّرة",
    both: "الاثنان",
    serviceType: "نوع الخدمة",
    followers: "متابعين",
    members: "مشتركين",
    boostCh: "تعزيز قناة تيليجرام",
    boostGp: "تعزيز مجموعة تيليجرام",
    target: "الهدف",
    count: "العدد",
  },
  en: {
    title: "بيع / Sell",
    chooseType: "Choose listing type",
    sellUsername: "Sell Username",
    sellAccount: "Sell Account",
    sellChannel: "Sell",
    sellService: "Sell Service",
    platform: "Platform",
    choosePlatform: "Choose platform",
    usernameLabel: "Username/Link (without @ or t.me/)",
    tgInvalid: "Invalid Telegram: 4–15 letters/digits/_ only, no dot.",
    genInvalid: "Invalid: 2–15 letters/digits/_/dot.",
    tgUserType: "Username type",
    NFT: "NFT",
    NORMAL: "Normal",
    price: "Price",
    currency: "Currency",
    desc: "Description (optional)",
    post: "Publish",
    back: "Back",
    openFromTelegram: "Open from Telegram",
    sent: "Listing submitted",
    channelMode: "Channel mode",
    modeSubscribers: "Subscribers channel",
    modeGifts: "Gifts channel",
    channelLinkOpt: "Channel link (optional)",
    channelUserOpt: "Channel username (optional)",
    needLinkOrUser: "Enter link or username",
    subsCount: "Subscribers count",
    giftsCount: "Gifts count",
    giftKind: "Gift kind",
    upgraded: "Upgraded",
    regular: "Regular",
    both: "Both",
    serviceType: "Service type",
    followers: "Followers",
    members: "Members",
    boostCh: "Boost Telegram Channel",
    boostGp: "Boost Telegram Group",
    target: "Target",
    count: "Count",
  },
};

/* ---------- schemas ---------- */
const baseCommon = {
  price: z.string().regex(RE_PRICE, "Invalid price"),
  currency: z.enum(["TON", "USDT"]),
  description: z.string().optional(),
};

const usernameSchema = z
  .object({
    type: z.literal("username"),
    platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat"]),
    username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().min(1)),
    tgUserType: z.enum(["NFT", "NORMAL"]).optional(), // Telegram only
    ...baseCommon,
  })
  .superRefine((val, ctx) => {
    const u = String(val.username || "");
    if (val.platform === "telegram") {
      if (!RE_TG_USER.test(u)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TG_INVALID", path: ["username"] });
    } else {
      if (!RE_GENERIC_USER.test(u)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GEN_INVALID", path: ["username"] });
    }
  });

const accountSchema = z.object({
  type: z.literal("account"),
  platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().regex(RE_GENERIC_USER, "GEN_INVALID")),
  createdAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM"),
  followersCount: z.coerce.number().min(0).optional(),
  ...baseCommon,
});

const channelSchema = z
  .object({
    type: z.literal("channel"),
    channelMode: z.enum(["subscribers", "gifts"]),
    link: z.string().optional(),
    channelUsername: z.string().optional(), // username-only
    subscribersCount: z.coerce.number().min(1).optional(),
    giftsCount: z.coerce.number().min(1).optional(),
    giftKind: z.enum(["upgraded", "regular", "both"]).optional(),
    ...baseCommon,
  })
  .superRefine((val, ctx) => {
    const link = val.link?.trim();
    const uname = val.channelUsername?.trim();
    if (!link && !uname) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NEED_LINK_OR_USER", path: ["link"] });
      return;
    }
    const candidate = normalizeUsername(link || uname || "");
    if (!RE_TG_USER.test(candidate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TG_INVALID", path: link ? ["link"] : ["channelUsername"] });
    }
    if (val.channelMode === "subscribers") {
      if (!val.subscribersCount || Number(val.subscribersCount) < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SUBS_REQUIRED", path: ["subscribersCount"] });
      }
    } else {
      if (!val.giftsCount || Number(val.giftsCount) < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GIFTS_REQUIRED", path: ["giftsCount"] });
      }
      if (!val.giftKind) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GIFT_KIND_REQUIRED", path: ["giftKind"] });
      }
    }
  });

/* خدمة بدون رابط. نوع الخدمة يحدد الهدف والعدد فقط */
const serviceSchema = z.object({
  type: z.literal("service"),
  serviceType: z.enum(["followers", "members", "boost_channel", "boost_group"]),
  target: z.enum(["instagram", "twitter", "telegram_channel", "telegram_group"]),
  count: z.coerce.number().min(1),
  ...baseCommon,
});

function getSchema(kind: string) {
  if (kind === "username") return usernameSchema;
  if (kind === "account") return accountSchema;
  if (kind === "channel") return channelSchema;
  if (kind === "service") return serviceSchema;
  return z.any();
}

/* ---------- component ---------- */
export default function SellPage() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = language === "ar" ? T.ar : T.en;

  const [kind, setKind] = useState<"username" | "account" | "channel" | "service" | null>(null);
  const [platform, setPlatform] = useState<"telegram" | "twitter" | "instagram" | "discord" | "snapchat" | "">("");

  useEffect(() => {
    try { telegramWebApp?.expand?.(); } catch {}
  }, []);

  const schema = useMemo(() => getSchema(kind || ""), [kind]);

  const form = useForm<any>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      type: kind || undefined,
      platform: platform || "",
      username: "",
      tgUserType: "",
      // channel
      channelMode: "subscribers",
      link: "",
      channelUsername: "",
      subscribersCount: "",
      giftsCount: "",
      giftKind: "regular",
      // service
      serviceType: "followers",
      target: "instagram",
      count: "",
      // common
      price: "",
      currency: "TON",
      description: "",
      // account
      createdAt: "",
      followersCount: "",
    },
  });

  useEffect(() => {
    const v = form.getValues();
    form.reset({ ...v, type: kind || undefined, platform: platform || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, platform]);

  const numericKeyGuard = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End", "Enter", "."];
    const isNumber = e.key >= "0" && e.key <= "9";
    if (!isNumber && !allowed.includes(e.key)) e.preventDefault();
  };

  const submit = async (data: any) => {
    if (!telegramWebApp?.user) {
      toast({ title: "خطأ", description: L.openFromTelegram, variant: "destructive" });
      return;
    }

    try {
      const payload = { ...data, telegramId: telegramWebApp.user.id };

      if (data.type === "channel") {
        const unified = normalizeUsername(data.link || data.channelUsername || "");
        payload.username = unified; // ما يتقبل dot، regex تحققها فوق
        delete payload.link;
        delete payload.channelUsername;
      }

      const url = data.type === "channel" ? "/api/sell" : "/api/listings";
      const r = await apiRequest("POST", url, payload);
      if (!r.ok) throw new Error((await r.json()).error || "Error");

      toast({ title: "OK", description: L.sent });
      form.reset();
      setKind(null);
      setPlatform("");
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message ?? "مشكلة", variant: "destructive" });
    }
  };

  /* ---------- UI ---------- */

  if (!kind) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setKind("username")}>{L.sellUsername}</Button>
          <Button className="w-full" onClick={() => setKind("account")}>{L.sellAccount}</Button>
          <Button className="w-full" onClick={() => setKind("channel")}>{L.sellChannel}</Button>
          <Button className="w-full" onClick={() => setKind("service")}>{L.sellService}</Button>
        </CardContent>
      </Card>
    );
  }

  // اختيار المنصة لليوزر/الحساب
  if ((kind === "username" || kind === "account") && !platform) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.choosePlatform}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {["telegram", "twitter", "instagram", "discord", "snapchat"].map((p) => (
            <Button key={p} className="w-full bg-background border" onClick={() => setPlatform(p as any)}>
              {p}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setKind(null)}>{L.back}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 min-h-screen p-4">
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setKind(null); setPlatform(""); form.reset(); }}
            >
              {L.back}
            </Button>
            <div className="ml-auto text-sm opacity-70">
              {kind} {platform && `· ${platform}`}
            </div>
          </div>

          {/* بيع يوزر */}
          {kind === "username" && (
            <>
              <FormField
                name="platform"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.platform}</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly value={platform} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="username"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.usernameLabel}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="username"
                        className="bg-background"
                        onBlur={(e) => field.onChange(normalizeUsername(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.username?.message === "TG_INVALID"
                        ? L.tgInvalid
                        : form.formState.errors.username?.message === "GEN_INVALID"
                        ? L.genInvalid
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
              {platform === "telegram" && (
                <FormField
                  name="tgUserType"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{L.tgUserType}</FormLabel>
                      <FormControl>
                        <select {...field} className={selectCls}>
                          <option value=""></option>
                          <option value="NFT">{L.NFT}</option>
                          <option value="NORMAL">{L.NORMAL}</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          {/* بيع حساب */}
          {kind === "account" && (
            <>
              <FormField
                name="platform"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.platform}</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly value={platform} className="bg-background" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="username"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.usernameLabel}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="handle"
                        className="bg-background"
                        onBlur={(e) => field.onChange(normalizeUsername(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.username?.message === "GEN_INVALID" ? L.genInvalid : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                name="createdAt"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YYYY-MM</FormLabel>
                    <FormControl><Input type="month" {...field} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(platform === "twitter" || platform === "instagram") && (
                <FormField
                  name="followersCount"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "ar" ? "عدد المتابعين" : "Followers count"}</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} className="bg-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </>
          )}

          {/* بيع قناة تيليجرام */}
          {kind === "channel" && (
            <>
              <FormField
                name="channelMode"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.channelMode}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className={selectCls}
                        onChange={(e) => {
                          field.onChange(e);
                          form.setValue("subscribersCount", "");
                          form.setValue("giftsCount", "");
                        }}
                      >
                        <option value="subscribers">{L.modeSubscribers}</option>
                        <option value="gifts">{L.modeGifts}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="link"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.channelLinkOpt}</FormLabel>
                    <FormControl><Input {...field} className="bg-background" placeholder="t.me/yourchannel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="channelUsername"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.channelUserOpt}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-background"
                        placeholder="yourchannel"
                        onBlur={(e) => field.onChange(normalizeUsername(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.link?.message === "NEED_LINK_OR_USER" ||
                      form.formState.errors.channelUsername?.message === "NEED_LINK_OR_USER"
                        ? L.needLinkOrUser
                        : form.formState.errors.link?.message === "TG_INVALID" ||
                          form.formState.errors.channelUsername?.message === "TG_INVALID"
                        ? L.tgInvalid
                        : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
              {form.watch("channelMode") === "subscribers" ? (
                <FormField
                  name="subscribersCount"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{L.subsCount}</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    name="giftsCount"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{L.giftsCount}</FormLabel>
                        <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="giftKind"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{L.giftKind}</FormLabel>
                        <FormControl>
                          <select {...field} className={selectCls}>
                            <option value="upgraded">{L.upgraded}</option>
                            <option value="regular">{L.regular}</option>
                            <option value="both">{L.both}</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </>
          )}

          {/* بيع خدمة بدون رابط */}
          {kind === "service" && (
            <>
              <FormField
                name="serviceType"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.serviceType}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className={selectCls}
                        onChange={(e) => {
                          field.onChange(e);
                          const v = e.target.value;
                          if (v === "followers") form.setValue("target", "instagram");
                          else if (v === "members") form.setValue("target", "telegram_channel");
                          else if (v === "boost_channel") form.setValue("target", "telegram_channel");
                          else if (v === "boost_group") form.setValue("target", "telegram_group");
                        }}
                      >
                        <option value="followers">{L.followers}</option>
                        <option value="members">{L.members}</option>
                        <option value="boost_channel">{L.boostCh}</option>
                        <option value="boost_group">{L.boostGp}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="target"
                control={form.control}
                render={({ field }) => {
                  const st = form.watch("serviceType");
                  const opts =
                    st === "followers" ? ["instagram", "twitter"] :
                    st === "members" ? ["telegram_channel"] :
                    st === "boost_channel" ? ["telegram_channel"] :
                    st === "boost_group" ? ["telegram_group"] : [];
                  return (
                    <FormItem>
                      <FormLabel>{L.target}</FormLabel>
                      <FormControl>
                        <select {...field} className={selectCls}>
                          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                name="count"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.count}</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* السعر + العملة + الوصف (مشترك لكل الأقسام) */}
          <div className="grid grid-cols-3 gap-3">
            <FormField
              name="price"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{L.price}</FormLabel>
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
                  <FormLabel>{L.currency}</FormLabel>
                  <FormControl>
                    <select {...field} className={selectCls}>
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
                <FormLabel>{L.desc}</FormLabel>
                <FormControl><Textarea {...field} className="bg-background" rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => { setKind(null); setPlatform(""); form.reset(); }}>
              {L.back}
            </Button>
            <Button type="submit" disabled={!form.formState.isValid}>{L.post}</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}