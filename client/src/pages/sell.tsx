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
});

type ListingForm = z.infer<typeof listingSchema>;

export default function SellPage() {
  const { toast } = useToast();
  const [listingType, setListingType] = useState<
    "username" | "channel" | "service" | null
  >(null);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      price: "",
      description: "",
    },
    mode: "onChange", // تفعيل التحقق الفوري
  });

  const onSubmit = async (data: ListingForm) => {
    if (!telegramWebApp.user) {
      toast({
        title: "Not Authenticated",
        description: "Open this app from Telegram.",
        variant: "destructive",
      });
      return;
    }

    const result = await apiRequest("POST", "/api/sell", {
      ...data,
      telegramId: telegramWebApp.user.id,
    });

    if (result.ok) {
      toast({
        title: "Listing Submitted",
        description: "Your item is now live for sale!",
      });
      form.reset();
      setListingType(null);
    } else {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    if (listingType) {
      setListingType(null);
      form.reset();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {!listingType ? (
        <Card>
          <CardHeader>
            <CardTitle>What do you want to sell?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setListingType("username")}>
              Username (Telegram / Instagram / Twitter ...)
            </Button>
            <Button className="w-full" onClick={() => setListingType("channel")}>
              Telegram Channel
            </Button>
            <Button className="w-full" onClick={() => setListingType("service")}>
              Service (Followers, Support, etc.)
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
                    ? "Sell Username"
                    : listingType === "channel"
                    ? "Sell Channel"
                    : "Sell Service"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                >
                  ← Back
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
                          <FormLabel>Platform</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
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
                          <FormLabel>Username</FormLabel>
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
                          <FormLabel>Channel Username</FormLabel>
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
                          <FormLabel>Gift Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gift type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="statue">🗽 Statue of Liberty</SelectItem>
                              <SelectItem value="flame">🔥 Liberty Torch</SelectItem>
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
                        <FormLabel>Service Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Increase Followers" {...field} />
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
                      <FormLabel>Price (TON)</FormLabel>
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-telegram-500 hover:bg-telegram-600"
                  disabled={!form.formState.isValid}
                >
                  Publish Listing
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}