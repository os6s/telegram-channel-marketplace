// client/src/pages/sell/parts/AccountForm.tsx
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";
import { normalizeUsername } from "../utils/normalize";

export default function AccountForm({ form, platform }: { form: any; platform: string }) {
  const { t } = useLanguage();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const maxMonth = `${yyyy}-${mm}`;

  return (
    <>
      <FormField
        name="platform"
        control={form.control}
        render={() => (
          <FormItem>
            <FormLabel>{t("sell.platform")}</FormLabel>
            <FormControl>
              <Input readOnly value={platform} className="bg-card text-foreground" />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        name="username"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.usernameLabel")}</FormLabel>
            <FormControl>
              <Input
                {...field}
                autoComplete="off"
                placeholder="handle"
                className="bg-card text-foreground"
                onBlur={(e) => {
                  const norm = normalizeUsername(e.target.value);
                  form.setValue("username", norm, { shouldValidate: true });
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="createdAt"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.createdAt") || "YYYY-MM"}</FormLabel>
            <FormControl>
              <Input
                type="month"
                {...field}
                min="2006-01"
                max={maxMonth}
                className="bg-card text-foreground"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {(platform === "twitter" || platform === "instagram" || platform === "tiktok") && (
        <FormField
          name="followersCount"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sell.followers")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  {...field}
                  className="bg-card text-foreground"
                  onWheel={(e) => e.currentTarget.blur()} // منع سكرول تغيير الرقم
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}