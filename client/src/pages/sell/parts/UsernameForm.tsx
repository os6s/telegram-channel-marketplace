// client/src/pages/sell/parts/UsernameForm.tsx
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";

export default function UsernameForm({
  form,
  platform,
}: {
  form: any;
  platform: string;
}) {
  const { t } = useLanguage();
  const selectCls =
    "w-full rounded-md border px-3 py-2 bg-card text-foreground";

  return (
    <>
      <FormField
        name="platform"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.platform")}</FormLabel>
            <FormControl>
              <Input {...field} readOnly value={platform} className="bg-card" />
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
                placeholder="username"
                className="bg-card"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {platform === "telegram" && (
        <FormField
          name="tgUserType"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sell.tgUserType")}</FormLabel>
              <FormControl>
                <select {...field} className={selectCls}>
                  <option value=""></option>
                  <option value="NFT">{t("sell.NFT")}</option>
                  <option value="NORMAL">{t("sell.NORMAL")}</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}