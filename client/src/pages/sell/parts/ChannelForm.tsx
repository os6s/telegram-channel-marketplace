import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function ChannelForm({ form, L }:{ form:any; L:any }) {
  const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";
  return (
    <>
      <FormField name="channelMode" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.channelMode}</FormLabel>
          <FormControl>
            <select {...field} className={selectCls} onChange={(e)=>{field.onChange(e); form.setValue("subscribersCount",""); form.setValue("giftsCount","");}}>
              <option value="subscribers">{L.modeSubscribers}</option>
              <option value="gifts">{L.modeGifts}</option>
            </select>
          </FormControl>
          <FormMessage/>
        </FormItem>
      )}/>
      <FormField name="link" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.channelLinkOpt}</FormLabel>
          <FormControl><Input {...field} className="bg-background" placeholder="t.me/yourchannel" /></FormControl>
          <FormMessage/>
        </FormItem>
      )}/>
      <FormField name="channelUsername" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.channelUserOpt}</FormLabel>
          <FormControl><Input {...field} className="bg-background" placeholder="yourchannel" /></FormControl>
          <FormMessage/>
        </FormItem>
      )}/>
      {form.watch("channelMode")==="subscribers" ? (
        <FormField name="subscribersCount" control={form.control} render={({field})=>(
          <FormItem>
            <FormLabel>{L.subsCount}</FormLabel>
            <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
            <FormMessage/>
          </FormItem>
        )}/>
      ) : (
        <>
          <FormField name="giftsCount" control={form.control} render={({field})=>(
            <FormItem>
              <FormLabel>{L.giftsCount}</FormLabel>
              <FormControl><Input type="number" min={1} {...field} className="bg-background" /></FormControl>
              <FormMessage/>
            </FormItem>
          )}/>
          <FormField name="giftKind" control={form.control} render={({field})=>(
            <FormItem>
              <FormLabel>{L.giftKind}</FormLabel>
              <FormControl>
                <select {...field} className={selectCls}>
                  <option value="upgraded">{L.upgraded}</option>
                  <option value="regular">{L.regular}</option>
                  <option value="both">{L.both}</option>
                </select>
              </FormControl>
              <FormMessage/>
            </FormItem>
          )}/>
        </>
      )}
    </>
  );
}
