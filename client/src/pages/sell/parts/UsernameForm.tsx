import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export default function UsernameForm({ form, L, platform }:{
  form:any; L:any; platform:string;
}) {
  const selectCls = "w-full rounded-md border px-3 py-2 bg-background text-foreground";
  return (
    <>
      <FormField name="platform" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.platform}</FormLabel>
          <FormControl><Input {...field} readOnly value={platform} className="bg-background" /></FormControl>
        </FormItem>
      )}/>
      <FormField name="username" control={form.control} render={({field})=>(
        <FormItem>
          <FormLabel>{L.usernameLabel}</FormLabel>
          <FormControl><Input {...field} placeholder="username" className="bg-background" /></FormControl>
          <FormMessage />
        </FormItem>
      )}/>
      {platform==="telegram" && (
        <FormField name="tgUserType" control={form.control} render={({field})=>(
          <FormItem>
            <FormLabel>{L.tgUserType}</FormLabel>
            <FormControl>
              <select {...field} className={selectCls}>
                <option value=""></option>
                <option value="NFT">{L.NFT}</option>
                <option value="NORMAL">{L.NORMAL}</option>
              </select>
            </FormControl>
            <FormMessage/>
          </FormItem>
        )}/>
      )}
    </>
  );
}
