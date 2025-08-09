import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/language-context";

const userTypeOptions = [
  { value: "ثنائي", label_ar: "ثنائي", label_en: "Double" },
  { value: "ثلاثي", label_ar: "ثلاثي", label_en: "Triple" },
  { value: "رباعي", label_ar: "رباعي", label_en: "Quadruple" },
  { value: "خماسي", label_ar: "خماسي", label_en: "Quintuple" },
  { value: "أكثر", label_ar: "أكثر", label_en: "More" },
];

// Zod Schemas
const baseSchema = z.object({
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
  userType: z.string().optional(),
});

const telegramUsernameSchema = baseSchema.extend({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  userType: z.string().min(1, "نوع اليوزر مطلوب"),
});

const telegramChannelSchema = baseSchema.extend({
  username: z.string().min(1, "يوزر القناة مطلوب"),
  giftCounts: z.object({
    "statue-of-liberty": z.number().min(0, "عدد صحيح"),
    "flame-of-liberty": z.number().min(0, "عدد صحيح"),
  }),
});

const twitterInstagramUserSchema = baseSchema.extend({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  userType: z.string().min(1, "نوع اليوزر مطلوب"),
});

const twitterInstagramAccountSchema = baseSchema.extend({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  createdAt: z.string().min(1, "تاريخ الإنشاء مطلوب"),
  followersCount: z.string().min(1, "عدد المتابعين مطلوب"),
});

const discordUserSchema = baseSchema.extend({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  userType: z.string().min(1, "نوع اليوزر مطلوب"),
});

const discordAccountSchema = baseSchema.extend({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  createdAt: z.string().min(1, "تاريخ الإنشاء مطلوب"),
});

export default function SellPage() {
  const { toast } = useToast();
  const { t, language } = useLanguage(); // assume t(key) returns correct translation

  // Step states
  const [platform, setPlatform] = useState<string | null>(null);
  const [saleType, setSaleType] = useState<string | null>(null);

  // Dynamic schema and defaultValues depending on platform & saleType
  let schema = baseSchema;
  let defaultValues: any = {
    price: "",
    description: "",
    userType: "",
  };

  // Determine schema & defaults
  if (platform === "telegram") {
    if (saleType === "username") {
      schema = telegramUsernameSchema;
      defaultValues = { price: "", description: "", username: "", userType: "" };
    } else if (saleType === "channel") {
      schema = telegramChannelSchema;
      defaultValues = {
        price: "",
        description: "",
        username: "",
        giftCounts: { "statue-of-liberty": 0, "flame-of-liberty": 0 },
      };
    }
  } else if (platform === "twitter" || platform === "instagram") {
    if (saleType === "username") {
      schema = twitterInstagramUserSchema;
      defaultValues = { price: "", description: "", username: "", userType: "" };
    } else if (saleType === "account") {
      schema = twitterInstagramAccountSchema;
      defaultValues = { price: "", description: "", username: "", createdAt: "", followersCount: "" };
    }
  } else if (platform === "discord") {
    if (saleType === "username") {
      schema = discordUserSchema;
      defaultValues = { price: "", description: "", username: "", userType: "" };
    } else if (saleType === "account") {
      schema = discordAccountSchema;
      defaultValues = { price: "", description: "", username: "", createdAt: "" };
    }
  }

  const form = useForm<any>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues,
  });

  // Reset form & saleType on platform change
  useEffect(() => {
    form.reset(defaultValues);
    setSaleType(null);
  }, [platform]);

  // Reset form on saleType change
  useEffect(() => {
    form.reset(defaultValues);
  }, [saleType]);

  const onSubmit = async (data: any) => {
    if (!telegramWebApp.user) {
      toast({ title: t("خطأ"), description: t("افتح من تيليجرام"), variant: "destructive" });
      return;
    }
    try {
      const payload = {
        ...data,
        platform,
        type: saleType,
        telegramId: telegramWebApp.user.id,
      };
      const result = await apiRequest("POST", "/api/sell", payload);
      if (result.ok) {
        toast({ title: t("تم"), description: t("تم إرسال الإعلان") });
        setPlatform(null);
        setSaleType(null);
        form.reset();
      } else {
        throw new Error(result.error || t("حدث خطأ"));
      }
    } catch (err) {
      toast({ title: t("خطأ"), description: err instanceof Error ? err.message : t("مشكلة") });
    }
  };

  // Helper: render userType select box
  function renderUserTypeSelect() {
    return (
      <FormField
        name="userType"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{language === "ar" ? "نوع اليوزر" : "User Type"}</FormLabel>
            <FormControl>
              <select {...field} className="w-full border rounded p-2">
                <option value="">{language === "ar" ? "اختر نوع اليوزر" : "Select User Type"}</option>
                {userTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === "ar" ? opt.label_ar : opt.label_en}
                  </option>
                ))}
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // Helper: render gift counts inputs (Telegram channel only)
  function renderGiftCounts() {
    return (
      <>
        <FormField
          name="giftCounts.statue-of-liberty"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "ar" ? "عدد تمثال الحرية" : "Statue of Liberty Count"}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="giftCounts.flame-of-liberty"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "ar" ? "عدد شعلة الحرية" : "Flame of Liberty Count"}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </>
    );
  }

  // === Render steps ===
  if (!platform) {
    // Step 1: اختر منصة
    return (
      <Card className="p-4 space-y-3">
        <CardHeader>
          <CardTitle>{language === "ar" ? "اختر المنصة" : "Select Platform"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setPlatform("telegram")}>
            {language === "ar" ? "تيليجرام" : "Telegram"}
          </Button>
          <Button className="w-full" onClick={() => setPlatform("twitter")}>
            {language === "ar" ? "تويتر" : "Twitter"}
          </Button>
          <Button className="w-full" onClick={() => setPlatform("instagram")}>
            {language === "ar" ? "انستاغرام" : "Instagram"}
          </Button>
          <Button className="w-full" onClick={() => setPlatform("discord")}>
            {language === "ar" ? "ديسكورد" : "Discord"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!saleType) {
    // Step 2: اختر نوع البيع حسب المنصة
    let options: { key: string; label_ar: string; label_en: string }[] = [];
    if (platform === "telegram") {
      options = [
        { key: "username", label_ar: "بيع يوزر", label_en: "Sell Username" },
        { key: "channel", label_ar: "بيع قناة", label_en: "Sell Channel" },
      ];
    } else if (platform === "twitter" || platform === "instagram") {
      options = [
        { key: "username", label_ar: "بيع يوزر", label_en: "Sell Username" },
        { key: "account", label_ar: "بيع حساب", label_en: "Sell Account" },
      ];
    } else if (platform === "discord") {
      options = [
        { key: "username", label_ar: "بيع يوزر", label_en: "Sell Username" },
        { key: "account", label_ar: "بيع حساب", label_en: "Sell Account" },
      ];
    }

    return (
      <Card className="p-4 space-y-3">
        <CardHeader>
          <CardTitle>{language === "ar" ? "اختر نوع البيع" : "Select Sale Type"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((opt) => (
            <Button key={opt.key} className="w-full" onClick={() => setSaleType(opt.key)}>
              {language === "ar" ? opt.label_ar : opt.label_en}
            </Button>
          ))}
          <Button variant="secondary" className="w-full" onClick={() => setPlatform(null)}>
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Step 3: نموذج البيع
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="p-4 space-y-3">
          <CardHeader>
            <CardTitle>
              {language === "ar"
                ? `بيع ${(() => {
                    if (platform === "telegram") {
                      return saleType === "username"
                        ? "يوزر تيليجرام"
                        : saleType === "channel"
                        ? "قناة تيليجرام"
                        : "";
                    } else if (platform === "twitter") {
                      return saleType === "username"
                        ? "يوزر تويتر"
                        : saleType === "account"
                        ? "حساب تويتر"
                        : "";
                    } else if (platform === "instagram") {
                      return saleType === "username"
                        ? "يوزر انستاغرام"
                        : saleType === "account"
                        ? "حساب انستاغرام"
                        : "";
                    } else if (platform === "discord") {
                      return saleType === "username"
                        ? "يوزر ديسكورد"
                        : saleType === "account"
                        ? "حساب ديسكورد"
                        : "";
                    }
                    return "";
                  })()}`
                : `Sell ${
                    platform.charAt(0).toUpperCase() + platform.slice(1)
                  } ${saleType === "username" ? "Username" : "Account/Channel"}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Username */}
            {(saleType === "username" || saleType === "channel" || saleType === "account") && (
              <FormField
                name="username"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {language === "ar"
                        ? saleType === "channel"
                          ? "يوزر القناة"
                          : "اسم المستخدم"
                        : "Username"}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Created At */}
            {(saleType === "account" && (platform === "twitter" || platform === "instagram" || platform === "discord")) && (
              <FormField
                name="createdAt"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "تاريخ الإنشاء" : "Created At"}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Followers Count */}
            {(saleType === "account" && (platform === "twitter" || platform === "instagram")) && (
              <FormField
                name="followersCount"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "عدد المتابعين" : "Followers Count"}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* User Type */}
            {(saleType === "username") && renderUserTypeSelect()}

            {/* Gift counts (only for telegram channel) */}
            {(platform === "telegram" && saleType === "channel") && renderGiftCounts()}

            {/* Price */}
            <FormField
              name="price"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "ar" ? "السعر" : "Price"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="any" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "ar" ? "الوصف (اختياري)" : "Description (Optional)"}</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between">
              <Button type="button" variant="secondary" onClick={() => setSaleType(null)}>
                {language === "ar" ? "رجوع" : "Back"}
              </Button>
              <Button type="submit" disabled={!form.formState.isValid}>
                {language === "ar" ? "نشر" : "Submit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}