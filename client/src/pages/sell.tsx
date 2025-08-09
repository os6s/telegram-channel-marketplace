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

// Regex لليوزر: لازم تبدأ @ وحروف انجليزية وأرقام فقط، بدون مسافات أو رموز خاصة
const usernameRegex = /^@[a-zA-Z0-9_]{3,32}$/;

// Regex لتاريخ الإنشاء: سنة وشهر فقط YYYY-MM
const dateRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const baseSchema = z.object({
  type: z.enum(["username", "channel", "service"]),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
});

const usernameSchema = baseSchema.extend({
  platform: z.string().min(1, "المنصة مطلوبة"),
  username: z
    .string()
    .min(4, "يجب أن يبدأ @ ويتكون من 3 أحرف على الأقل بعده")
    .regex(usernameRegex, "اسم اليوزر يجب أن يبدأ @ ويحتوي فقط على حروف وأرقام و_"),
  userType: z.enum(["ثنائي", "ثلاثي", "رباعي", "خماسي", "اكثر"]).optional(),
});

const channelSchema = baseSchema.extend({
  username: z.string().min(1, "رابط القناة مطلوب"),
  giftType: z.enum(["statue-of-liberty", "flame-of-liberty"]).optional(),
  giftCounts: z
    .object({
      "statue-of-liberty": z.number().min(0),
      "flame-of-liberty": z.number().min(0),
    })
    .optional(),
});

const serviceSchema = baseSchema.extend({
  platform: z.string().min(1, "المنصة مطلوبة"),
  serviceTitle: z.string().min(1, "عنوان الخدمة مطلوب"),
});

const twitterAccountSchema = baseSchema.extend({
  platform: z.literal("twitter"),
  username: z
    .string()
    .min(4, "يجب أن يبدأ @ ويتكون من 3 أحرف على الأقل بعده")
    .regex(usernameRegex, "اسم اليوزر يجب أن يبدأ @ ويحتوي فقط على حروف وأرقام و_"),
  createdAt: z.string().regex(dateRegex, "يجب أن يكون تاريخ الإنشاء بصيغة سنة-شهر (YYYY-MM)"),
  followersCount: z.string().min(1, "عدد المتابعين مطلوب"),
  userType: z.enum(["ثنائي", "ثلاثي", "رباعي", "خماسي", "اكثر"]).optional(),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
});

const instagramAccountSchema = twitterAccountSchema.extend({
  platform: z.literal("instagram"),
});

const discordUserSchema = baseSchema.extend({
  platform: z.literal("discord"),
  username: z
    .string()
    .min(4, "يجب أن يبدأ @ ويتكون من 3 أحرف على الأقل بعده")
    .regex(usernameRegex, "اسم اليوزر يجب أن يبدأ @ ويحتوي فقط على حروف وأرقام و_"),
  createdAt: z.string().regex(dateRegex, "يجب أن يكون تاريخ الإنشاء بصيغة سنة-شهر (YYYY-MM)"),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
  userType: z.enum(["ثنائي", "ثلاثي", "رباعي", "خماسي", "اكثر"]).optional(),
});

const discordAccountSchema = baseSchema.extend({
  platform: z.literal("discord"),
  username: z.string().min(4, "يوزر الحساب مطلوب"),
  createdAt: z.string().regex(dateRegex, "يجب أن يكون تاريخ الإنشاء بصيغة سنة-شهر (YYYY-MM)"),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
});

// الحزمة الرئيسية للفورم حسب الاختيار
function getSchema(listingType: string, platform?: string) {
  if (listingType === "username") {
    if (platform === "twitter") return twitterAccountSchema;
    if (platform === "instagram") return instagramAccountSchema;
    if (platform === "discord") return discordUserSchema;
    return usernameSchema;
  }
  if (listingType === "channel") return channelSchema;
  if (listingType === "service") return serviceSchema;
  return baseSchema;
}

export default function SellPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [listingType, setListingType] = useState<"username" | "channel" | "service" | null>(null);
  const [platform, setPlatform] = useState<string>("");

  const form = useForm<any>({
    resolver: zodResolver(getSchema(listingType || "", platform)),
    mode: "onChange",
    defaultValues: {
      type: listingType || undefined,
      platform: platform || "",
      username: "",
      price: "",
      description: "",
      serviceTitle: "",
      giftType: "statue-of-liberty",
      giftCounts: { "statue-of-liberty": 0, "flame-of-liberty": 0 },
      createdAt: "",
      followersCount: "",
      userType: undefined,
    },
  });

  useEffect(() => {
    if (listingType) {
      form.setValue("type", listingType);
      if (!platform) form.setValue("platform", "");
      else form.setValue("platform", platform);
    }
  }, [listingType, platform, form]);

  const onSubmit = async (data: any) => {
    if (!telegramWebApp.user) {
      toast({ title: "خطأ", description: "افتح من تيليجرام", variant: "destructive" });
      return;
    }

    try {
      const result = await apiRequest("POST", "/api/sell", {
        ...data,
        telegramId: telegramWebApp.user.id,
      });
      if (result.ok) {
        toast({ title: "تم", description: "تم إرسال الإعلان" });
        form.reset();
        setListingType(null);
        setPlatform("");
      } else {
        throw new Error(result.error || "حدث خطأ");
      }
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "مشكلة" });
    }
  };

  if (!listingType) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader>
          <CardTitle>اختر نوع الإعلان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setListingType("username")}>بيع يوزر</Button>
          <Button className="w-full" onClick={() => setListingType("channel")}>بيع قناة</Button>
          <Button className="w-full" onClick={() => setListingType("service")}>بيع خدمة</Button>
        </CardContent>
      </Card>
    );
  }

  // لو نوع البيع يوزر لازم يختار منصة أول
  if (listingType === "username" && !platform) {
    return (
      <Card className="p-4 space-y-3 min-h-screen">
        <CardHeader>
          <CardTitle>اختر المنصة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => setPlatform("telegram")}>تيليجرام</Button>
          <Button className="w-full" onClick={() => setPlatform("twitter")}>تويتر</Button>
          <Button className="w-full" onClick={() => setPlatform("instagram")}>انستاغرام</Button>
          <Button className="w-full" onClick={() => setPlatform("discord")}>ديسكورد</Button>
          <Button variant="secondary" onClick={() => setListingType(null)}>رجوع</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 min-h-screen p-4">
        <Card className="p-4 space-y-3">
          {listingType === "username" && (
            <>
              <FormField name="platform" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>المنصة</FormLabel>
                  <FormControl>
                    <Input {...field} disabled />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="username" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم اليوزر (بالإنجليزي وبداية @)</FormLabel>
                  <FormControl><Input placeholder="@username" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {(platform === "twitter" || platform === "instagram" || platform === "discord") && (
                <>
                  <FormField name="userType" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>نوع اليوزر</FormLabel>
                      <FormControl>
                        <select {...field} className="input">
                          <option value="">اختر نوع اليوزر</option>
                          <option value="ثنائي">ثنائي</option>
                          <option value="ثلاثي">ثلاثي</option>
                          <option value="رباعي">رباعي</option>
                          <option value="خماسي">خماسي</option>
                          <option value="اكثر">اكثر</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField name="createdAt" control={form.control} render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ إنشاء الحساب (سنة-شهر)</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {platform === "twitter" && (
                    <FormField name="followersCount" control={form.control} render={({ field }) => (
                      <FormItem>
                        <FormLabel>عدد المتابعين</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </>
              )}
            </>
          )}

          {listingType === "channel" && (
            <>
              <FormField name="username" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>رابط القناة</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="giftType" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع الهدية</FormLabel>
                  <FormControl>
                    <select {...field} className="input">
                      <option value="statue-of-liberty">تمثال الحرية</option>
                      <option value="flame-of-liberty">شعلة الحرية</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="giftCounts.statue-of-liberty" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>عدد تمثال الحرية</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="giftCounts.flame-of-liberty" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>عدد شعلة الحرية</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
          )}

          {(listingType === "username" || listingType === "channel" || listingType === "service") && (
            <>
              <FormField name="price" control={form.control} render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <div className="flex-1">
                    <FormLabel>السعر</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </div>
                  <span className="mt-7 font-semibold">USDT</span>
                </FormItem>
              )} />

              <FormField name="description" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف (اختياري)</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
          )}

          {listingType === "service" && (
            <>
              <FormField name="platform" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>المنصة</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField name="serviceTitle" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان الخدمة</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => {
              setListingType(null);
              setPlatform("");
              form.reset();
            }}>رجوع</Button>
            <Button type="submit" disabled={!form.formState.isValid}>نشر</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}