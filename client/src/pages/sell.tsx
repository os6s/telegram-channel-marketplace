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

// Schema ديناميكي
const baseSchema = z.object({
  type: z.enum(["username", "channel", "service"]),
  price: z.string().min(1, "السعر مطلوب"),
  description: z.string().optional(),
});

const usernameSchema = baseSchema.extend({
  platform: z.string().min(1, "المنصة مطلوبة"),
  username: z.string().min(1, "اليوزر مطلوب"),
});

const channelSchema = baseSchema.extend({
  username: z.string().min(1, "رابط القناة مطلوب"),
});

const serviceSchema = baseSchema.extend({
  platform: z.string().min(1, "المنصة مطلوبة"),
  serviceTitle: z.string().min(1, "عنوان الخدمة مطلوب"),
});

export default function SellPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [listingType, setListingType] = useState<"username" | "channel" | "service" | null>(null);

  const form = useForm<any>({
    resolver: zodResolver(
      listingType === "username"
        ? usernameSchema
        : listingType === "channel"
        ? channelSchema
        : listingType === "service"
        ? serviceSchema
        : baseSchema
    ),
    mode: "onChange",
    defaultValues: {
      type: listingType || undefined,
      platform: "",
      username: "",
      price: "",
      description: "",
      serviceTitle: "",
    },
  });

  useEffect(() => {
    if (listingType) {
      form.setValue("type", listingType);
    }
  }, [listingType, form]);

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
      } else {
        throw new Error(result.error || "حدث خطأ");
      }
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "مشكلة" });
    }
  };

  if (!listingType) {
    return (
      <Card className="p-4 space-y-3">
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="p-4 space-y-3">
          {listingType === "username" && (
            <>
              <FormField name="platform" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>المنصة</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="username" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>اليوزر</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
          )}

          {listingType === "channel" && (
            <FormField name="username" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>رابط القناة</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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

          <FormField name="price" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>السعر</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField name="description" control={form.control} render={({ field }) => (
            <FormItem>
              <FormLabel>الوصف</FormLabel>
              <FormControl><Textarea {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => setListingType(null)}>رجوع</Button>
            <Button type="submit" disabled={!form.formState.isValid}>نشر</Button>
          </div>
        </Card>
      </form>
    </Form>
  );
}