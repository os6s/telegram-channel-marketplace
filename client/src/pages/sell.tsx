import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { useLanguage } from "@/contexts/language-context";

// Schema validation محسن
const listingSchema = z.object({
  type: z.enum(["username", "channel", "service"]),
  platform: z.string().optional(),
  username: z.string().optional(),
  price: z.string().min(1, "Price is required."),
  description: z.string().optional(),
  serviceTitle: z.string().optional(),
  followersCount: z.string().optional(),
  subscribersCount: z.string().optional(),
  giftCounts: z
    .array(
      z.object({
        giftType: z.string().min(1, "Gift type is required"),
        count: z.number().min(1, "Count must be at least 1"),
      })
    )
    .optional(),
});

type ListingForm = z.infer<typeof listingSchema>;

export default function SellPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [listingType, setListingType] = useState<"username" | "channel" | "service" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canPublish, setCanPublish] = useState(false);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      type: undefined,
      price: "",
      description: "",
      followersCount: "",
      subscribersCount: "",
      platform: "",
      giftCounts: [],
    },
    mode: "onChange",
    reValidateMode: "onChange",
    criteriaMode: "all",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "giftCounts",
  });

  // تحديث نوع الإعلان
  useEffect(() => {
    if (listingType) {
      form.setValue("type", listingType, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [listingType, form]);

  // Custom validation function
  const validateForm = (data: any) => {
    console.log("Validating form data:", data);

    if (!data.type) {
      console.log("No type selected");
      return false;
    }

    if (!data.price || data.price.trim() === "" || isNaN(Number(data.price)) || Number(data.price) <= 0) {
      console.log("Invalid price");
      return false;
    }

    if (data.type === "username") {
      if (!data.platform || data.platform.trim() === "") {
        console.log("Username: No platform");
        return false;
      }
      if (!data.username || data.username.trim() === "") {
        console.log("Username: No username");
        return false;
      }
      console.log("Username validation passed");
      return true;
    }

    if (data.type === "channel") {
      if (!data.username || data.username.trim() === "") {
        console.log("Channel: No username");
        return false;
      }
      console.log("Channel validation passed");
      return true;
    }

    if (data.type === "service") {
      if (!data.platform || data.platform.trim() === "") {
        console.log("Service: No platform");
        return false;
      }
      if (!data.serviceTitle || data.serviceTitle.trim() === "") {
        console.log("Service: No service title");
        return false;
      }

      if (data.serviceTitle === "followers" && (data.platform === "instagram" || data.platform === "twitter")) {
        if (!data.followersCount || data.followersCount.trim() === "" || 
            isNaN(Number(data.followersCount)) || Number(data.followersCount) <= 0) {
          console.log("Service: Invalid followers count");
          return false;
        }
      }

      if (data.serviceTitle === "subscribers" && data.platform === "telegram") {
        if (!data.subscribersCount || data.subscribersCount.trim() === "" || 
            isNaN(Number(data.subscribersCount)) || Number(data.subscribersCount) <= 0) {
          console.log("Service: Invalid subscribers count");
          return false;
        }
      }

      console.log("Service validation passed");
      return true;
    }

    return false;
  };

  useEffect(() => {
    const subscription = form.watch((data) => {
      const isValid = validateForm(data);
      console.log("Form validation result:", isValid);
      setCanPublish(isValid);
    });

    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (data: ListingForm) => {
    console.log("Submitting form data:", data);

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

  const selectedPlatform = form.watch("platform");
  const selectedServiceTitle = form.watch("serviceTitle");
  const formData = form.watch();

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {!listingType ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("chooseSellType")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => setListingType("username")}>
              {t("sellUsername")}
            </Button>
            <Button className="w-full" onClick={() => setListingType("channel")}>
              {t("sellChannel")}
            </Button>
            <Button className="w-full" onClick={() => setListingType("service")}>
              {t("sellService")}
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
                    ? t("sellUsername")
                    : listingType === "channel"
                    ? t("sellChannel")
                    : t("sellService")}
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
                  {t("back")}
                </Button>

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
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
}