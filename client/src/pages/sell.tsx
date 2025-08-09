import { useState, useEffect } from “react”;
import { useForm, useFieldArray } from “react-hook-form”;
import { z } from “zod”;
import { zodResolver } from “@hookform/resolvers/zod”;
import { Button } from “@/components/ui/button”;
import { Card, CardContent, CardHeader, CardTitle } from “@/components/ui/card”;
import { Input } from “@/components/ui/input”;
import { Textarea } from “@/components/ui/textarea”;
import {
Form,
FormControl,
FormField,
FormItem,
FormLabel,
FormMessage,
} from “@/components/ui/form”;
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from “@/components/ui/select”;
import { useToast } from “@/hooks/use-toast”;
import { telegramWebApp } from “@/lib/telegram”;
import { apiRequest } from “@/lib/queryClient”;
import { useLanguage } from “@/contexts/language-context”;

// Schema validation محسن
const listingSchema = z.object({
type: z.enum([“username”, “channel”, “service”]),
platform: z.string().optional(),
username: z.string().optional(),
price: z.string().min(1, “Price is required.”),
description: z.string().optional(),
serviceTitle: z.string().optional(),
followersCount: z.string().optional(),
subscribersCount: z.string().optional(),
giftCounts: z
.array(
z.object({
giftType: z.string().min(1, “Gift type is required”),
count: z.number().min(1, “Count must be at least 1”),
})
)
.optional(),
});

type ListingForm = z.infer<typeof listingSchema>;

export default function SellPage() {
const { toast } = useToast();
const { t } = useLanguage();

const [listingType, setListingType] = useState<“username” | “channel” | “service” | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [canPublish, setCanPublish] = useState(false);

const form = useForm<ListingForm>({
resolver: zodResolver(listingSchema),
defaultValues: {
type: undefined,
price: “”,
description: “”,
followersCount: “”,
subscribersCount: “”,
platform: “”,
giftCounts: [],
},
mode: “onChange”,
reValidateMode: “onChange”,
criteriaMode: “all”,
});

const { fields, append, remove } = useFieldArray({
control: form.control,
name: “giftCounts”,
});

// تحديث نوع الإعلان
useEffect(() => {
if (listingType) {
form.setValue(“type”, listingType, {
shouldValidate: true,
shouldDirty: true,
});
}
}, [listingType, form]);

// Custom validation function
const validateForm = (data: any) => {
console.log(“Validating form data:”, data);

```
// التحقق من البيانات الأساسية
if (!data.type) {
  console.log("No type selected");
  return false;
}

if (!data.price || data.price.trim() === '' || isNaN(Number(data.price)) || Number(data.price) <= 0) {
  console.log("Invalid price");
  return false;
}

// التحقق حسب نوع الإعلان
if (data.type === "username") {
  if (!data.platform || data.platform.trim() === '') {
    console.log("Username: No platform");
    return false;
  }
  if (!data.username || data.username.trim() === '') {
    console.log("Username: No username");
    return false;
  }
  console.log("Username validation passed");
  return true;
}

if (data.type === "channel") {
  if (!data.username || data.username.trim() === '') {
    console.log("Channel: No username");
    return false;
  }
  console.log("Channel validation passed");
  return true;
}

if (data.type === "service") {
  if (!data.platform || data.platform.trim() === '') {
    console.log("Service: No platform");
    return false;
  }
  if (!data.serviceTitle || data.serviceTitle.trim() === '') {
    console.log("Service: No service title");
    return false;
  }

  // تحقق من الأعداد المطلوبة
  if (data.serviceTitle === "followers" && (data.platform === "instagram" || data.platform === "twitter")) {
    if (!data.followersCount || data.followersCount.trim() === '' || 
        isNaN(Number(data.followersCount)) || Number(data.followersCount) <= 0) {
      console.log("Service: Invalid followers count");
      return false;
    }
  }

  if (data.serviceTitle === "subscribers" && data.platform === "telegram") {
    if (!data.subscribersCount || data.subscribersCount.trim() === '' || 
        isNaN(Number(data.subscribersCount)) || Number(data.subscribersCount) <= 0) {
      console.log("Service: Invalid subscribers count");
      return false;
    }
  }

  console.log("Service validation passed");
  return true;
}

return false;
```

};

// مراقبة تغييرات النموذج
useEffect(() => {
const subscription = form.watch((data) => {
const isValid = validateForm(data);
console.log(“Form validation result:”, isValid);
setCanPublish(isValid);
});

```
return () => subscription.unsubscribe();
```

}, [form]);

// Custom submit handler with validation
const onSubmit = async (data: ListingForm) => {
console.log(“Submitting form data:”, data);

```
// التحقق مرة أخرى قبل الإرسال
if (!validateForm(data)) {
  console.log("Form validation failed on submit");
  toast({
    title: t("error"),
    description: "يرجى التأكد من ملء جميع الحقول المطلوبة بشكل صحيح",
    variant: "destructive",
  });
  return;
}

if (!telegramWebApp.user) {
  toast({
    title: t("error"),
    description: t("openTelegramApp") || "Open this app from Telegram.",
    variant: "destructive",
  });
  return;
}

setIsSubmitting(true);

try {
  const result = await apiRequest("POST", "/api/sell", {
    ...data,
    telegramId: telegramWebApp.user.id,
  });

  if (result.ok) {
    toast({
      title: t("success"),
      description: t("listingSubmitted") || "Your item is now live for sale!",
    });
    form.reset();
    setListingType(null);
    setCanPublish(false);
  } else {
    throw new Error(result.error || "Unknown error occurred");
  }
} catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : t("somethingWentWrong");

  toast({
    title: t("error"),
    description: errorMessage,
    variant: "destructive",
  });
} finally {
  setIsSubmitting(false);
}
```

};

const handleBack = () => {
if (listingType) {
setListingType(null);
form.reset();
setCanPublish(false);
} else {
window.history.back();
}
};

const selectedPlatform = form.watch(“platform”);
const selectedServiceTitle = form.watch(“serviceTitle”);
const formData = form.watch(); // للتشخيص

return (
<div className="min-h-screen bg-background text-foreground p-4">
{!listingType ? (
<Card>
<CardHeader>
<CardTitle>{t(“chooseSellType”)}</CardTitle>
</CardHeader>
<CardContent className="space-y-3">
<Button className=“w-full” onClick={() => setListingType(“username”)}>
{t(“sellUsername”)}
</Button>
<Button className=“w-full” onClick={() => setListingType(“channel”)}>
{t(“sellChannel”)}
</Button>
<Button className=“w-full” onClick={() => setListingType(“service”)}>
{t(“sellService”)}
</Button>
</CardContent>
</Card>
) : (
<Form {…form}>
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
<Card>
<CardHeader>
<CardTitle>
{listingType === “username”
? t(“sellUsername”)
: listingType === “channel”
? t(“sellChannel”)
: t(“sellService”)}
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
{t(“back”)}
</Button>

```
            {/* Debug info محسن */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-md text-sm">
              <p><strong>Status:</strong> canPublish = {canPublish.toString()}</p>
              <p><strong>Type:</strong> {listingType}</p>
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold">عرض البيانات الحالية</summary>
                <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(formData, null, 2)}
                </pre>
              </details>
            </div>

            {/* Type-specific fields */}
            {listingType === "username" && (
              <>
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("platformLabel")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-purple-700 text-white">
                            <SelectValue placeholder={t("selectPlatform")} />
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
                      <FormLabel>{t("usernameLabel")} *</FormLabel>
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
                      <FormLabel>{t("channelUsernameLabel")} *</FormLabel>
                      <FormControl>
                        <Input placeholder="@channel_name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fields.map((field, index) => (
                  <div key={field.id} className="flex space-x-2 items-center">
                    <FormField
                      control={form.control}
                      name={`giftCounts.${index}.giftType`}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger className="bg-purple-700 text-white flex-1">
                            <SelectValue placeholder={t("chooseGiftType")} />
                          </SelectTrigger>
                          <SelectContent className="bg-purple-700 text-white">
                            <SelectItem value="statue">{t("giftNameStatue")}</SelectItem>
                            <SelectItem value="flame">{t("giftNameFlame")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`giftCounts.${index}.count`}
                      render={({ field }) => (
                        <Input
                          type="number"
                          min={1}
                          placeholder={t("giftCountLabel")}
                          {...field}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            field.onChange(isNaN(val) ? 0 : val);
                          }}
                          className="w-24"
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      حذف
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ giftType: "", count: 0 })}
                >
                  {t("addGift")}
                </Button>
              </>
            )}

            {listingType === "service" && (
              <>
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("platformLabel")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-purple-700 text-white">
                            <SelectValue placeholder={t("selectPlatform")} />
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
                      <FormLabel>{t("serviceTypeLabel")} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger className="bg-purple-700 text-white">
                            <SelectValue placeholder={t("serviceTypeLabel")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-purple-700 text-white">
                          <SelectItem value="followers">{t("followers")}</SelectItem>
                          <SelectItem value="subscribers">{t("subscribers")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(selectedPlatform === "instagram" || selectedPlatform === "twitter") &&
                  selectedServiceTitle === "followers" && (
                    <FormField
                      control={form.control}
                      name="followersCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("followersCountLabel")} *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder={t("followersCountLabel")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                {selectedPlatform === "telegram" && selectedServiceTitle === "subscribers" && (
                  <FormField
                    control={form.control}
                    name="subscribersCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("subscribersCountLabel")} *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder={t("subscribersCountLabel")}
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

            {/* Common fields */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("priceLabel")} *</FormLabel>
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
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional details..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit button محسن */}
            <Button
              type="submit"
              className={`w-full flex justify-center items-center rounded-md border-2 transition-all duration-200
                ${
                  canPublish && !isSubmitting
                    ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                    : "bg-gray-400 cursor-not-allowed border-gray-400 text-gray-700"
                }
                px-4 py-3 shadow-md font-medium
              `}
              disabled={!canPublish || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  {t("publishing") || "Publishing..."}
                </>
              ) : (
                <>
                  {canPublish ? "✅ " : "❌ "}
                  {t("publishListing") || "Publish Listing"}
                </>
              )}
            </Button>

            {/* معلومات إضافية للمستخدم */}
            {!canPublish && (
              <div className="text-sm text-gray-600 text-center">
                <p>يرجى ملء جميع الحقول المطلوبة (*) لتفعيل زر النشر</p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  )}
</div>
```

);
}