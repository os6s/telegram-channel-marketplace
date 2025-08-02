import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";

const listingSchema = z.object({
  type: z.enum(["username", "channel", "service"]),
  platform: z.string().optional(),
  username: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.type === "channel" || ctx.parent.type === "username") {
        return val && val.trim().length > 0;
      }
      return true;
    }, "يجب إدخال اسم المستخدم."),
  giftType: z.string().optional(),
  giftCount: z.string().optional(),
  extraGifts: z.array(
    z.object({
      giftType: z.string(),
      giftCount: z.string(),
    })
  ).optional(),
  price: z
    .string()
    .min(1, "يجب إدخال السعر.")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "السعر يجب أن يكون رقمًا موجبًا."),
  description: z.string().optional(),
  serviceTitle: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.type === "service") return val && val.trim().length > 0;
      return true;
    }, "اختر نوع الخدمة."),
  serviceQuantity: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.type === "service") return val && !isNaN(Number(val));
      return true;
    }, "أدخل عدد صحيح."),
});

type ListingForm = z.infer<typeof listingSchema>;

export default function SellPage() {
  const { toast } = useToast();
  const [listingType, setListingType] = useState<"username" | "channel" | "service" | null>(null);
  const [extraGifts, setExtraGifts] = useState<Array<{ giftType: string; giftCount: string }>>([]);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      price: "",
      description: "",
    },
    mode: "onChange",
  });

  const watchServiceTitle = form.watch("serviceTitle");

  const onSubmit = async (data: ListingForm) => {
    if (!telegramWebApp.user) {
      toast({
        title: "غير مسجل الدخول",
        description: "يرجى فتح التطبيق من خلال Telegram.",
        variant: "destructive",
      });
      return;
    }

    const result = await apiRequest("POST", "/api/sell", {
      ...data,
      extraGifts,
      telegramId: telegramWebApp.user.id,
    });

    if (result.ok) {
      toast({ title: "تم النشر", description: "تم عرض العرض للبيع." });
      form.reset();
      setExtraGifts([]);
      setListingType(null);
    } else {
      toast({ title: "حدث خطأ", description: "حاول مجددًا.", variant: "destructive" });
    }
  };

  const handleBack = () => {
    setListingType(null);
    form.reset();
    setExtraGifts([]);
  };

  const addGiftField = () => {
    setExtraGifts([...extraGifts, { giftType: "", giftCount: "" }]);
  };

  const updateGift = (index: number, field: "giftType" | "giftCount", value: string) => {
    const updated = [...extraGifts];
    updated[index][field] = value;
    setExtraGifts(updated);
  };

  const removeGift = (index: number) => {
    const updated = [...extraGifts];
    updated.splice(index, 1);
    setExtraGifts(updated);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {!listingType ? (
        <Card>
          <CardHeader>
            <CardTitle>شنو تريد تبيع؟</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setListingType("username")}>
              يوزر (Telegram / Instagram / Twitter ...)
            </Button>
            <Button className="w-full" onClick={() => setListingType("channel")}>
              قناة تيليجرام
            </Button>
            <Button className="w-full" onClick={() => setListingType("service")}>
              خدمة (متابعين، مشتركين)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {listingType === "username"
                    ? "بيع يوزر"
                    : listingType === "channel"
                    ? "بيع قناة"
                    : "بيع خدمة"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                  ← رجوع
                </Button>

                <input type="hidden" value={listingType} {...form.register("type")} />

                {listingType === "username" && (
                  <>
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع التطبيق</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر التطبيق" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-zinc-900 text-white">
                              <SelectItem value="telegram">Telegram</SelectItem>
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="twitter">Twitter</SelectItem>
                              <SelectItem value="discord">Discord</SelectItem>
                              <SelectItem value="snapchat">Snapchat</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اليوزر</FormLabel>
                          <FormControl>
                            <Input placeholder="@example" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {listingType === "channel" && (
                  <>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>اسم المستخدم للقناة</FormLabel>
                          <FormControl>
                            <Input placeholder="@channel_name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="giftType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع الهدية</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر نوع الهدية" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-zinc-900 text-white">
                              <SelectItem value="statue">🗽 تمثال الحرية</SelectItem>
                              <SelectItem value="flame">🔥 شعلة الحرية</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="giftCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>عدد الهدايا</FormLabel>
                          <FormControl>
                            <Input placeholder="مثلاً: 3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {extraGifts.map((gift, i) => (
                      <div key={i} className="flex gap-2">
                        <Select
                          onValueChange={(val) => updateGift(i, "giftType", val)}
                          value={gift.giftType}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="نوع الهدية الإضافية" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 text-white">
                            <SelectItem value="statue">🗽 تمثال الحرية</SelectItem>
                            <SelectItem value="flame">🔥 شعلة الحرية</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          className="w-1/3"
                          placeholder="العدد"
                          value={gift.giftCount}
                          onChange={(e) => updateGift(i, "giftCount", e.target.value)}
                        />
                        <Button type="button" variant="destructive" onClick={() => removeGift(i)}>
                          حذف
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addGiftField}>
                      إضافة هدية إضافية
                    </Button>
                  </>
                )}

                {listingType === "service" && (
                  <>
                    <FormField
                      control={form.control}
                      name="serviceTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>نوع الخدمة</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="اختر نوع الخدمة" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-zinc-900 text-white">
                              <SelectItem value="instagram_followers">متابعين انستاغرام</SelectItem>
                              <SelectItem value="twitter_followers">متابعين تويتر</SelectItem>
                              <SelectItem value="telegram_subscribers">مشتركين تيليجرام</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {(watchServiceTitle === "instagram_followers" ||
                      watchServiceTitle === "twitter_followers") && (
                      <FormField
                        control={form.control}
                        name="serviceQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>عدد المتابعين</FormLabel>
                            <FormControl>
                              <Input placeholder="مثلاً: 1000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {watchServiceTitle === "telegram_subscribers" && (
                      <FormField
                        control={form.control}
                        name="serviceQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>عدد المشتركين</FormLabel>
                            <FormControl>
                              <Input placeholder="مثلاً: 500" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </>
                )}

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>السعر (TON)</FormLabel>
                      <FormControl>
                        <Input placeholder="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الوصف (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="تفاصيل إضافية عن العرض..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className={`w-full text-white ${
                    form.formState.isValid
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-blue-300 cursor-not-allowed"
                  }`}
                  disabled={!form.formState.isValid}
                >
                  نشر العرض للبيع
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}