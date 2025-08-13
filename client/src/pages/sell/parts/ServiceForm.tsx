import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function ServiceForm({ form, L }:{ form:any; L:any }) {
  const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";
  return (
    <>
      <FormField name="serviceType" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.serviceType}</FormLabel>
          <FormControl>
            <select {...field} className={selectCls} onChange={(e)=>{field.onChange(e);
              const v = e.target.value;
              if (v==="followers") form.setValue("target","instagram");
              else if (v==="members") form.setValue("target","telegram_channel");
              else if (v==="boost_channel") form.setValue("target","telegram_channel");
              else if (v==="boost_group") form.setValue("target","telegram_group");
            }}>
              <option value="followers">{L.followers}</option>
              <option value="members">{L.members}</option>
              <option value="boost_channel">{L.boostCh}</option>
              <option value="boost_group">{L.boostGp}</option>
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
            <FormLabel>{L.target}</FormLabel>
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
          <FormLabel>{L.count}</FormLabel>
          <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
          <FormMessage/>
        </FormItem>
      )}/>
    </>
  );
}
