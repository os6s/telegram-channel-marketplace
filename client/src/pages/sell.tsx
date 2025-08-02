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
  // استبدلنا giftType ب gifts array:
  gifts: z
    .array(
      z.object({
        type: z.string(),
        quantity: z.number().min(1, "Quantity must be at least 1"),
      })
    )
    .optional(),
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

  // State للهدايا في قناة تيليجرام
  const [gifts, setGifts] = useState<{ type: string; quantity: number }[]>([]);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      price: "",
      description: "",
    },
    mode: "onChange",
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

    const payload = {
      ...data,
      telegramId: telegramWebApp.user.id,
      gifts: listingType === "channel" ? gifts : undefined,
    };

    const result = await apiRequest("POST", "/api/sell", payload);

    if (result.ok) {
      toast({
        title: "Listing Submitted",
        description: "Your item is now live for sale!",
      });
      form.reset();
      setListingType(null);
      setGifts([]);
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
      setGifts([]);
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
              Service (Followers, Subscribers)
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

                {/* Username Section */}
                {listingType === "username" && (
                  <>
                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-orange-500 text-white rounded-md shadow-lg">
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

                {/* Channel Section */}
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

                    <FormLabel>Gifts</FormLabel>

                    {gifts.map((gift, index) => (
                      <div
                        key={index}
                        className="flex space-x-2 mb-2 items-center"
                      >
                        <Select
                          value={gift.type}
                          onValueChange={(val) => {
                            const newGifts = [...gifts];
                            newGifts[index].type = val;
                            setGifts(newGifts);
                          }}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select gift type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="statue">🗽 Statue of Liberty</SelectItem>
                            <SelectItem value="flame">🗽🗽 Liberty Torch</SelectItem>
                            {/* تقدر تضيف أنواع هدايا أكثر هنا */}
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          min={1}
                          placeholder="Quantity"
                          className="w-20"
                          value={gift.quantity}
                          onChange={(e) => {
                            const newGifts = [...gifts];
                            newGifts[index].quantity = Number(e.target.value);
                            setGifts(newGifts);
                          }}
                        />

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setGifts(gifts.filter((_, i) => i !== index));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      onClick={() => setGifts([...gifts, { type: "", quantity: 1 }])}
                    >
                      + Add Gift Type
                    </Button>
                  </>
                )}

                {/* Service Section */}
                {listingType === "service" && (
                  <FormField
                    control={form.control}
                    name="serviceTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                            <SelectContent className="bg-purple-600 text-white rounded-md shadow-lg">
                              <SelectItem value="instagram_followers">
                                Instagram Followers
                              </SelectItem>
                              <SelectItem value="twitter_followers">
                                Twitter Followers
                              </SelectItem>
                              <SelectItem value="telegram_subscribers">
                                Telegram Subscribers
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                  className="w-32 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold disabled:bg-blue-300 disabled:cursor-not-allowed"
                  disabled={!form.formState.isValid || form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Publishing..." : "Publish"}
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}