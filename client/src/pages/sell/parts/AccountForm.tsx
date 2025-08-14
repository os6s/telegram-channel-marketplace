// client/src/pages/sell/parts/AccountForm.tsx
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";

export default function AccountForm({ form, platform }: { form: any; platform: string }) {
  const { t } = useLanguage();

  return (
    <>
      <FormField
        name="platform"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.platform")}</FormLabel>
            <FormControl>
              <Input {...field} readOnly value={platform} className="bg-background" />
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
              <Input {...field} placeholder="handle" className="bg-background" />
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
            <FormLabel>YYYY-MM</FormLabel>
            <FormControl>
              <Input type="month" {...field} className="bg-background" />
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
                <Input type="number" min={0} {...field} className="bg-background" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}