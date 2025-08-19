// client/src/pages/sell/parts/ChannelForm.tsx
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";

export default function ChannelForm({ form }: { form: any }) {
  const { t } = useLanguage();
  const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";

  return (
    <>
      <FormField
        name="channelMode"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.channelMode")}</FormLabel>
            <FormControl>
              <select
                {...field}
                className={selectCls}
                onChange={(e) => {
                  field.onChange(e);
                  // أفرّغ الحقول التابعة للمود وأعيد الفالديشن
                  form.setValue("subscribersCount", "", { shouldValidate: true });
                  form.setValue("giftsCount", "", { shouldValidate: true });
                  form.setValue("giftKind", "regular", { shouldValidate: true });
                  form.trigger();
                }}
              >
                <option value="subscribers">{t("sell.modeSubscribers")}</option>
                <option value="gifts">{t("sell.modeGifts")}</option>
              </select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="link"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.channelLinkOpt")}</FormLabel>
            <FormControl>
              <Input {...field} className="bg-background" placeholder="https://t.me/yourchannel" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="channelUsername"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("sell.channelUserOpt")}</FormLabel>
            <FormControl>
              <Input {...field} className="bg-background" placeholder="yourchannel" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch("channelMode") === "subscribers" ? (
        <FormField
          name="subscribersCount"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("sell.subsCount")}</FormLabel>
              <FormControl>
                <Input type="number" min={1} {...field} className="bg-background" placeholder="1000" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <>
          <FormField
            name="giftsCount"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("sell.giftsCount")}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} className="bg-background" placeholder="50" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="giftKind"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("sell.giftKind")}</FormLabel>
                <FormControl>
                  <select {...field} className={selectCls}>
                    <option value="regular">{t("sell.regular")}</option>
                    <option value="upgraded">{t("sell.upgraded")}</option>
                    <option value="both">{t("sell.both")}</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  );
}