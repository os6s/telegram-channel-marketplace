import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { telegramWebApp } from "@/lib/telegram";
import { apiRequest } from "@/lib/queryClient";

// Schema موحد
const listingSchema = z.object({
  type: z.enum(["username", "channel", "service"]),
  platform: z.string().optional(), // Telegram, Instagram, إلخ
  username: z.string().optional(),
  giftType: z.string().optional(),
  price: z.string(),
  description: z.string().optional(),
  serviceTitle: z.string().optional(),
});

type ListingForm = z.infer<typeof listingSchema>;

export default function SellPage() {
  const { toast } = useToast();
  const [listingType, setListingType] = useState<"username" | "channel" | "service" | null>(null);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      price: "",
      description: "",
    },
  });

  const onSubmit = async (data: ListingForm) => {
    if (!telegramWebApp.user) {
      toast({
        title: "Not Authenticated",
        description: "Open this app from Telegram",
        variant: "destructive",
      });
      return;
    }

    const result = await apiRequest("POST", "/api/sell", {
      ...data,
      telegramId: telegramWebApp.user.id,
    });

    if (result.ok) {
      toast({ title: "Listing Submitted", description: "Your item is now on sale." });
      form.reset();
      setListingType(null);
    } else {
      toast({
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (listingType) {
      setListingType(null);
    } else {
      window.history.back();
    }
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
              خدمة (زيادة متابعين، دعم، إلخ)
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

                {/* Common Field: Type */}
                <input type="hidden" value={listingType} {...form.register("type")} />

                {/* Platform + Username */}
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
                            <SelectContent>
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

                {/* Channel Username + Gift Type */}
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
                            <SelectContent>
                              <SelectItem value="statue">🗽 تمثال الحرية</SelectItem>
                              <SelectItem value="flame">🔥 شعلة الحرية</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* Service Title */}
                {listingType === "service" && (
                  <FormField
                    control={form.control}
                    name="serviceTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نوع الخدمة</FormLabel>
                        <FormControl>
                          <Input placeholder="مثلاً: زيادة متابعين" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Common Fields */}
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

                <Button type="submit" className="w-full bg-telegram-500 hover:bg-telegram-600">
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