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

const usernameRegex = /^[a-z0-9_]{5,32}$/;
const dateRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

type MainType = "username" | "account" | "channel" | "service";
type Platform = "telegram" | "twitter" | "instagram" | "discord" | "snapchat";

/* ---------- i18n helpers ---------- */
const labels = {
  ar: {
    title: "اختر نوع الإعلان",
    username: "بيع يوزر",
    account: "بيع حساب",
    channel: "بيع قناة",
    service: "بيع خدمة",
    platform: "المنصة",
    choosePlatform: "اختر المنصة",
    usernameField: "اسم المستخدم / رابط (بدون @ أو t.me/)",
    price: "السعر",
    desc: "الوصف (اختياري)",
    post: "نشر",
    back: "رجوع",
    serviceType: "نوع الخدمة",
    followers: "متابعين",
    members: "مشتركين",
    boostCh: "تعزيز قناة تيليجرام",
    boostGp: "تعزيز مجموعة تيليجرام",
    target: "الهدف",
    channelLink: "رابط القناة / المجموعة",
    createdAt: "تاريخ إنشاء الحساب (سنة-شهر)",
    followersCount: "عدد المتابعين",
  },
  en: {
    title: "Choose listing type",
    username: "Sell Username",
    account: "Sell Account",
    channel: "Sell Channel",
    service: "Sell Service",
    platform: "Platform",
    choosePlatform: "Choose a platform",
    usernameField: "Username / Link (without @ or t.me/)",
    price: "Price",
    desc: "Description (optional)",
    post: "Post",
    back: "Back",
    serviceType: "Service Type",
    followers: "Followers",
    members: "Members",
    boostCh: "Boost Telegram Channel",
    boostGp: "Boost Telegram Group",
    target: "Target",
    channelLink: "Channel / Group link",
    createdAt: "Account creation (YYYY-MM)",
    followersCount: "Followers count",
  },
};

/* ---------- schemas ---------- */
const baseSchema = z.object({
  type: z.enum(["username", "account", "channel", "service"]),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
});

const usernameSchema = baseSchema.extend({
  platform: z.enum(["telegram", "twitter", "instagram", "discord", "snapchat"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")),
    z.string().regex(usernameRegex, "اسم غير صالح: 5-32 حروف/أرقام/_")),
  userType: z.enum(["ثنائي","ثلاثي","رباعي","خماسي","اكثر"]).optional(),
});

const accountSchema = baseSchema.extend({
  platform: z.enum(["twitter","instagram","discord","snapchat"]),
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")),
    z.string().min(3, "أدخل يوزر صحيح")),
  createdAt: z.string().regex(dateRegex, "سنة-شهر (YYYY-MM)"),
  followersCount: z.coerce.number().min(0).optional(),
});

const channelSchema = baseSchema.extend({
  username: z.preprocess((v) => normalizeUsername(String(v ?? "")),
    z.string().regex(usernameRegex, "يوزر/رابط قناة غير صالح")),
});

const serviceSchema = baseSchema.extend({
  serviceType: z.enum(["followers","members","boost_channel","boost_group"]),
  targetPlatform: z.enum(["instagram","twitter","telegram_channel","telegram_group"]),
  targetLink: z.string().min(1, "الرابط مطلوب"),
});

function getSchema(mainType: MainType, platform?: Platform) {
  switch (mainType) {
    case "username": return usernameSchema;
    case "account": return accountSchema;
    case "channel": return channelSchema;
    case "service": return serviceSchema;
    default: return baseSchema;
  }
}

/* ---------- component ---------- */
export default function SellPage() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = language === "ar" ? labels.ar : labels.en;

  const [mainType, setMainType] = useState<MainType | null>(null);
  const [platform, setPlatform] = useState<Platform | "">("");

  useEffect(() => {
    try { telegramWebApp?.expand?.(); } catch {}
  }, []);

  const activeSchema = useMemo(() => getSchema((mainType as MainType) || "username", platform as Platform), [mainType, platform]);

  const form = useForm<any>({
    resolver: zodResolver(activeSchema),
    mode: "onChange",
    defaultValues: {
      type: mainType || undefined,
      platform: platform || "",
      username: "",
      price: "",
      description: "",
      userType: undefined,
      createdAt: "",
      followersCount: "",
      serviceType: undefined,
      targetPlatform: undefined,
      targetLink: "",
    },
  });

  useEffect(() => {
    const current = form.getValues();
    form.reset({ ...current, type: mainType || undefined, platform: platform || "" });
  }, [mainType, platform]); // eslint-disable-line

  const postLabel = useMemo(() => {
    switch (mainType) {
      case "username": return `${L.post} (${L.username})`;
      case "account":  return `${L.post} (${L.account})`;
      case "channel":  return `${L.post} (${L.channel})`;
      case "service":  return `${L.post} (${L.service})`;
      default:         return L.post;
    }
  }, [mainType, L]);

  const submit = async (data: any) => {
    if (!telegramWebApp?.user) {
      toast({ title: "خطأ", description: "افتح من تيليجرام", variant: "destructive" });
      return;
    }
    try {
      const payload = { ...data, telegramId: telegramWebApp.user.id };
      // مبدئيًا: القناة فقط تذهب لـ /api/sell -> تنزل للماركت
      // باقي الأنواع نرسلها إلى /api/listings (نضيفه بالسيرفر أدناه)
      const isChannel = data.type === "channel";
      const url = isChannel ? "/api/sell" : "/api/listings";
      const r = await apiRequest("POST", url, payload);
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      toast({ title: "تم", description: "تم إرسال الإعلان" });
      form.reset();
      setMainType(null);
      setPlatform("");
    } catch (e) {
      toast({ title: "خطأ", description: e instanceof Error ? e.message : "مشكلة", variant: "destructive" });
    }
  };

  /* ---------- UI ---------- */

  if (!mainType) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.title}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setMainType("username")}>{L.username}</Button>
          <Button className="w-full" onClick={() => setMainType("account")}>{L.account}</Button>
          <Button className="w-full" onClick={() => setMainType("channel")}>{L.channel}</Button>
          <Button className="w-full" onClick={() => setMainType("service")}>{L.service}</Button>
        </CardContent>
      </Card>
    );
  }

  // اختيار المنصة لليوزر/الحساب
  if ((mainType === "username" || mainType === "account") && !platform) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader><CardTitle>{L.platform}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full bg-background border" onClick={() => setPlatform("telegram")}>Telegram</Button>
          <Button className="w-full bg-background border" onClick={() => setPlatform("twitter")}>Twitter</Button>
          <Button className="w-full bg-background border" onClick={() => setPlatform("instagram")}>Instagram</Button>
          <Button className="w-full bg-background border" onClick={() => setPlatform("discord")}>Discord</Button>
          <Button className="w-full bg-background border" onClick={() => setPlatform("snapchat")}>Snapchat</Button>
          <Button variant="secondary" onClick={() => setMainType(null)}>{L.back}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 min-h-screen p-4">
        <Card className="p-4 space-y-3">
          {/* type + platform */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setMainType(null); setPlatform(""); form.reset(); }}>
              {L.back}
            </Button>
            <div className="ml-auto text-sm opacity-70">
              {mainType === "username" && L.username}
              {mainType === "account"  && L.account}
              {mainType === "channel"  && L.channel}
              {mainType === "service"  && L.service}
              {platform && ` · ${platform}`}
            </div>
          </div>

          {/* platform field for username/account */}
          {(mainType === "username" || mainType === "account") && (
            <FormField
              name="platform"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{L.platform}</FormLabel>
                  <FormControl>
                    <Input {...field} value={platform} readOnly className="bg-background" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* username/account fields */}
          {(mainType === "username" || mainType === "account") && (
            <>
              <FormField
                name="username"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.usernameField}</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} onBlur={(e) => field.onChange(normalizeUsername(e.target.value))} className="bg-background"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {mainType === "username" && (
                <FormField
                  name="userType"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع اليوزر</FormLabel>
                      <FormControl>
                        <select {...field} className="w-full rounded-md border px-3 py-2 bg-background">
                          <option value="">{language==="ar"?"اختر":"Choose"}</option>
                          <option value="ثنائي">ثنائي</option>
                          <option value="ثلاثي">ثلاثي</option>
                          <option value="رباعي">رباعي</option>
                          <option value="خماسي">خماسي</option>
                          <option value="اكثر">اكثر</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {mainType === "account" && (
                <>
                  <FormField
                    name="createdAt"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{L.createdAt}</FormLabel>
                        <FormControl>
                          <Input type="month" {...field} className="bg-background" />
                        </FormControl>
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
                          <FormLabel>{L.followersCount}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} {...field} className="bg-background"/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* channel */}
          {mainType === "channel" && (
            <FormField
              name="username"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{L.channelLink}</FormLabel>
                  <FormControl>
                    <Input placeholder="channel" {...field} onBlur={(e) => field.onChange(normalizeUsername(e.target.value))} className="bg-background"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* service */}
          {mainType === "service" && (
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
                        className="w-full rounded-md border px-3 py-2 bg-background"
                        onChange={(e) => {
                          field.onChange(e);
                          // عيّن المنصات المتاحة
                          const val = e.target.value;
                          if (val === "followers") form.setValue("targetPlatform", "instagram");
                          else if (val === "members") form.setValue("targetPlatform", "telegram_channel");
                          else if (val === "boost_channel") form.setValue("targetPlatform", "telegram_channel");
                          else if (val === "boost_group") form.setValue("targetPlatform", "telegram_group");
                        }}
                      >
                        <option value="">{language==="ar"?"اختر":"Choose"}</option>
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
                name="targetPlatform"
                control={form.control}
                render={({ field }) => {
                  const st = form.watch("serviceType");
                  const options =
                    st === "followers" ? ["instagram","twitter"] :
                    st === "members" ? ["telegram_channel"] :
                    st === "boost_channel" ? ["telegram_channel"] :
                    st === "boost_group" ? ["telegram_group"] : [];
                  return (
                    <FormItem>
                      <FormLabel>{L.target}</FormLabel>
                      <FormControl>
                        <select {...field} className="w-full rounded-md border px-3 py-2 bg-background">
                          <option value="">{language==="ar"?"اختر":"Choose"}</option>
                          {options.map((op) => <option key={op} value={op}>{op}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                name="targetLink"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{L.channelLink}</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* common: price + desc */}
          <FormField
            name="price"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex items-center gap-2">
                <div className="flex-1">
                  <FormLabel>{L.price}</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.000000001" {...field} className="bg-background"/>
                  </FormControl>
                </div>
                <span className="mt-7 font-semibold">TON</span>
              </FormItem>
            )}
          />

          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{L.desc}</FormLabel>
                <FormControl>
                  <Textarea {...field} className="bg-background"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => { setMainType(null); setPlatform(""); form.reset(); }}>{L.back}</Button>
            <Button type="submit" disabled={!form.formState.isValid}>{postLabel}</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}