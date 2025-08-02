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
    }, "Username is required for channel and username listings."),
  giftType: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.type === "channel") {
        return val && val.trim().length > 0;
      }
      return true;
    }, "Gift type is required for channel listings."),
  price: z
    .string()
    .min(1, "Price is required.")
    .refine(
      (val) => !isNaN(Number(val)) && Number(val) > 0,
      "Price must be a positive number."
    ),
  description: z.string().optional(),
  serviceTitle: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.type === "service") {
        return val && val.trim().length > 0;
      }
      return true;
    }, "Service title is required for service listings."),
  followersCount: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.serviceTitle === "followers") {
        return val && val.trim().length > 0 && !isNaN(Number(val)) && Number(val) > 0;
      }
      return true;
    }, "Followers count is required and must be positive."),
  subscribersCount: z
    .string()
    .optional()
    .refine((val, ctx) => {
      if (ctx.parent.serviceTitle === "subscribers") {
        return val && val.trim().length > 0 && !isNaN(Number(val)) && Number(val) > 0;
      }
      return true;
    }, "Subscribers count is required and must be positive."),
});

type ListingForm = z.infer<typeof listingSchema>;

const translations = {
  en: {
    chooseSellType: "Choose service type",
    sellUsername: "Sell Username",
    sellChannel: "Sell Channel",
    sellService: "Sell Service",
    back: "← Back",
    publishListing: "Publish Listing",
    selectPlatform: "Select platform",
    platformLabel: "Platform",
    usernameLabel: "Username",
    channelUsernameLabel: "Channel Username",
    giftTypeLabel: "Gift Type",
    serviceTypeLabel: "Service Type",
    priceLabel: "Price (TON)",
    descriptionLabel: "Description (Optional)",
    chooseGiftType: "Select gift type",
    followers: "Followers",
    subscribers: "Subscribers",
    followersCountLabel: "Number of Followers",
    subscribersCountLabel: "Number of Subscribers",
    giftCountLabel: "Number of gifts",
    addGift: "Add Gift",
    giftNameStatue: "🗽 Statue of Liberty",
    giftNameFlame: "🔥 Liberty Torch",
  },
  ar: {
    chooseSellType: "اختر نوع الخدمة",
    sellUsername: "بيع يوزر",
    sellChannel: "بيع قناة",
    sellService: "بيع خدمة",
    back: "← رجوع",
    publishListing: "نشر العرض للبيع",
    selectPlatform: "اختر التطبيق",
    platformLabel: "نوع التطبيق",
    usernameLabel: "اليوزر",
    channelUsernameLabel: "اسم المستخدم للقناة",
    giftTypeLabel: "نوع الهدية",
    serviceTypeLabel: "نوع الخدمة",
    priceLabel: "السعر (TON)",
    descriptionLabel: "الوصف (اختياري)",
    chooseGiftType: "اختر نوع الهدية",
    followers: "متابعين",
    subscribers: "مشتركين",
    followersCountLabel: "عدد المتابعين",
    subscribersCountLabel: "عدد المشتركين",
    giftCountLabel: "عدد الهدايا",
    addGift: "إضافة هدية",
    giftNameStatue: "🗽 تمثال الحرية",
    giftNameFlame: "🔥 شعلة الحرية",
  },
};

export default function SellPage() {
  const { toast } = useToast();
  const [listingType, setListingType] = useState<
    "username" | "channel" | "service" | null
  >(null);

  const [giftCounts, setGiftCounts] = useState<
    { giftType: string; count: number }[]
  >([]);

  const userLang = telegramWebApp?.initDataUnsafe?.user?.language_code || "en";
  const t = translations[userLang] || translations.en;

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      price: "",
      description: "",
      followersCount: "",
      subscribersCount: "",
      platform: "",
    },
    mode: "onChange",
    criteriaMode: "all",
  });

  const handleAddGiftCount = () => {
    setGiftCounts((prev) => [...prev, { giftType: "", count: 0 }]);
  };

  const handleGiftTypeChange = (index: number, value: string) => {
    const updated = [...giftCounts];
    updated[index].giftType = value;
    setGiftCounts(updated);
  };

  const handleGiftCountChange = (index: number, value: number) => {
    const updated = [...giftCounts];
    updated[index].count = value;
    setGiftCounts(updated);
  };

  const onSubmit = async (data: ListingForm) => {
    if (!telegramWebApp.user) {
      toast({
        title: userLang === "ar" ? "خطأ" : "Error",
        description:
          userLang === "ar" ? "افتح التطبيق من تيليجرام." : "Open this app from Telegram.",
        variant: "destructive",
      });
      return;
    }

    if (listingType === "channel" && giftCounts.some(g => !g.giftType || g.count <= 0)) {
      toast({
        title: userLang === "ar" ? "خطأ" : "Error",
        description:
          userLang === "ar"
            ? "حدد نوع الهدية وعدد صحيح لكل هدية."
            : "Please specify valid gift types and counts.",
        variant: "destructive",
      });
      return;
    }

    const result = await apiRequest("POST", "/api/sell", {
      ...data,
      telegramId: telegramWebApp.user.id,
      giftCounts: listingType === "channel" ? giftCounts : undefined,
    });

    if (result.ok) {
      toast({
        title: userLang === "ar" ? "تم نشر العرض" : "Listing Submitted",
        description:
          userLang === "ar" ? "العرض متوفر الآن للبيع!" : "Your item is now live for sale!",
      });
      form.reset();
      setListingType(null);
      setGiftCounts([]);
    } else {
      toast({
        title: userLang === "ar" ? "خطأ" : "Error",
        description:
          userLang === "ar" ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (listingType) {
      setListingType(null);
      form.reset();
      setGiftCounts([]);
    } else {
      window.history.back();
    }
  };

  const selectedPlatform = form.watch("platform");

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {!listingType ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.chooseSellType}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setListingType("username")}>
              {t.sellUsername}
            </Button>
            <Button className="w-full" onClick={() => setListingType("channel")}>
              {t.sellChannel}
            </Button>
            <Button className="w-full" onClick={() => setListingType("service")}>
              {t.sellService}
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
                    ? t.sellUsername
                    : listingType === "channel"
                    ? t.sellChannel
                    : t.sellService}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-4 bg-purple-700 text-white hover:bg-purple-800"
                  onClick={handleBack}
                >
                  {t.back}
                </Button>

                <input type="hidden" value={listingType} {...form.register("type")} />

                {/* Platform + Username */}
                {listingType === "username" && (
                  <>
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.platformLabel}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-purple-700 text-white">
                                <SelectValue placeholder={t.selectPlatform} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-purple-700 text-white">
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
                          <FormLabel>{t.usernameLabel}</FormLabel>
                          <FormControl>
                            <Input placeholder="@example" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Channel Username + Gift Types + Gift Counts */}
                {listingType === "channel" && (
                  <>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.channelUsernameLabel}</FormLabel>
                          <FormControl>
                            <Input placeholder="@channel_name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {giftCounts.map((gift, idx) => (
                      <div key={idx} className="flex space-x-2 items-center">
                        <Select
                          value={gift.giftType}
                          onValueChange={(val) => handleGiftTypeChange(idx, val)}
                          className="flex-1 bg-purple-700 text-white"
                        >
                          <SelectTrigger className="bg-purple-700 text-white">
                            <SelectValue placeholder={t.chooseGiftType} />
                          </SelectTrigger>
                          <SelectContent className="bg-purple-700 text-white">
                            <SelectItem value="statue">{t.giftNameStatue}</SelectItem>
                            <SelectItem value="flame">{t.giftNameFlame}</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          min={0}
                          placeholder={t.giftCountLabel}
                          value={gift.count || ""}
                          onChange={(e) => handleGiftCountChange(idx, Number(e.target.value))}
                          className="w-24"
                        />
                      </div>
                    ))}

                    <Button variant="outline" size="sm" onClick={handleAddGiftCount}>
                      {t.addGift}
                    </Button>
                  </>
                )}

                {/* Service Title + Platform + Counts */}
                {listingType === "service" && (
                  <>
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.platformLabel}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-purple-700 text-white">
                                <SelectValue placeholder={t.selectPlatform} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-purple-700 text-white">
                              <SelectItem value="telegram">Telegram</SelectItem>
                              <SelectItem value="instagram">Instagram</SelectItem>
                              <SelectItem value="twitter">Twitter</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serviceTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.serviceTypeLabel}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-purple-700 text-white">
                                <SelectValue placeholder={t.serviceTypeLabel} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-purple-700 text-white">
                              <SelectItem value="followers">{t.followers}</SelectItem>
                              <SelectItem value="subscribers">{t.subscribers}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(selectedPlatform === "instagram" || selectedPlatform === "twitter") &&
                      form.watch("serviceTitle") === "followers" && (
                        <FormField
                          control={form.control}
                          name="followersCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.followersCountLabel}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  placeholder={t.followersCountLabel}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                    {selectedPlatform === "telegram" &&
                      form.watch("serviceTitle") === "subscribers" && (
                        <FormField
                          control={form.control}
                          name="subscribersCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.subscribersCountLabel}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  placeholder={t.subscribersCountLabel}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                  </>
                )}

                {/* Common Fields */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.priceLabel}</FormLabel>
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
                      <FormLabel>{t.descriptionLabel}</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className={`w-full ${
                    form.formState.isValid
                      ? "bg-telegram-600 hover:bg-telegram-700"
                      : "bg-telegram-400 cursor-not-allowed"
                  }`}
                  disabled={!form.formState.isValid}
                >
                  {t.publishListing}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}