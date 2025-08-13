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

const re_tg_username_4_15_alnum = /^[a-z0-9]{4,15}$/;         // تيليجرام: 4-15 حروف/أرقام فقط
const re_generic_username_5_32 = /^[a-z0-9_]{5,32}$/;          // عام: 5-32 حروف/أرقام/_
const re_price = /^\d+(\.\d{1,9})?$/;

const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";

/* ---------- i18n ---------- */
const LBL = {
  ar: {
    chooseType: "اختر نوع الإعلان",
    sellUsername: "بيع يوزر",
    sellAccount: "بيع حساب",
    sellChannel: "بيع قناة",
    sellService: "بيع خدمة",
    platform: "المنصة",
    choosePlatform: "اختر المنصة",
    username: "اسم المستخدم / رابط (بدون @ أو t.me/)",
    invalidTgUser: "اسم غير صالح: 4-15 حروف/أرقام",
    invalidGenericUser: "اسم غير صالح: 5-32 حروف/أرقام/أندرلاين",
    tgUserType: "نوع اليوزر",
    NFT: "NFT",
    normal: "عادي",
    price: "السعر",
    currency: "العملة",
    desc: "الوصف (اختياري)",
    post: "نشر",
    back: "رجوع",
    serviceType: "نوع الخدمة",
    followers: "متابعين",
    members: "مشتركين",
    boostChannel: "تعزيز قناة تيليجرام",
    boostGroup: "تعزيز مجموعة تيليجرام",
    target: "الهدف",
    count: "العدد",
    channelLink: "رابط القناة / المجموعة",
    createdAt: "تاريخ إنشاء الحساب (سنة-شهر)",
    followersCount: "عدد المتابعين",
    channelMode: "نوع القناة",
    modeSubscribers: "قناة مشتركين",
    modeGifts: "قناة هدايا",
    giftsCount: "عدد الهدايا",
    giftKind: "نوع الهدايا",
    upgraded: "مطوّرة",
    regular: "غير مطوّرة",
    both: "الإثنان معًا",
    openFromTelegram: "افتح من تيليجرام",
    sent: "تم إرسال الإعلان",
    pendingBackend: "النوع يحتاج مسار /api/listings في الباك إند",
  },
  en: {
    chooseType: "Choose listing type",
    sellUsername: "Sell Username",
    sellAccount: "Sell Account",
    sellChannel: "Sell Channel",
    sellService: "Sell Service",
    platform: "Platform",
    choosePlatform: "Choose platform",
    username: "Username / Link (without @ or t.me/)",
    invalidTgUser: "Invalid: 4–15 letters/digits",
    invalidGenericUser: "Invalid: 5–32 letters/digits/underscore",
    tgUserType: "Username type",
    NFT: "NFT",
    normal: "Normal",
    price: "Price",
    currency: "Currency",
    desc: "Description (optional)",
    post: "Publish",
    back: "Back",
    serviceType: "Service type",
    followers: "Followers",
    members: "Members",
    boostChannel: "Boost Telegram Channel",
    boostGroup: "Boost Telegram Group",
    target: "Target",
    count: "Count",
    channelLink: "Channel / Group link",
    createdAt: "Account creation (YYYY-MM)",
    followersCount: "Followers count",
    channelMode: "Channel mode",
    modeSubscribers: "Subscribers channel",
    modeGifts: "Gifts channel",
    giftsCount: "Gifts count",
    giftKind: "Gift kind",
    upgraded: "Upgraded",
    regular: "Regular",
    both: "Both",
    openFromTelegram: "Open from Telegram",
    sent: "Listing submitted",
    pendingBackend: "This type needs /api/listings backend",
  },
};

/* ---------- schemas ---------- */
const baseSchema = z.object({
  type: z.enum(["username", "account", "channel", "service"]),
  price: z.string().regex(re_price, "Invalid price"),
  currency: z.enum(["TON", "USDT"]),
  description: z.string().optional(),
});

// بيع يوزر
const usernameSchema = baseSchema.extend({
  platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().min(1)),
  tgUserType: z.enum(["NFT", "NORMAL"]).optional(), // يظهر فقط عندما platform = telegram
}).superRefine((val, ctx) => {
  const u = String(val.username || "");
  if (val.platform === "telegram") {
    if (!re_tg_username_4_15_alnum.test(u)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "TG_4_15", path: ["username"] });
    }
  } else {
    if (!re_generic_username_5_32.test(u)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "GENERIC_5_32", path: ["username"] });
    }
  }
});

// بيع حساب
const accountSchema = baseSchema.extend({
  platform: z.enum(["twitter", "instagram", "discord", "snapchat"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")), z.string().regex(re_generic_username_5_32, "GENERIC_5_32")),
  createdAt: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM"),
  followersCount: z.coerce.number().min(0).optional(),
});

// بيع قناة (نمطين)
const channelSchema = baseSchema.extend({
  channelMode: z.enum(["subscribers", "gifts"]),
  link: z.string().min(1, "required"),
  subscribersCount: z.coerce.number().min(1).optional(),
  giftsCount: z.coerce.number().min(1).optional(),
  giftKind: z.enum(["upgraded", "regular", "both"]).optional(),
});

// بيع خدمة بدون رابط
const serviceSchema = baseSchema.extend({
  serviceType: z.enum(["followers", "members", "boost_channel", "boost_group"]),
  target: z.enum(["instagram", "twitter", "telegram_channel", "telegram_group"]),
  count: z.coerce.number().min(1),
});

function getSchema(kind: string) {
  if (kind === "username") return usernameSchema;
  if (kind === "account") return accountSchema;
  if (kind === "channel") return channelSchema;
  if (kind === "service") return serviceSchema;
  return baseSchema;
}

/* ---------- component ---------- */
export default function SellPage() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const T = language === "ar" ? LBL.ar : LBL.en;

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
      tgUserType: undefined,
      price: "",
      currency: "TON",
      description: "",
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
      serviceType: "",
      target: "",
      count: "",
    },
  });

  useEffect(() => {
    const v = form.getValues();
    form.reset({ ...v, type: kind || undefined, platform: platform || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, platform]);

  const submit = async (data: any) => {
    if (!telegramWebApp?.user) {
      toast({ title: "خطأ", description: T.openFromTelegram, variant: "destructive" });
      return;
    }
    try {
      const payload = { ...data, telegramId: telegramWebApp.user.id };
      const isChannel = data.type === "channel";
      const url = isChannel ? "/api/sell" : "/api/listings"; // listings للأنواع الأخرى
      const r = await apiRequest("POST", url, payload);
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      toast({ title: "OK", description: T.sent });
      form.reset();
      setKind(null);
      setPlatform("");
    } catch (e: any) {
      toast({ title: "خطأ", description: e?.message ?? "مشكلة", variant: "destructive" });
    }
  };

  // منع الأحرف في السعر
  const onlyNumericKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowed = [
      "Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End","Enter","."
    ];
    const isNumber = e.key >= "0" && e.key <= "9";
    if (!isNumber && !allowed.includes(e.key)) e.preventDefault();
  };

  /* ---------- UI ---------- */

  if (!kind) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{T.chooseType}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setKind("username")}>{T.sellUsername}</Button>
          <Button className="w-full" onClick={() => setKind("account")}>{T.sellAccount}</Button>
          <Button className="w-full" onClick={() => setKind("channel")}>{T.sellChannel}</Button>
          <Button className="w-full" onClick={() => setKind("service")}>{T.sellService}</Button>
        </CardContent>
      </Card>
    );
  }

  // اختيار منصة لليوزر/الحساب
  if ((kind === "username" || kind === "account") && !platform) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{T.choosePlatform}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {["telegram","twitter","instagram","discord","snapchat"].map((p) => (
            <Button key={p} className="w-full bg-background border" onClick={() => setPlatform(p as any)}>
              {p}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setKind(null)}>{T.back}</Button>
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
              {T.back}
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
                    <FormLabel>{T.platform}</FormLabel>
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
                    <FormLabel>{T.username}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="username"
                        className="bg-background"
                        onBlur={(e) => field.onChange(normalizeUsername(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.username?.message === "TG_4_15" ? T.invalidTgUser :
                       form.formState.errors.username?.message === "GENERIC_5_32" ? T.invalidGenericUser : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              {/* نوع اليوزر فقط عند تيليجرام: NFT / عادي */}
              {platform === "telegram" && (
                <FormField
                  name="tgUserType"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{T.tgUserType}</FormLabel>
                      <FormControl>
                        <select {...field} className={selectCls}>
                          <option value=""></option>
                          <option value="NFT">{T.NFT}</option>
                          <option value="NORMAL">{T.normal}</option>
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
                    <FormLabel>{T.platform}</FormLabel>
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
                    <FormLabel>{T.username}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="handle"
                        className="bg-background"
                        onBlur={(e) => field.onChange(normalizeUsername(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.username?.message === "GENERIC_5_32" ? T.invalidGenericUser : null}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                name="createdAt"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{T.createdAt}</FormLabel>
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
                      <FormLabel>{T.followersCount}</FormLabel>
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
                    <FormLabel>{T.channelMode}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className={selectCls}
                        onChange={(e) => {
                          field.onChange(e);
                          // تنظيف الحقول
                          form.setValue("subscribersCount", "");
                          form.setValue("giftsCount", "");
                        }}
                      >
                        <option value="subscribers">{T.modeSubscribers}</option>
                        <option value="gifts">{T.modeGifts}</option>
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
                    <FormLabel>{T.channelLink}</FormLabel>
                    <FormControl><Input {...field} className="bg-background" placeholder="t.me/yourchannel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("channelMode") === "subscribers" ? (
                <FormField
                  name="subscribersCount"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{T.members}</FormLabel>
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
                        <FormLabel>{T.giftsCount}</FormLabel>
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
                        <FormLabel>{T.giftKind}</FormLabel>
                        <FormControl>
                          <select {...field} className={selectCls}>
                            <option value="upgraded">{T.upgraded}</option>
                            <option value="regular">{T.regular}</option>
                            <option value="both">{T.both}</option>
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
                    <FormLabel>{T.serviceType}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className={selectCls}
                        onChange={(e) => {
                          field.onChange(e);
                          // ضبط الهدف الافتراضي وفق النوع
                          const v = e.target.value;
                          if (v === "followers") form.setValue("target", "instagram");
                          else if (v === "members") form.setValue("target", "telegram_channel");
                          else if (v === "boost_channel") form.setValue("target", "telegram_channel");
                          else if (v === "boost_group") form.setValue("target", "telegram_group");
                        }}
                      >
                        <option value="followers">{T.followers}</option>
                        <option value="members">{T.members}</option>
                        <option value="boost_channel">{T.boostChannel}</option>
                        <option value="boost_group">{T.boostGroup}</option>
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
                    st === "followers" ? ["instagram","twitter"] :
                    st === "members" ? ["telegram_channel"] :
                    st === "boost_channel" ? ["telegram_channel"] :
                    st === "boost_group" ? ["telegram_group"] : [];
                  return (
                    <FormItem>
                      <FormLabel>{T.target}</FormLabel>
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
                    <FormLabel>{T.count}</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* السعر + العملة + وصف (مشترك لكل الأقسام) */}
          <div className="grid grid-cols-3 gap-3">
            <FormField
              name="price"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{T.price}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="decimal"
                      placeholder="0.0"
                      className="bg-background"
                      onKeyDown={onlyNumericKeys}
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
                  <FormLabel>{T.currency}</FormLabel>
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
                <FormLabel>{T.desc}</FormLabel>
                <FormControl><Textarea {...field} className="bg-background" rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => { setKind(null); setPlatform(""); form.reset(); }}>
              {T.back}
            </Button>
            <Button type="submit" disabled={!form.formState.isValid}>{T.post}</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}