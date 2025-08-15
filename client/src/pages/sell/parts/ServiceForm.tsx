// client/src/pages/sell/parts/ServiceForm.tsx
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/language-context";

export default function ServiceForm({ form }:{ form:any }) {
  const { t } = useLanguage();
  const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";

  return (
    <>
      <FormField name="serviceType" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{t("sell.serviceType")}</FormLabel>
          <FormControl>
            <select
              {...field}
              className={selectCls}
              onChange={(e)=> {
                field.onChange(e);
                const v = e.target.value;
                if (v==="followers") form.setValue("target","instagram",{shouldValidate:true, shouldDirty:true});
                else if (v==="members"||v==="boost_channel") form.setValue("target","telegram_channel",{shouldValidate:true, shouldDirty:true});
                else if (v==="boost_group") form.setValue("target","telegram_group",{shouldValidate:true, shouldDirty:true});
                form.trigger();
              }}
            >
              <option value="followers">{t("sell.followers")}</option>
              <option value="members">{t("sell.members")}</option>
              <option value="boost_channel">{t("sell.boostCh")}</option>
              <option value="boost_group">{t("sell.boostGp")}</option>
            </select>
          </FormControl>
          <FormMessage/>
        </FormItem>
      )}/>

      <FormField name="target" control={form.control} render={({field})=>{
        const st = form.watch("serviceType");
        const opts = st==="followers" ? ["instagram","twitter"]
          : st==="members" ? ["telegram_channel"]
          : st==="boost_channel" ? ["telegram_channel"]
          : ["telegram_group"];
        return (
          <FormItem>
            <FormLabel>{t("sell.target")}</FormLabel>
            <FormControl>
              <select {...field} className={selectCls}>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </FormControl>
            <FormMessage/>
          </FormItem>
        );
      }}/>

      <FormField name="count" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{t("sell.count")}</FormLabel>
          <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
          <FormMessage/>
        </FormItem>
      )}/>
    </>
  );
}